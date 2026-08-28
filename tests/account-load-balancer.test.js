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
    const { balancer } = createBalancer();
    const leases = await Promise.all([balancer.acquire(), balancer.acquire(), balancer.acquire()]);
    assert.deepEqual(
        leases.map(lease => lease.authIndex).sort((a, b) => a - b),
        [0, 1, 2]
    );
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
    await assert.rejects(balancer.acquire({ timeoutMs: 20 }), error => error.code === "ACCOUNT_ACQUIRE_TIMEOUT");
    now += 61;
    balancer.notifyAvailabilityChanged();
    const next = await balancer.acquire();
    assert.equal(next.authIndex, 0);
    next.release();
});

test("cools down an account by status and restores it after expiry", async () => {
    let now = 1000;
    const { balancer } = createBalancer({ connected: [0, 1], now: () => now });
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
