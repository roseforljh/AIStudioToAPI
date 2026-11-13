const assert = require("node:assert/strict");
const test = require("node:test");
const { EventEmitter } = require("node:events");
const AccountLoadBalancer = require("../src/core/AccountLoadBalancer");
const AccountRequestContext = require("../src/core/AccountRequestContext");
const RequestHandler = require("../src/core/RequestHandler");
const AccountRoutingPolicy = require("../src/core/AccountRoutingPolicy");
const tick = () => new Promise(resolve => setImmediate(resolve));

function pool(ready = []) {
    let connected = ready;
    const denied = new Set();
    const policy = Object.create(AccountRoutingPolicy.prototype);
    policy.settings = { normalActive: 1, paidActive: 1 };
    policy.group = index => (index < 10 ? "normal" : "paid");
    const balancer = new AccountLoadBalancer({
        acquireTimeoutMs: 100,
        canAcquireAuthIndex: index => {
            const group = policy.group(index);
            const active = balancer
                .getSnapshot()
                .accounts.filter(account => policy.group(account.authIndex) === group)
                .reduce((sum, account) => sum + account.activeRequests, 0);
            return active < policy.settings[group + "Active"];
        },
        getEligibleAuthIndices: allowed =>
            policy.choose(
                connected.filter(
                    index => !allowed || (typeof allowed === "function" ? allowed(index) : allowed.has(index))
                ),
                index => balancer.isCoolingDown(index)
            ),
        maxConcurrentRequests: count => count,
    });
    return {
        allowed: index => !denied.has(index),
        balancer,
        connect(indices) {
            connected = indices;
            balancer.notifyAvailabilityChanged();
        },
        denied,
    };
}

test("cold pool admits newly connected accounts instead of retaining an empty allowed snapshot", async () => {
    const p = pool();
    const pending = p.balancer.acquire({ allowed: p.allowed, noCoolingFallback: true });
    await tick();
    assert.equal(p.balancer.waiters.length, 1);
    p.connect([0]);
    const lease = await pending;
    assert.equal(lease.authIndex, 0);
    lease.release();
    assert.equal(p.balancer.getActiveRequestCount(), 0);
});

test("model restriction promotes healthy standby before selecting active group slots", async () => {
    const p = pool([0, 1, 10]);
    p.denied.add(0);
    const first = await p.balancer.acquire({ allowed: p.allowed, noCoolingFallback: true });
    const second = await p.balancer.acquire({ allowed: p.allowed, noCoolingFallback: true });
    assert.deepEqual(
        [first.authIndex, second.authIndex].sort((a, b) => a - b),
        [1, 10]
    );
    first.release();
    second.release();
});

test("retry re-evaluates restrictions and newly promoted accounts without leaking leases", async () => {
    const p = pool([0, 1]);
    const lease = await p.balancer.acquire({ allowed: p.allowed, noCoolingFallback: true });
    assert.equal(lease.authIndex, 0);
    p.denied.add(0);
    await lease.move({ exclude: new Set([0]), failFast: true });
    assert.equal(lease.authIndex, 1);
    lease.release();
    assert.equal(p.balancer.getActiveRequestCount(), 0);
});

test("group/model restrictions stay enforced on newly connected and fallback accounts", async () => {
    const p = pool([0]);
    p.denied.add(0);
    p.denied.add(10);
    const pending = p.balancer.acquire({ allowed: p.allowed, noCoolingFallback: true, timeoutMs: 30 });
    const rejected = assert.rejects(pending, e => e.code === "ACCOUNT_ACQUIRE_TIMEOUT");
    p.connect([0, 10]);
    await rejected;
    assert.equal(p.balancer.getActiveRequestCount(), 0);
    assert.equal(p.balancer.waiters.length, 0);
});

test("fixed allowed sets and pinned affinity still reject accounts outside their boundary", async () => {
    const p = pool([0, 1, 10]);
    const lease = await p.balancer.acquire({ allowed: new Set([1]), preferredAuthIndex: 1, requirePreferred: true });
    assert.equal(lease.authIndex, 1);
    await assert.rejects(
        p.balancer.acquire({ allowed: new Set([1]), preferredAuthIndex: 10, requirePreferred: true, timeoutMs: 20 }),
        e => e.code === "ACCOUNT_ACQUIRE_TIMEOUT"
    );
    lease.release();
});

test("cancellation while waiting for pool recovery removes the waiter", async () => {
    const p = pool();
    const controller = new AbortController();
    const pending = p.balancer.acquire({ allowed: p.allowed, signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, e => e.name === "AbortError");
    p.connect([0]);
    assert.equal(p.balancer.waiters.length, 0);
    assert.equal(p.balancer.getActiveRequestCount(), 0);
});

test("request handler waits through startup and releases its recovered account", async () => {
    const p = pool();
    const req = Object.assign(new EventEmitter(), {
        body: { model: "test-model" },
        method: "POST",
        path: "/v1/chat/completions",
    });
    const res = Object.assign(new EventEmitter(), { setHeader() {}, statusCode: 200 });
    const context = {
        _extractModelFromPath: () => null,
        _getRequestAffinityPin: () => null,
        _loadBalancerTimeouts: () => ({ total: 100 }),
        _sendErrorResponse() {
            assert.fail("premature 503");
        },
        accountLoadBalancer: p.balancer,
        accountRequestContext: new AccountRequestContext(),
        browserManager: { contexts: new Map([[1, {}]]) },
        config: { accountLoadBalancing: true },
        connectionRegistry: { getConnectionByAuth: () => ({ readyState: 1 }) },
        logger: { info() {}, warn() {} },
        serverSystem: {
            accountRoutingPolicy: { blocked: i => p.denied.has(i), group: () => "normal", groupDenied: () => false },
        },
    };
    let called = false;
    const pending = RequestHandler.prototype._withAccountLease.call(context, req, res, async () => {
        called = true;
        assert.equal(context.accountRequestContext.getLease().authIndex, 1);
    });
    await tick();
    assert.equal(called, false);
    p.connect([1]);
    await pending;
    assert.equal(called, true);
    assert.equal(p.balancer.getActiveRequestCount(), 0);
    assert.equal(req.listenerCount("aborted"), 0);
    assert.equal(res.listenerCount("close"), 0);
});

test("promoting different model standbys cannot exceed active group concurrency", async () => {
    const p = pool([0, 1, 10]);
    const first = await p.balancer.acquire({ allowed: index => index === 0 });
    await assert.rejects(
        p.balancer.acquire({ allowed: index => index === 1, timeoutMs: 20 }),
        e => e.code === "ACCOUNT_ACQUIRE_TIMEOUT"
    );
    const paid = await p.balancer.acquire({ allowed: index => index === 10 });
    assert.equal(paid.authIndex, 10);
    paid.release();
    first.release();
    const promoted = await p.balancer.acquire({ allowed: index => index === 1 });
    assert.equal(promoted.authIndex, 1);
    promoted.release();
});

test("an unavailable restricted waiter does not block a later eligible waiter", async () => {
    const p = pool([]);
    const unavailable = p.balancer.acquire({ allowed: index => index === 9, timeoutMs: 30 });
    const rejected = assert.rejects(unavailable, e => e.code === "ACCOUNT_ACQUIRE_TIMEOUT");
    const eligible = p.balancer.acquire({ allowed: index => index === 0 });
    p.connect([0]);
    const lease = await eligible;
    assert.equal(lease.authIndex, 0);
    lease.release();
    await rejected;
});

test("context admission wakes queued requests after an earlier WebSocket-ready event", async t => {
    const fs = require("node:fs");
    const os = require("node:os");
    const path = require("node:path");
    const BrowserManager = require("../src/core/BrowserManager");
    const { BuildBenefitContext } = require("../src/core/BuildBenefitContext");
    const { MakerSuiteBridge } = require("../src/core/MakerSuiteBridge");
    t.mock.method(BuildBenefitContext.prototype, "install", async () => {});
    t.mock.method(MakerSuiteBridge.prototype, "install", async () => {});
    const logger = { debug() {}, error() {}, info() {}, warn() {} };
    const page = Object.assign(new EventEmitter(), { isClosed: () => false });
    const context = Object.assign(new EventEmitter(), {
        addInitScript: async () => {},
        close: async () => {},
        newPage: async () => page,
    });
    const connections = new Map([[0, { readyState: 1 }]]);
    const registry = Object.assign(new EventEmitter(), { getAllConnections: () => connections });
    const browser = {
        _checkPageStatusAndErrors: async () => {},
        _contextLifecycle: new Map(),
        _getPrivacyProtectionScript: () => "",
        _navigateAndWakeUpPage: async () => browser._wsInitState.set(0, { success: true }),
        _startHealthMonitor() {},
        _throwIfContextInitAborted() {},
        _updateAuthFile: async () => {},
        _wsInitState: new Map(),
        abortedContexts: new Set(),
        authSource: { getAuth: () => ({ cookies: [] }) },
        browser: { newContext: async () => context },
        connectionRegistry: registry,
        contexts: new Map(),
        initializingContexts: new Set([0]),
        logger,
        stickyProxyManager: { getProxyForAuth: () => null },
    };
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "context-admission-"));
    const cwd = process.cwd();
    let handler;
    try {
        process.chdir(directory);
        handler = new RequestHandler({}, registry, logger, browser, { accountLoadBalancing: true }, {});
    } finally {
        process.chdir(cwd);
        fs.rmSync(directory, { force: true, recursive: true });
    }
    const pending = handler.accountLoadBalancer.acquire({ timeoutMs: 500 });
    registry.emit("connectionAdded", connections.get(0));
    assert.equal(handler.accountLoadBalancer.waiters.length, 1);
    registry.once("contextReady", index => assert.ok(browser.contexts.has(index)));
    await BrowserManager.prototype._initializeContextWithHealth.call(browser, 0, true);
    const lease = await pending;
    assert.equal(lease.authIndex, 0);
    assert.equal(handler.accountLoadBalancer.waiters.length, 0);
    lease.release();
    assert.equal(handler.accountLoadBalancer.getActiveRequestCount(), 0);
});
