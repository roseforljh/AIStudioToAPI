const assert = require("node:assert/strict");
const test = require("node:test");
const BrowserManager = require("../src/core/BrowserManager");
const AuthSwitcher = require("../src/auth/AuthSwitcher");
const Policy = require("../src/core/AccountRoutingPolicy");
const Balancer = require("../src/core/AccountLoadBalancer");
const logger = { debug() {}, error() {}, info() {}, warn() {} };

function fixture() {
    const b = new BrowserManager(
        logger,
        { accountLoadBalancing: true, maxContexts: 2 },
        {
            availableIndices: [0, 1, 2],
            getRotationIndices: () => [0, 1, 2],
        }
    );
    const policy = Object.create(Policy.prototype);
    Object.assign(policy, {
        persist() {},
        rotation: [],
        scanner: { get: () => ({ state: "ready-free" }) },
        settings: { normalActive: 1, normalStandby: 1, paidActive: 0, paidStandby: 0 },
    });
    b.accountRoutingPolicy = policy;
    b._currentAuthIndex = 0;
    b.contexts.set(0, {});
    b.contexts.set(1, {});
    const events = [];
    b.abortBackgroundPreload = async () => events.push("abort");
    b._updateAuthFile = async i => events.push(`save:${i}`);
    b.closeContext = async i => {
        events.push(`close:${i}`);
        b.contexts.delete(i);
        b._currentAuthIndex = -1;
    };
    b.preCleanupForSwitch = async () => {
        events.push("cleanup");
        assert.ok(b.contexts.size < 2);
    };
    b.launchOrSwitchContext = async i => {
        events.push(`open:${i}`);
        b.contexts.set(i, {});
        b._currentAuthIndex = i;
    };
    b.connectionRegistry = {
        getAllConnections: () => new Map([...b.contexts.keys()].map(i => [i, { readyState: 1 }])),
    };
    b.contextMaintenance = new Balancer({
        getEligibleAuthIndices: () => b.selectActiveAuthIndices([...b.contexts.keys()]),
    });
    return { b, events, policy };
}

test("manual switch closes old account before activation and persists selected account ahead of standby", async () => {
    const { b, policy, events } = fixture();
    b._deprioritizedUntil.set(2, Date.now() + 60000);
    b.contextMaintenance.markCooldown(2, 60000);
    let release;
    b._poolRebalanceTask = new Promise(resolve => {
        release = resolve;
    });
    const switching = b.switchAccount(2, { replaceCurrent: true });
    assert.deepEqual(b.selectActiveAuthIndices([0, 1]), [], "no new leases during replacement");
    assert.deepEqual(events, [], "wait for an in-progress rebalance before closing contexts");
    release();
    await switching;
    assert.deepEqual(events, ["abort", "save:0", "close:0", "cleanup", "open:2"]);
    assert.equal(b.currentAuthIndex, 2);
    assert.equal(b.contexts.has(0), false);
    assert.deepEqual(policy.choose([1, 2]), [2]);
    assert.equal(b.isAccountDeprioritized(2), false);
    assert.equal(b.contextMaintenance.isCoolingDown(2), false);
    assert.deepEqual(policy.targets([0, 1, 2]), [2, 1], "rebalance must not reopen the old current");
    assert.equal(b._manualSwitchInProgress, false);
});

test("a failed manual switch restores the old current and releases the admission gate", async () => {
    const { b, policy, events } = fixture();
    b.launchOrSwitchContext = async i => {
        events.push(`open:${i}`);
        if (i === 2) throw new Error("target expired");
        b.contexts.set(i, {});
        b._currentAuthIndex = i;
    };
    await assert.rejects(b.switchAccount(2, { replaceCurrent: true }), /target expired/);
    assert.equal(b.currentAuthIndex, 0);
    assert.equal(b.contexts.has(0), true);
    assert.deepEqual(policy.rotation, []);
    assert.equal(b._manualSwitchInProgress, false);
});

test("automatic switch keeps existing context behavior", async () => {
    const { b, events } = fixture();
    await b.switchAccount(1);
    assert.deepEqual(events, ["open:1"]);
    assert.equal(b.contexts.has(0), true);
});

test("manual promotion preserves VIP and standard pool quotas", () => {
    const { policy } = fixture();
    policy.scanner = { get: i => ({ state: i < 10 ? "ready-free" : "ready-paid" }) };
    policy.settings = { normalActive: 1, normalStandby: 1, paidActive: 1, paidStandby: 1 };
    policy.promote(12, 0, [0, 1, 2, 10, 11, 12]);
    assert.deepEqual(policy.choose([0, 1, 2, 10, 11, 12]), [12, 1]);
    assert.deepEqual(policy.targets([0, 1, 2, 10, 11, 12]), [12, 10, 1, 2]);
});

test("manual account API path delegates replacement once and resets its busy flag", async () => {
    const calls = [];
    const b = {
        currentAuthIndex: 0,
        rebalanceContextPool: async () => {},
        switchAccount: async (...args) => calls.push(args),
    };
    const auth = new AuthSwitcher(logger, {}, { availableIndices: [0, 1] }, b);
    assert.equal((await auth.switchToSpecificAuth(99)).success, false);
    assert.deepEqual(calls, []);
    assert.deepEqual(await auth.switchToSpecificAuth(1), { newIndex: 1, success: true });
    assert.deepEqual(calls, [[1, { replaceCurrent: true }]]);
    assert.equal(auth.isSystemBusy, false);
});

test("manual pool switch replaces the first active slot in its own group, not the legacy pointer", async () => {
    const { b, policy, events } = fixture();
    b.config.maxContexts = 6;
    b.contexts = new Map([0, 1, 2, 10, 11, 12].map(i => [i, {}]));
    b._currentAuthIndex = 11;
    b.authSource.getRotationIndices = () => [0, 1, 2, 10, 11, 12];
    policy.settings = { normalActive: 2, normalStandby: 1, paidActive: 2, paidStandby: 1 };
    policy.scanner = { get: i => ({ state: i >= 10 ? "ready-paid" : "ready-free" }) };
    b.preCleanupForSwitch = async () => events.push("cleanup");
    let release;
    b._poolRebalanceTask = new Promise(resolve => {
        release = resolve;
    });
    const switching = b.switchAccount(2, { replaceCurrent: true });
    assert.deepEqual(
        b.getActiveCallableIndices().sort((a, c) => a - c),
        [1, 10, 11],
        "other slots remain callable"
    );
    assert.deepEqual(b.selectActiveAuthIndices([1, 12]), [1], "allowed filters cannot admit a standby mid-switch");
    release();
    await switching;
    assert.deepEqual(events, ["abort", "save:0", "close:0", "cleanup", "open:2"]);
    assert.deepEqual(
        b.getActiveCallableIndices().sort((a, c) => a - c),
        [1, 2, 10, 11]
    );
    assert.equal(b.contexts.has(0), false);
    assert.equal(b.contexts.has(11), true, "legacy pointer is not the replacement slot");
    assert.equal(b.currentAuthIndex, 2);
    assert.deepEqual(policy.settings, { normalActive: 2, normalStandby: 1, paidActive: 2, paidStandby: 1 });
});

test("selecting an already active pool account never evicts another active account", async () => {
    const { b, events, policy } = fixture();
    policy.settings.normalActive = 2;
    await b.switchAccount(1, { replaceCurrent: true });
    assert.deepEqual(events, []);
    assert.deepEqual(b.getActiveCallableIndices(), [0, 1]);
});

test("failed slot replacement restores pool capacity without touching other active slots", async () => {
    const { b, policy } = fixture();
    b.contexts.set(3, {});
    b.authSource.getRotationIndices = () => [0, 1, 2, 3];
    policy.settings.normalActive = 2;
    b.preCleanupForSwitch = async () => {};
    b.launchOrSwitchContext = async i => {
        if (i === 2) throw new Error("expired");
        b.contexts.set(i, {});
        b._currentAuthIndex = i;
    };
    await assert.rejects(b.switchAccount(2, { replaceCurrent: true }), /expired/);
    assert.deepEqual(b.getActiveCallableIndices(), [0, 1]);
    assert.equal(b.contexts.has(1), true);
});

test("other healthy pool slots bypass the single-account readiness gate during replacement", async () => {
    const RequestHandler = require("../src/core/RequestHandler");
    let activity = 0;
    const handler = {
        browserManager: {
            _manualSwitchInProgress: true,
            getActiveCallableIndices: () => [1, 2],
            notifyUserActivity: () => activity++,
        },
        config: { accountLoadBalancing: true },
        connectionRegistry: {
            getConnectionByAuth: () => {
                throw new Error("must not use the closed legacy pointer");
            },
        },
    };
    assert.equal(await RequestHandler.prototype._ensureBrowserBackedRequestReady.call(handler, {}), true);
    assert.equal(activity, 1);
});

test("multiple unaffected accounts keep accepting load-balanced requests while a slot is replaced", async () => {
    const { b, policy } = fixture();
    b.config.maxContexts = 5;
    b.contexts = new Map([0, 1, 2, 3, 4].map(i => [i, {}]));
    b.authSource.getRotationIndices = () => [0, 1, 2, 3, 4, 5];
    policy.settings.normalActive = 3;
    b.preCleanupForSwitch = async () => {};
    b.contextMaintenance.maxConcurrentRequests = n => n;
    let release;
    b._poolRebalanceTask = new Promise(resolve => {
        release = resolve;
    });
    const switching = b.switchAccount(5, { replaceCurrent: true });
    try {
        const first = await b.contextMaintenance.acquire();
        const second = await b.contextMaintenance.acquire();
        assert.deepEqual(
            [first.authIndex, second.authIndex].sort((a, c) => a - c),
            [1, 2]
        );
        first.release();
        second.release();
    } finally {
        release();
        await switching;
    }
    assert.deepEqual(
        b.getActiveCallableIndices().sort((a, c) => a - c),
        [1, 2, 5]
    );
});

test("single-account mode still replaces the legacy current account", async () => {
    const { b, events } = fixture();
    b.config.accountLoadBalancing = false;
    await b.switchAccount(2, { replaceCurrent: true });
    assert.deepEqual(events, ["abort", "save:0", "close:0", "cleanup", "open:2"]);
    assert.equal(b.contexts.has(0), false);
    assert.equal(b.currentAuthIndex, 2);
});
