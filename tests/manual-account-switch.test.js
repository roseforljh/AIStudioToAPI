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
