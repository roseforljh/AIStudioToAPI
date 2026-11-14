const assert = require("node:assert/strict");
const test = require("node:test");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const BrowserManager = require("../src/core/BrowserManager");
const Policy = require("../src/core/AccountRoutingPolicy");
const RequestHandler = require("../src/core/RequestHandler");
const logger = { debug() {}, error() {}, info() {}, warn() {} };
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(t, indices = [0, 1, 2, 3, 4, 5]) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pool-retirement-"));
    t.after(() => fs.rmSync(directory, { force: true, recursive: true }));
    const policy = Object.create(Policy.prototype);
    Object.assign(policy, {
        groupEvidence: {},
        modelEvidence: {},
        path: path.join(directory, "policy.json"),
        rotation: [],
        scanner: { fingerprint: i => String(i), get: i => ({ state: i >= 10 ? "ready-paid" : "ready-free" }) },
        settings: { normalActive: 1, normalStandby: 1, paidActive: 0, paidStandby: 0 },
    });
    const manager = new BrowserManager(
        logger,
        { accountLoadBalancing: true, maxContexts: 2 },
        {
            getCanonicalIndex: i => i,
            getRotationIndices: () => indices,
        }
    );
    manager.accountRoutingPolicy = policy;
    const connections = new Map();
    const busy = new Set();
    const closed = [];
    const registry = Object.assign(new EventEmitter(), {
        closeConnectionByAuth: i => connections.delete(i),
        closeMessageQueuesForAuth: i => busy.delete(i),
        getAllConnections: () => connections,
        getConnectionByAuth: i => connections.get(i),
        hasMessageQueueForAuth: i => busy.has(i),
    });
    manager.setConnectionRegistry(registry);
    const connect = index => {
        connections.set(index, { readyState: 1 });
        manager.contexts.set(index, {
            context: {
                close: async () => {
                    closed.push(index);
                    connections.delete(index);
                },
            },
            page: {},
        });
        manager._contextLifecycle.set(index, { createdAt: 1, lastUsedAt: 1 });
        manager._wsInitState.set(index, { success: true });
        manager.connectionRegistry.emit("contextReady", index);
    };
    manager._preloadBackgroundContexts = async candidates => {
        for (const index of candidates) {
            if (manager.contexts.size >= manager.config.maxContexts) break;
            connect(index);
        }
    };
    // Drive rebalances explicitly rather than relying on wall-clock timer delays.
    manager._scheduleDeprioritizeRebuild = () => {};
    connect(0);
    connect(1);
    return { busy, closed, connect, connections, manager, policy, registry };
}

test("failed active retires, standby promotes, and subsequent failures traverse the full inventory", async t => {
    const { manager: b, policy, closed } = fixture(t);
    assert.deepEqual(b.getActiveCallableIndices(), [0]);
    for (const [failed, active, standby] of [
        [0, 1, 2],
        [1, 2, 3],
        [2, 3, 4],
        [3, 4, 5],
        [4, 5, 0],
    ]) {
        b.deprioritizeAccount(failed, 30000);
        assert.deepEqual(b.getActiveCallableIndices(), [active]);
        await b.rebalanceContextPool();
        assert.equal(b.contexts.has(failed), false);
        assert.deepEqual([...b.contexts.keys()], [active, standby]);
        assert.equal(b._contextLifecycle.has(failed), false);
        assert.equal(b._wsInitState.has(failed), false);
        b._deprioritizedUntil.set(failed, Date.now() - 1);
        assert.deepEqual(b.getActiveCallableIndices(), [active]);
        await b.rebalanceContextPool();
        assert.deepEqual([...b.contexts.keys()], [active, standby], "recovery must not evict healthy replacements");
    }
    assert.deepEqual(closed, [0, 1, 2, 3, 4]);
    const saved = JSON.parse(fs.readFileSync(policy.path));
    assert.deepEqual(saved.rotation, [5, 0, 1, 2, 3, 4]);
    const restored = Object.create(Policy.prototype);
    Object.assign(restored, policy, { rotation: saved.rotation });
    assert.deepEqual(restored.targets([0, 1, 2, 3, 4, 5]), [5, 0]);
});

test("retiring busy current cannot become callable when cooldown expires and closes on queue drain", async t => {
    const { manager: b, busy, registry } = fixture(t);
    b._currentAuthIndex = 0;
    busy.add(0);
    b.deprioritizeAccount(0, 30000);
    await b.rebalanceContextPool();
    assert.ok(b.pendingContextClosures.has(0));
    b._deprioritizedUntil.set(0, Date.now() - 1);
    assert.equal(b._isAccountUnavailable(0), true);
    assert.deepEqual(b.getActiveCallableIndices(), [1]);
    busy.delete(0);
    registry.emit("authQueuesDrained", 0);
    await tick();
    await b.rebalanceContextPool();
    assert.deepEqual([...b.contexts.keys()], [1, 2]);
    assert.equal(b._currentAuthIndex, -1);
});

test("retirement preserves separate group quotas and admission order after reconnect", async t => {
    const { manager: b, policy, connect } = fixture(t, [0, 1, 2, 10, 11, 12]);
    policy.settings = { normalActive: 1, normalStandby: 1, paidActive: 1, paidStandby: 1 };
    b.config.maxContexts = 4;
    connect(10);
    connect(11);
    b.deprioritizeAccount(0, 30000);
    await b.rebalanceContextPool();
    assert.deepEqual(b.getActiveCallableIndices(), [10, 1]);
    b._deprioritizedUntil.set(0, Date.now() - 1);
    // The old socket appearing first must not grant a fresh active slot.
    assert.deepEqual(b.selectActiveAuthIndices([0, 2, 11, 1, 10]), [10, 1]);
    assert.deepEqual(new Set(b.contexts.keys()), new Set([1, 2, 10, 11]));
});

test("real request handler connects lease cooldown and timeout retirement to context cleanup", async t => {
    const { manager: b, registry } = fixture(t);
    const cwd = process.cwd();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "retirement-handler-"));
    let handler;
    try {
        process.chdir(directory);
        handler = new RequestHandler(
            { accountRoutingPolicy: b.accountRoutingPolicy },
            registry,
            logger,
            b,
            { accountLoadBalancing: true },
            {}
        );
    } finally {
        process.chdir(cwd);
        fs.rmSync(directory, { force: true, recursive: true });
    }
    const lease = await handler.accountLoadBalancer.acquire();
    await lease.move({ exclude: new Set([0]), failFast: true, release: { status: 429 } });
    assert.equal(lease.authIndex, 1);
    assert.equal(b.isAccountDeprioritized(0), true);
    await b.rebalanceContextPool();
    assert.deepEqual([...b.contexts.keys()], [1, 2]);
    lease.release();
    handler.accountLoadBalancer.markCooldown(1, 504, 15000);
    await b.rebalanceContextPool();
    assert.deepEqual([...b.contexts.keys()], [2, 3]);
    assert.equal(handler.accountLoadBalancer.getActiveRequestCount(), 0);
});

test("failed background initialization advances past the failed candidate without deleting auth", async t => {
    const { manager: b, policy } = fixture(t);
    b._initializeContextWithHealth = async () => {
        throw new Error("Timeout");
    };
    await assert.rejects(b._initializeContext(2, true));
    assert.equal(b.isAccountDeprioritized(2), true);
    assert.equal(b.accountHealth.get(2).deletable, false);
    assert.deepEqual(policy.order([0, 1, 2, 3, 4, 5]), [0, 1, 3, 4, 5, 2]);
});

test("single-slot retry drains the cancelled queue before waiting for a replacement", async t => {
    const { manager: b, connections } = fixture(t);
    const ConnectionRegistry = require("../src/core/ConnectionRegistry");
    const registry = new ConnectionRegistry(logger, null, null, b);
    registry.connectionsByAuth = connections;
    b.setConnectionRegistry(registry);
    await b.closeContext(1);
    b.config.maxContexts = 1;
    b.accountRoutingPolicy.settings.normalStandby = 0;
    // Use the real scheduling path: only a drained queue can release this one slot.
    b._scheduleDeprioritizeRebuild = BrowserManager.prototype._scheduleDeprioritizeRebuild.bind(b);
    t.after(() => clearTimeout(b._deprioritizeRebuildTimer));
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "single-slot-retirement-"));
    const cwd = process.cwd();
    let handler;
    try {
        process.chdir(directory);
        handler = new RequestHandler(
            { accountRoutingPolicy: b.accountRoutingPolicy },
            registry,
            logger,
            b,
            { accountAcquireTimeoutMs: 300, accountLoadBalancing: true },
            {}
        );
    } finally {
        process.chdir(cwd);
        fs.rmSync(directory, { force: true, recursive: true });
    }
    const lease = await handler.accountLoadBalancer.acquire();
    registry.createMessageQueue("single-slot", 0, "attempt-1");
    const unrelated = registry.createMessageQueue("other-account", 99, "other-attempt");
    await handler.accountRequestContext.run({ lease }, async () => {
        assert.equal(await handler._moveCurrentAccountLease({ status: 504 }, new Set(), "single-slot"), true);
    });
    assert.equal(lease.authIndex, 1);
    assert.equal(registry.hasMessageQueueForAuth(0), false);
    assert.equal(registry.messageQueues.get("other-account").queue, unrelated);
    assert.deepEqual([...b.contexts.keys()], [1]);
    lease.release();
    registry.removeMessageQueue("other-account");
});

test("routing-state write failure cannot prevent resource retirement or backfill", async t => {
    const { manager: b, policy } = fixture(t);
    policy.persist = () => {
        throw new Error("disk unavailable");
    };
    b.deprioritizeAccount(0, 30000);
    assert.ok(b.pendingContextClosures.has(0));
    await b.rebalanceContextPool();
    assert.deepEqual([...b.contexts.keys()], [1, 2]);
});

test("closing a retired disconnected context also clears outstanding reconnect timers", async t => {
    const { manager: b } = fixture(t);
    const ConnectionRegistry = require("../src/core/ConnectionRegistry");
    const registry = new ConnectionRegistry(logger, null, null, b);
    b.setConnectionRegistry(registry);
    const grace = setTimeout(() => assert.fail("retired account reconnect"), 1000);
    const reconnect = setTimeout(() => assert.fail("retired account reconnect timeout"), 1000);
    t.after(() => {
        clearTimeout(grace);
        clearTimeout(reconnect);
    });
    let cancelled = false;
    registry.reconnectGraceTimers.set(0, grace);
    registry.reconnectingAccounts.set(0, true);
    registry.lightweightReconnectTimeouts.set(0, {
        timeoutId: reconnect,
        timeoutReject: () => {
            cancelled = true;
        },
    });
    await b.closeContext(0);
    assert.equal(registry.reconnectGraceTimers.has(0), false);
    assert.equal(registry.reconnectingAccounts.has(0), false);
    assert.equal(registry.lightweightReconnectTimeouts.has(0), false);
    assert.equal(cancelled, true);
});

test("403-model refusals in a recovered warm window cannot starve untried cold accounts", async t => {
    const { manager: b, policy, busy } = fixture(t);
    policy.noteDenied(0, "hydrogen");
    policy.noteDenied(1, "hydrogen");
    busy.add(1);
    const clear = b.prioritizeRetryCandidates("waiting-request", i => !policy.blocked(i, "hydrogen"));
    await b.rebalanceContextPool();
    assert.equal(b.contexts.has(0), false);
    assert.equal(b.contexts.has(1), true, "another request's busy context must not be closed");
    assert.equal(b.contexts.has(2), true, "untried cold account fills the freed slot");
    assert.deepEqual(b.selectActiveAuthIndices([1, 2].filter(i => !policy.blocked(i, "hydrogen"))), [2]);
    clear();
    assert.equal(b._retryCandidates.size, 0);
});

test("retry candidate promotion preserves paid/free quotas and concurrent waiter cleanup", async t => {
    const { manager: b, policy, connect } = fixture(t, [0, 1, 2, 3, 10, 11, 12, 13]);
    policy.settings = { normalActive: 1, normalStandby: 1, paidActive: 1, paidStandby: 1 };
    b.config.maxContexts = 4;
    connect(10);
    connect(11);
    const clearNormal = b.prioritizeRetryCandidates("normal-waiter", i => i === 2 || i === 3);
    const clearPaid = b.prioritizeRetryCandidates("paid-waiter", i => i === 12 || i === 13);
    await b.rebalanceContextPool();
    assert.deepEqual(new Set(b.contexts.keys()), new Set([2, 3, 12, 13]));
    assert.deepEqual(b.getActiveCallableIndices(), [12, 2]);
    clearNormal();
    assert.equal(b._retryCandidates.size, 1);
    assert.ok(b._retryCandidates.has("paid-waiter"));
    clearPaid();
    assert.equal(b._retryCandidates.size, 0);
});

test("403 single-slot backfill waits for a cold account and clears retry preference", async t => {
    const { manager: b, connections, policy } = fixture(t);
    const Registry = require("../src/core/ConnectionRegistry");
    const registry = new Registry(logger, null, null, b);
    registry.connectionsByAuth = connections;
    b.setConnectionRegistry(registry);
    await b.closeContext(1);
    b.config.maxContexts = 1;
    policy.settings.normalStandby = 0;
    b._scheduleDeprioritizeRebuild = BrowserManager.prototype._scheduleDeprioritizeRebuild.bind(b);
    t.after(() => clearTimeout(b._deprioritizeRebuildTimer));
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cold-403-retry-"));
    const cwd = process.cwd();
    let h;
    try {
        process.chdir(directory);
        h = new RequestHandler(
            { accountRoutingPolicy: policy },
            registry,
            logger,
            b,
            { accountLoadBalancing: true, maxRetries: 1 },
            b.authSource
        );
    } finally {
        process.chdir(cwd);
        fs.rmSync(directory, { force: true, recursive: true });
    }
    const lease = await h.accountLoadBalancer.acquire();
    registry.createMessageQueue("cold-403", 0, "attempt-1");
    await h.accountRequestContext.run({ lease, model: "hydrogen" }, async () => {
        const tracker = h._createImmediateSwitchTracker(0);
        tracker.deadline = Date.now() + 1000;
        assert.equal(await h._prepareImmediateStatusRetry({ status: 403 }, "cold-403", tracker, 0), true);
    });
    assert.equal(lease.authIndex, 1);
    assert.equal(policy.blocked(0, "hydrogen"), true);
    assert.equal(b._retryCandidates.size, 0);
    lease.release();
});
