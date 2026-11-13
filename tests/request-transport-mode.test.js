const assert = require("node:assert/strict");
const test = require("node:test");
const RequestHandler = require("../src/core/RequestHandler");

for (const [method, translator] of [
    ["processOpenAIRequest", "translateOpenAIToGoogle"],
    ["processOpenAIResponseRequest", "translateOpenAIResponseToGoogle"],
    ["processClaudeRequest", "translateClaudeToGoogle"],
]) {
    for (const [modelStreamingMode, expectedEndpoint, expectedMode] of [
        [null, "streamGenerateContent", "real"],
        ["real", "streamGenerateContent", "real"],
        ["fake", "generateContent", "fake"],
    ]) {
        test(`${method}: resolves streaming transport (${modelStreamingMode || "default"})`, async () => {
            const sentinel = new Error("request captured");
            let captured;
            const handler = {
                _ensureBrowserBackedRequestReady: async () => true,
                _finalizeTrackedRequest() {},
                _generateRequestId: () => "transport-test",
                _initializeProxyRequestAttempt(request) {
                    captured = request;
                    throw sentinel;
                },
                _setResponseApiFormat() {},
                _startTrackedRequest() {},
                config: { accountLoadBalancing: true, streamingMode: "real" },
                formatConverter: {
                    [translator]: async () => ({
                        cleanModelName: "gemini-4-hydrogen",
                        googleRequest: { contents: [{ parts: [{ text: "Hi" }], role: "user" }] },
                        modelStreamingMode,
                    }),
                },
                logger: { debug() {}, error() {}, info() {} },
            };
            await assert.rejects(
                RequestHandler.prototype[method].call(handler, { body: { stream: true }, path: "/test" }, {}),
                error => error === sentinel
            );
            assert.equal(captured.path, `/v1beta/models/gemini-4-hydrogen:${expectedEndpoint}`);
            assert.equal(captured.streaming_mode, expectedMode);
            assert.deepEqual(captured.query_params, expectedMode === "real" ? { alt: "sse" } : {});
        });
    }
}

test("native Gemini generation preserves real streaming unless fake is requested", () => {
    const createHandler = streamingMode => ({
        config: { streamingMode },
        formatConverter: {
            ensureServerSideToolInvocations() {},
            ensureThoughtSignature() {},
            getDefaultSafetySettings: () => [],
            sanitizeGeminiTools() {},
        },
        logger: { debug() {}, info() {} },
    });
    const realReq = RequestHandler.prototype._buildProxyRequest.call(
        createHandler("real"),
        {
            body: { contents: [{ parts: [{ text: "Hi" }], role: "user" }] },
            headers: {},
            method: "POST",
            path: "/v1beta/models/gemini-4-hydrogen:streamGenerateContent",
            query: { alt: "sse" },
        },
        "native-real"
    );
    assert.equal(realReq.streaming_mode, "real");

    const fakeReq = RequestHandler.prototype._buildProxyRequest.call(
        createHandler("fake"),
        {
            body: { contents: [{ parts: [{ text: "Hi" }], role: "user" }] },
            headers: {},
            method: "POST",
            path: "/v1beta/models/gemini-4-hydrogen:streamGenerateContent",
            query: { alt: "sse" },
        },
        "native-fake"
    );
    assert.equal(fakeReq.streaming_mode, "fake");
});
