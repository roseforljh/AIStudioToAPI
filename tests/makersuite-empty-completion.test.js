const { test } = require("node:test");
const assert = require("node:assert/strict");
const { merge, wrapResponse } = require("../src/core/MakerSuiteCodec");
const RequestHandler = require("../src/core/RequestHandler");

const chunk = (parts, finishReason) => ({
    candidates: [{ content: { parts, role: "model" }, ...(finishReason ? { finishReason } : {}) }],
});
const envelope = parts => JSON.stringify([[[[[parts, "model"], 1]], null, [1, 1, 2]]]);

test("an empty completion is surfaced instead of reported as success", () => {
    for (const parts of [[], [{ text: "" }], [{ text: "", thought: false }]]) {
        assert.throws(
            () => merge([chunk(parts, "STOP")]),
            error => error.status === 503 && /empty completion \(finishReason=STOP\)/.test(error.message)
        );
    }
    assert.throws(() => wrapResponse(envelope([]), false), error => error.status === 503);
});

test("text, thinking, tool calls and images still count as content", () => {
    const cases = [
        [{ text: "answer" }],
        [{ text: "reasoning", thought: true }],
        [{ functionCall: { args: {}, name: "lookup" } }],
        [{ inlineData: { data: "AA==", mimeType: "image/png" } }],
        [{ text: "" }, { functionCall: { args: { path: "a" }, name: "read" } }],
    ];
    for (const parts of cases) assert.equal(merge([chunk(parts, "STOP")]).candidates[0].finishReason, "STOP");
});

test("buffered MakerSuite requests wait for the generation budget, not the 45s first-response window", async () => {
    const wait = async streamingMode => {
        let recorded;
        const handler = {
            accountLoadBalancer: { markCooldown() {} },
            accountRequestContext: { getLease: () => null },
            config: { accountLoadBalancing: true, maxRetries: 1 },
            connectionRegistry: { getAuthIndexForRequest: () => 0 },
            logger: { debug() {}, info() {}, warn() {}, error() {} },
            timeouts: { FAKE_STREAM: 300000 },
            _applyFileReferenceInlining: () => ({ ok: true }),
            _cancelCurrentAttemptBeforeRetry() {},
            _createImmediateSwitchTracker: () => ({ attemptedAuthIndices: new Set() }),
            _forwardRequest() {},
            _getRequestAttemptLimit: () => 1,
            _getUsageStatsService: () => null,
            _isConnectionResetError: () => false,
            _loadBalancerTimeouts: () => ({ initial: 45000, total: 120000 }),
            _prepareTransient404Retry: async () => false,
            _shouldRetryUpstreamStatus: () => false,
            _waitForSystemAndConnectionIfBusy: async () => true,
            serverSystem: { accountRoutingPolicy: null },
        };
        const queue = {
            dequeue: async timeout => {
                recorded = timeout;
                return { event_type: "timeout" };
            },
        };
        await RequestHandler.prototype._executeRequestWithRetries.call(
            handler,
            { request_id: "budget-test", streaming_mode: streamingMode },
            queue
        );
        return recorded;
    };
    assert.equal(await wait("fake"), 300000);
    assert.equal(await wait("real"), 45000);
});
