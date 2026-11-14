const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const RequestHandler = require("../src/core/RequestHandler");
const AccountRequestContext = require("../src/core/AccountRequestContext");
const logger = { debug() {}, error() {}, info() {}, warn() {} };

function handler() {
    const h = Object.create(RequestHandler.prototype);
    const cooldowns = [],
        denied = [];
    Object.assign(h, {
        accountLoadBalancer: {
            cooldownByStatus: new Map([
                [403, 30000],
                [429, 60000],
                [503, 30000],
            ]),
            getEligibleAuthIndices: () => [0, 1, 2],
            markCooldown: (...args) => cooldowns.push(args),
        },
        accountRequestContext: new AccountRequestContext(),
        authSwitcher: { currentAuthIndex: 0 },
        config: { accountLoadBalancing: true, immediateSwitchStatusCodes: [429, 503], maxRetries: 3 },
        logger,
        serverSystem: {
            accountRoutingPolicy: {
                blocked: () => false,
                group: () => "normal",
                groupDenied: () => false,
                noteDenied: (...args) => denied.push(args),
            },
        },
    });
    return { cooldowns, denied, h };
}

test("retry selection covers 403/502 but not validation, auth, cancellation or arbitrary 500", () => {
    const { h } = handler();
    for (const status of [403, 429, 502, 503, 504]) assert.equal(h._shouldRetryUpstreamStatus(status), true);
    for (const status of [400, 401, 422, 499, 500]) assert.equal(h._shouldRetryUpstreamStatus(status), false);
});

test("account/model denial is remembered without declaring an entire group unsupported", async () => {
    const { h, cooldowns, denied } = handler();
    await h.accountRequestContext.run({ lease: { authIndex: 2 }, model: "gemini-4-hydrogen" }, async () => {
        await h._handleRequestFailure({ message: "upstream rejected", status: 403 });
    });
    assert.deepEqual(denied, [[2, "gemini-4-hydrogen"]]);
    assert.deepEqual(cooldowns, [[2, 403, 30000]]);
});

test("retry budget covers the full inventory, not only the active six or a hard cap of thirty", () => {
    const { h } = handler();
    h.authSource = { getRotationIndices: () => Array.from({ length: 46 }, (_, i) => i) };
    assert.equal(h._getRequestAttemptLimit(), 46);
});

test("retry traversal does not stop at the initial warm window", async () => {
    const { h } = handler();
    h.authSource = { getRotationIndices: () => Array.from({ length: 8 }, (_, i) => i) };
    const tracker = h._createImmediateSwitchTracker(0);
    let moves = 0;
    h._performImmediateSwitchRetry = async () => {
        moves++;
        tracker.attemptedAuthIndices.add(moves);
        return true;
    };
    await h.accountRequestContext.run({ lease: { authIndex: 0 } }, async () => {
        for (let i = 0; i < 7; i++)
            assert.equal(await h._prepareImmediateStatusRetry({ status: 502 }, "req", tracker, 0), true);
        assert.equal(await h._prepareImmediateStatusRetry({ status: 502 }, "req", tracker, 0), false);
    });
    assert.equal(moves, 7);
});

test("expired retry budget and pinned requests do not switch, and last account still retires", async () => {
    const { h, cooldowns } = handler();
    let moves = 0;
    h._performImmediateSwitchRetry = async () => {
        moves++;
        return true;
    };
    await h.accountRequestContext.run({ lease: { authIndex: 0 } }, async () => {
        const tracker = h._createImmediateSwitchTracker(0);
        tracker.deadline = Date.now() - 1;
        assert.equal(await h._prepareImmediateStatusRetry({ status: 502 }, "req", tracker, 0), false);
    });
    assert.equal(moves, 0);
    assert.deepEqual(cooldowns, [[0, 502, 15000]]);
});

for (const [name, method] of [
    ["OpenAI", "_streamOpenAIResponse"],
    ["Claude", "_streamClaudeResponse"],
    ["Responses", "_streamOpenAIResponseAPIResponse"],
]) {
    test(`${name}: a late 503 keeps status and retires the account without replay or success terminator`, async () => {
        const { h, cooldowns } = handler();
        const res = Object.assign(new EventEmitter(), {
            chunks: [],
            headersSent: true,
            writableEnded: false,
            write(s) {
                this.chunks.push(s);
            },
        });
        const messages = [
            { data: "visible-content" },
            { event_type: "error", message: "upstream empty tail", status: 503 },
        ];
        const queue = {
            dequeue: async () => {
                assert.ok(messages.length);
                return messages.shift();
            },
        };
        let stopped = false;
        h.timeouts = { STREAM_CHUNK: 100 };
        h._startStreamKeepAlive = () => () => {
            stopped = true;
        };
        h._isResponseWritable = () => true;
        h.formatConverter = {
            translateGoogleToClaudeStream: () => "visible-content",
            translateGoogleToOpenAIStream: () => "visible-content",
            translateGoogleToResponseAPIStream: () => "visible-content",
        };
        await h.accountRequestContext.run({ lease: { authIndex: 2 }, model: "gemini-4-hydrogen" }, async () => {
            await h[method](queue, res, "gemini-4-hydrogen", name === "Responses" ? {} : "req");
        });
        assert.equal(res.__usageTrackingErrorStatus, 503);
        assert.deepEqual(cooldowns, [[2, 503, 30000]]);
        assert.equal(res.chunks[0], "visible-content");
        assert.ok(!res.chunks.join("").includes("[DONE]"));
        assert.ok(!res.chunks.join("").includes("response.completed"));
        if (name === "OpenAI") assert.equal(JSON.parse(res.chunks[1].slice(5)).error.code, 503);
        assert.equal(stopped, true);
    });
}

test("client abort and validation errors never retire a healthy account", async () => {
    const { h, cooldowns } = handler();
    await h.accountRequestContext.run({ lease: { authIndex: 2 } }, async () => {
        await h._handleRequestFailure({ isUserAborted: true, status: 503 });
        await h._handleRequestFailure({ message: "invalid schema", status: 400 });
        await h._handleRequestFailure({ status: 404 });
    });
    assert.deepEqual(cooldowns, []);
});

for (const failAll of [false, true]) {
    for (const [name, method, translator] of [
        ["OpenAI", "processOpenAIRequest", "translateOpenAIToGoogle"],
        ["Claude", "processClaudeRequest", "translateClaudeToGoogle"],
        ["Responses", "processOpenAIResponseRequest", "translateOpenAIResponseToGoogle"],
        ["Gemini", "_handleRealStreamResponse", null],
        ["Buffered", "_executeRequestWithRetries", null],
    ]) {
        test(`${name}: full inventory ${failAll ? "exhausts before error" : "succeeds beyond six"} and waits for cold backfill`, async () => {
            const { h, denied } = handler();
            const Registry = require("../src/core/ConnectionRegistry");
            const Balancer = require("../src/core/AccountLoadBalancer");
            const registry = new Registry(logger);
            h.authSource = { getRotationIndices: () => Array.from({ length: 9 }, (_, i) => i) };
            let ready = [0, 1, 2];
            const cooled = new Set(),
                forwarded = [];
            h.connectionRegistry = registry;
            h.accountLoadBalancer = new Balancer({
                cooldownByStatus: { 403: 30000, 503: 30000 },
                getEligibleAuthIndices: () => ready.filter(i => !cooled.has(i)),
                maxConcurrentRequests: 3,
                onCooldown: i => {
                    cooled.add(i);
                    if (i >= 2 && i < 8)
                        setImmediate(() => {
                            ready = [i + 1];
                            h.accountLoadBalancer.notifyAvailabilityChanged();
                        });
                },
            });
            h.config.streamingMode = "real";
            h.timeouts = { FAKE_STREAM: 1000, STREAM_CHUNK: 100 };
            const res = Object.assign(new EventEmitter(), {
                chunks: [],
                end() {
                    this.writableEnded = true;
                },
                flushHeaders() {
                    this.headersSent = true;
                },
                get() {
                    return "text/event-stream";
                },
                headersSent: false,
                set() {
                    return this;
                },
                status(n) {
                    this.statusCode = n;
                    return this;
                },
                statusCode: 200,
                writableEnded: false,
                write(s) {
                    this.headersSent = true;
                    this.chunks.push(s);
                },
            });
            Object.assign(h, {
                _applyFileReferenceInlining: () => ({ ok: true }),
                _cancelCurrentAttemptBeforeRetry() {},
                _ensureBrowserBackedRequestReady: async () => true,
                _finalizeTrackedRequest() {},
                _forwardRequest(request, index) {
                    assert.equal(res.headersSent, false, "no HTTP success before a successful account");
                    forwarded.push(index);
                    const q = registry.messageQueues.get(request.request_id).queue;
                    if (index < 8 || failAll)
                        q.enqueue({
                            event_type: "error",
                            message: "upstream refused",
                            status: [403, 502, 429, 403, 503, 502, 429, 403, 403][index],
                        });
                    else {
                        q.enqueue({ event_type: "response_headers", headers: {}, status: 200 });
                        q.enqueue({ data: "data: answer\n\n" });
                        q.enqueue({ type: "STREAM_END" });
                    }
                },
                _generateRequestId: () => "full-retry",
                _getAccountNameForIndex: i => String(i),
                _getUsageStatsService: () => null,
                _handleQueueTimeout() {},
                _handleRequestError(e) {
                    assert.fail(e.stack || e.message);
                },
                _isResponseWritable: () => !res.writableEnded,
                _logGeminiNativeChunkDebug() {},
                _sendErrorResponse(response, status) {
                    assert.equal(forwarded.length, 9, "no client error before the entire inventory fails");
                    response.status(status);
                    response.write("final-error");
                    response.end();
                },
                _setResponseHeaders() {},
                _setupClientDisconnectHandler() {},
                _startStreamKeepAlive: () => () => {},
                _startTrackedRequest() {},
                _updateTrackedRequest() {},
                formatConverter: {
                    translateGoogleToClaudeStream: () => "data: answer\n\n",
                    translateGoogleToOpenAIStream: () => "data: answer\n\n",
                    translateGoogleToResponseAPIStream: () => "data: answer\n\n",
                    [translator]: async () => ({
                        cleanModelName: "gemini-4-hydrogen",
                        googleRequest: { contents: [] },
                    }),
                },
                timeouts: { STREAM_CHUNK: 100 },
            });
            const lease = await h.accountLoadBalancer.acquire();
            try {
                await h.accountRequestContext.run({ lease, model: "gemini-4-hydrogen" }, async () => {
                    if (name === "Buffered") {
                        const request = { is_generative: true, request_id: "full-retry", streaming_mode: "fake" };
                        h._initializeProxyRequestAttempt(request);
                        const q = registry.createMessageQueue(request.request_id, 0, request.request_attempt_id);
                        const result = await h[method](request, q);
                        assert.equal(result.success, !failAll);
                        if (failAll) h._sendErrorResponse(res, result.error.status);
                        else res.write("answer");
                        registry.removeMessageQueue(request.request_id);
                    } else if (name === "Gemini") {
                        const request = { is_generative: true, request_id: "full-retry" };
                        h._initializeProxyRequestAttempt(request);
                        const q = registry.createMessageQueue(request.request_id, 0, request.request_attempt_id);
                        await h[method](request, q, {}, res);
                        registry.removeMessageQueue(request.request_id);
                    } else {
                        await h[method]({ body: { stream: true }, headers: {}, path: "/test" }, res);
                    }
                });
                assert.deepEqual(forwarded, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
                assert.deepEqual([...new Set(denied.map(([i]) => i))], failAll ? [0, 3, 7, 8] : [0, 3, 7]);
                assert.deepEqual([...cooled], failAll ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [0, 1, 2, 3, 4, 5, 6, 7]);
                assert.ok(res.chunks.join("").includes(failAll ? "final-error" : "answer"));
                assert.equal(res.statusCode, failAll ? 403 : 200);
                assert.equal(registry.messageQueues.size, 0);
            } finally {
                lease.release();
            }
            assert.equal(h.accountLoadBalancer.getActiveRequestCount(), 0);
        });
    }
}

test("pinned retries and cancelled waiters cannot rotate, but transient 404 can retry the same account", async () => {
    const { h, cooldowns } = handler();
    const lease = { authIndex: 0, pinnedAuthIndex: 0 };
    const controller = new AbortController();
    let moves = 0,
        same = 0;
    h._performImmediateSwitchRetry = async () => {
        moves++;
        return true;
    };
    h._prepareTransient404Retry = async () => {
        same++;
        return true;
    };
    await h.accountRequestContext.run({ lease, signal: controller.signal }, async () => {
        const tracker = h._createImmediateSwitchTracker(0);
        tracker.attemptLimit = 1;
        assert.equal(await h._prepareImmediateStatusRetry({ status: 404 }, "req", tracker, 0), true);
        assert.equal(same, 1);
        assert.equal(await h._prepareImmediateStatusRetry({ status: 502 }, "req", tracker, 0), false);
        controller.abort();
        assert.equal(await h._prepareImmediateStatusRetry({ status: 503 }, "req", tracker, 0), false);
    });
    assert.equal(moves, 0);
    assert.deepEqual(cooldowns, [[0, 502, 15000]]);
});
