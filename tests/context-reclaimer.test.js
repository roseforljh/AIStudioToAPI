const { test } = require("node:test");
const assert = require("node:assert/strict");
const ContextReclaimer = require("../src/core/ContextReclaimer");

test("does not reclaim while requests are active", async () => {
    let calls = 0;
    const reclaimer = new ContextReclaimer({
        browserManager: {
            findIdleContextForReclaim: () => {
                calls++;
                return 2;
            },
            getProcessMemoryMb: () => 9000,
            initializingContexts: new Set(),
            isClosingIntentionally: false,
        },
        config: { contextReclaimerEnabled: true, contextReclaimerIdleMs: 1, contextReclaimerMemoryMb: 100 },
        getActiveRequestCount: () => 1,
        logger: { info() {}, warn() {} },
    });
    assert.equal(await reclaimer.runOnce(), false);
    assert.equal(calls, 0);
});

test("reclaims one idle context only after all safety gates pass", async () => {
    let reclaimed = null;
    const reclaimer = new ContextReclaimer({
        browserManager: {
            findIdleContextForReclaim: () => 2,
            getProcessMemoryMb: () => 9000,
            initializingContexts: new Set(),
            isClosingIntentionally: false,
            reclaimContext: async (index, reason) => {
                reclaimed = [index, reason];
            },
        },
        config: { contextReclaimerEnabled: true, contextReclaimerIdleMs: 1, contextReclaimerMemoryMb: 100 },
        getActiveRequestCount: () => 0,
        logger: { info() {}, warn() {} },
    });
    assert.equal(await reclaimer.runOnce(), true);
    assert.deepEqual(reclaimed, [2, "memory_budget"]);
});

test("does nothing when memory metrics are unavailable", async () => {
    const reclaimer = new ContextReclaimer({
        browserManager: {
            findIdleContextForReclaim: () => {
                throw new Error("must not select");
            },
            getProcessMemoryMb: () => null,
            initializingContexts: new Set(),
            isClosingIntentionally: false,
        },
        config: { contextReclaimerEnabled: true, contextReclaimerIdleMs: 1, contextReclaimerMemoryMb: 100 },
        getActiveRequestCount: () => 0,
        logger: { info() {}, warn() {} },
    });
    assert.equal(await reclaimer.runOnce(), false);
});

test("does nothing below memory threshold", async () => {
    const reclaimer = new ContextReclaimer({
        browserManager: {
            findIdleContextForReclaim: () => {
                throw new Error("must not select");
            },
            getProcessMemoryMb: () => 99,
            initializingContexts: new Set(),
            isClosingIntentionally: false,
        },
        config: { contextReclaimerEnabled: true, contextReclaimerIdleMs: 1, contextReclaimerMemoryMb: 100 },
        getActiveRequestCount: () => 0,
        logger: { info() {}, warn() {} },
    });
    assert.equal(await reclaimer.runOnce(), false);
});
