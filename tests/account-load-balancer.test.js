const assert = require("node:assert/strict");
const test = require("node:test");

const AccountLoadBalancer = require("../src/core/AccountLoadBalancer");
const AccountRequestContext = require("../src/core/AccountRequestContext");
const RuntimeSettingsStore = require("../src/utils/RuntimeSettingsStore");

function createBalancer(options = {}) {
    let connected = options.connected || [0, 1, 2];
    const balancer = new AccountLoadBalancer({
        acquireTimeoutMs: options.acquireTimeoutMs ?? 100,
        cooldownByStatus: options.cooldownByStatus || { 429: 60, 503: 30 },
        getEligibleAuthIndices: () => connected,
        maxConcurrentPerAccount: options.maxConcurrentPerAccount ?? 1,
        maxConcurrentRequests: options.maxConcurrentRequests,
        now: options.now,
    });
    return {
        balancer,
        setConnected(indices) {
            connected = indices;
            balancer.notifyAvailabilityChanged();
        },
    };
}

test("distributes concurrent leases fairly across eligible accounts", async () => {
    const { balancer } = createBalancer({
        acquireTimeoutMs: 100,
        connected: [0, 1, 2],
        maxConcurrentRequests: 3,
    });
    const leases = await Promise.all([balancer.acquire(), balancer.acquire(), balancer.acquire()]);
    assert.deepEqual(
        leases.map(lease => lease.authIndex).sort((a, b) => a - b),
        [0, 1, 2]
    );
    leases.forEach(lease => lease.release());
});

test("limits global concurrency to half of active accounts by default", async () => {
    const { balancer } = createBalancer({ acquireTimeoutMs: 30, connected: [0, 1, 2, 3, 4, 5] });
    const leases = await Promise.all([balancer.acquire(), balancer.acquire(), balancer.acquire()]);
    assert.equal(balancer.getSnapshot().globalConcurrencyLimit, 3);
    await assert.rejects(balancer.acquire(), error => error.code === "ACCOUNT_ACQUIRE_TIMEOUT");
    leases.forEach(lease => lease.release());
});

test("waits when all accounts are busy and wakes after release", async () => {
    const { balancer } = createBalancer({ acquireTimeoutMs: 500, connected: [0] });
    const first = await balancer.acquire();
    let resolved = false;
    const waiting = balancer.acquire().then(lease => {
        resolved = true;
        return lease;
    });

    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(resolved, false);
    first.release();
    const second = await waiting;
    assert.equal(second.authIndex, 0);
    second.release();
});

test("times out when no account becomes available", async () => {
    const { balancer } = createBalancer({ acquireTimeoutMs: 20, connected: [] });
    await assert.rejects(balancer.acquire(), error => error.code === "ACCOUNT_ACQUIRE_TIMEOUT");
});

test("supports cancellation while waiting without leaking capacity", async () => {
    const { balancer } = createBalancer({ acquireTimeoutMs: 500, connected: [0] });
    const first = await balancer.acquire();
    const controller = new AbortController();
    const waiting = balancer.acquire({ signal: controller.signal });
    controller.abort();
    await assert.rejects(waiting, error => error.name === "AbortError");
    first.release();
    const next = await balancer.acquire();
    assert.equal(next.authIndex, 0);
    next.release();
});

test("excludes attempted accounts and can move a lease to another account", async () => {
    const { balancer } = createBalancer({ connected: [0, 1] });
    const lease = await balancer.acquire();
    const original = lease.authIndex;
    await lease.move({ exclude: new Set([original]) });
    assert.notEqual(lease.authIndex, original);
    lease.release();
});

test("restores the original lease when moving has no alternative account", async () => {
    const { balancer } = createBalancer({ acquireTimeoutMs: 20, connected: [0] });
    const lease = await balancer.acquire();
    await assert.rejects(lease.move({ exclude: new Set([0]) }), error => error.code === "ACCOUNT_ACQUIRE_TIMEOUT");
    assert.equal(lease.authIndex, 0);
    lease.release();
    const next = await balancer.acquire();
    assert.equal(next.authIndex, 0);
    next.release();
});

test("preserves a status cooldown when moving has no alternative account", async () => {
    let now = 1000;
    const { balancer } = createBalancer({ acquireTimeoutMs: 20, connected: [0], now: () => now });
    const lease = await balancer.acquire();
    await assert.rejects(
        lease.move({ exclude: new Set([0]), release: { status: 429 } }),
        error => error.code === "ACCOUNT_ACQUIRE_TIMEOUT"
    );
    lease.release();
    assert.equal(balancer.getSnapshot().accounts[0].cooldownUntil, 1060);
    // 全部账号都在冷却时不再直接失败：回退到最快解冻的账号，避免前端 503
    const fallback = await balancer.acquire({ timeoutMs: 20 });
    assert.equal(fallback.authIndex, 0);
    fallback.release();
    now += 61;
    balancer.notifyAvailabilityChanged();
    const next = await balancer.acquire();
    assert.equal(next.authIndex, 0);
    next.release();
});

test("cools down an account by status and restores it after expiry", async () => {
    let now = 1000;
    const { balancer } = createBalancer({
        connected: [0, 1],
        maxConcurrentRequests: 2,
        now: () => now,
    });
    const first = await balancer.acquire();
    const cooled = first.authIndex;
    first.release({ status: 429 });

    const second = await balancer.acquire();
    assert.notEqual(second.authIndex, cooled);
    second.release();

    now += 61;
    const leases = await Promise.all([balancer.acquire(), balancer.acquire()]);
    assert.equal(
        leases.some(lease => lease.authIndex === cooled),
        true
    );
    leases.forEach(lease => lease.release());
});

test("moves through every eligible account for repeated 403 responses before exhausting alternatives", async () => {
    const { balancer } = createBalancer({
        acquireTimeoutMs: 20,
        connected: [0, 1, 2],
        cooldownByStatus: { 403: 300 },
        maxConcurrentRequests: 3,
    });
    const lease = await balancer.acquire();
    const attempted = new Set([lease.authIndex]);

    await lease.move({ exclude: attempted, release: { status: 403 } });
    attempted.add(lease.authIndex);
    await lease.move({ exclude: attempted, release: { status: 403 } });
    attempted.add(lease.authIndex);

    assert.equal(attempted.size, 3);
    await assert.rejects(
        lease.move({ exclude: attempted, release: { status: 403 } }),
        error => error.code === "ACCOUNT_ACQUIRE_TIMEOUT"
    );
    assert.equal(attempted.has(lease.authIndex), true);
    lease.release();
});

test("release is idempotent", async () => {
    const { balancer } = createBalancer({ connected: [0] });
    const lease = await balancer.acquire();
    lease.release();
    lease.release();
    const next = await balancer.acquire();
    assert.equal(next.authIndex, 0);
    next.release();
});

test("persists and reloads the load-balancing runtime setting", async t => {
    const fs = require("node:fs/promises");
    const os = require("node:os");
    const path = require("node:path");
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "aistudio-settings-"));
    t.after(() => fs.rm(directory, { force: true, recursive: true }));
    const filePath = path.join(directory, "runtime-settings.json");

    const first = new RuntimeSettingsStore(filePath);
    await first.set("accountLoadBalancing", false);

    const second = new RuntimeSettingsStore(filePath);
    assert.equal(await second.get("accountLoadBalancing", true), false);
});

test("computes a one-minute request and account breakdown", async () => {
    const UsageStatsService = require("../src/core/UsageStatsService");
    const service = new UsageStatsService(
        {
            accountNameMap: new Map([
                [0, "alpha"],
                [1, "beta"],
            ]),
        },
        null,
        "/tmp",
        false
    );
    service.enabled = true;
    const now = Date.now();
    service.records = [
        { finalAccountName: "alpha", finalAuthIndex: 0, finishedAt: new Date(now - 1000).toISOString() },
        { finalAccountName: "alpha", finalAuthIndex: 0, finishedAt: new Date(now - 30000).toISOString() },
        { finalAccountName: "beta", finalAuthIndex: 1, finishedAt: new Date(now - 70000).toISOString() },
    ];
    service.activeRequests = new Map([["active", {}]]);
    const recent = service.getRecentLoadSnapshot();
    assert.equal(recent.activeRequests, 1);
    assert.equal(recent.requestsLastMinute, 2);
    assert.deepEqual(recent.accounts, [{ accountName: "alpha", authIndex: 0, count: 2, key: "0:alpha" }]);
});

test("uses all eligible accounts as the attempt limit while load balancing is enabled", () => {
    const RequestHandler = require("../src/core/RequestHandler");
    const handler = Object.create(RequestHandler.prototype);
    handler.config = { accountLoadBalancing: true, maxRetries: 3 };
    handler.accountLoadBalancer = {
        getSnapshot: () => ({ accounts: Array.from({ length: 10 }), globalConcurrencyLimit: 5 }),
    };
    assert.equal(handler._getRequestAttemptLimit(), 10);

    handler.config.accountLoadBalancing = false;
    assert.equal(handler._getRequestAttemptLimit(), 3);
});

test("keeps the leased account isolated across concurrent async request contexts", async () => {
    const context = new AccountRequestContext();
    const observed = await Promise.all([
        context.run({ authIndex: 10 }, async () => {
            await new Promise(resolve => setTimeout(resolve, 20));
            return context.getAuthIndex();
        }),
        context.run({ authIndex: 20 }, async () => {
            await new Promise(resolve => setTimeout(resolve, 5));
            return context.getAuthIndex();
        }),
    ]);
    assert.deepEqual(observed, [10, 20]);
});

test("honours a preferred account so affinity-bound requests stay on one account", async () => {
    const { balancer } = createBalancer({
        acquireTimeoutMs: 200,
        connected: [0, 1, 2],
        maxConcurrentRequests: 3,
    });
    const lease = await balancer.acquire({ preferredAuthIndex: 2 });
    assert.equal(lease.authIndex, 2);
    lease.release();

    const again = await balancer.acquire({ preferredAuthIndex: 2 });
    assert.equal(again.authIndex, 2);
    again.release();

    const notPreferred = await balancer.acquire();
    assert.notEqual(notPreferred.authIndex, 2);
    notPreferred.release();
});

test("waits for the preferred account instead of silently switching away", async () => {
    const { balancer } = createBalancer({
        acquireTimeoutMs: 200,
        connected: [0, 1],
        maxConcurrentRequests: 2,
        maxConcurrentPerAccount: 1,
    });
    const busy = await balancer.acquire({ preferredAuthIndex: 1 });
    assert.equal(busy.authIndex, 1);

    // 账号 #1 已占满：偏好请求应排队等待，而不是被分到 #0。
    const waiting = balancer.acquire({ preferredAuthIndex: 1 });
    let resolvedAuthIndex = null;
    waiting.then(lease => {
        resolvedAuthIndex = lease.authIndex;
        lease.release();
    });
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(resolvedAuthIndex, null, "must not fall back to another account while the preferred one is busy");

    busy.release();
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(resolvedAuthIndex, 1);
});

test("ignores a preferred account that is excluded or cooling down", async () => {
    const { balancer } = createBalancer({ acquireTimeoutMs: 100, connected: [0, 1], maxConcurrentRequests: 2 });
    balancer.markCooldown(1, 403);
    const lease = await balancer.acquire({ preferredAuthIndex: 1 });
    assert.equal(lease.authIndex, 0);
    lease.release();
});

