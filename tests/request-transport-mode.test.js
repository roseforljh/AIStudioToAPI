const assert = require('node:assert/strict');
const test = require('node:test');
const RequestHandler = require('../src/core/RequestHandler');

for (const [method, translator] of [
    ['processOpenAIRequest', 'translateOpenAIToGoogle'],
    ['processOpenAIResponseRequest', 'translateOpenAIResponseToGoogle'],
    ['processClaudeRequest', 'translateClaudeToGoogle'],
]) {
    for (const modelStreamingMode of [null, 'real', 'fake']) {
        test(`${method}: MakerSuite uses unary upstream while retaining client streaming (${modelStreamingMode})`, async () => {
            const sentinel = new Error('request captured');
            let captured;
            const handler = {
                config: { accountLoadBalancing: true, streamingMode: 'real' },
                logger: { info() {}, error() {}, debug() {} },
                _generateRequestId: () => 'transport-test',
                _startTrackedRequest() {}, _setResponseApiFormat() {}, _finalizeTrackedRequest() {},
                _ensureBrowserBackedRequestReady: async () => true,
                formatConverter: { [translator]: async () => ({
                    cleanModelName: 'gemini-4-hydrogen', modelStreamingMode,
                    googleRequest: { contents: [{ role: 'user', parts: [{ text: 'Hi' }] }] },
                }) },
                _initializeProxyRequestAttempt(request) { captured = request; throw sentinel; },
            };
            await assert.rejects(
                RequestHandler.prototype[method].call(handler, { body: { stream: true }, path: '/test' }, {}),
                error => error === sentinel
            );
            assert.equal(captured.path, '/v1beta/models/gemini-4-hydrogen:generateContent');
            assert.equal(captured.streaming_mode, 'fake');
            assert.deepEqual(captured.query_params, {});
        });
    }
}

test('native Gemini generation resolves the same buffered transport policy', () => {
    const handler = {
        config: { streamingMode: 'real' },
        logger: { info() {}, debug() {} },
        formatConverter: {
            sanitizeGeminiTools() {}, ensureServerSideToolInvocations() {}, ensureThoughtSignature() {},
            getDefaultSafetySettings: () => [],
        },
    };
    const request = RequestHandler.prototype._buildProxyRequest.call(handler, {
        method: 'POST', path: '/v1beta/models/gemini-4-hydrogen:streamGenerateContent',
        query: { alt: 'sse' }, headers: {}, body: { contents: [{ role: 'user', parts: [{ text: 'Hi' }] }] },
    }, 'native-test');
    assert.equal(request.streaming_mode, 'fake');
});
