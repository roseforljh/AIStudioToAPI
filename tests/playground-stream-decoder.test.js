const { test } = require("node:test");
const assert = require("node:assert/strict");
const EventEmitter = require("node:events");
const vm = require("node:vm");
const PlaygroundStreamDecoder = require("../src/core/PlaygroundStreamDecoder");
const { MakerSuiteBridge, installPageBridge } = require("../src/core/MakerSuiteBridge");
const RequestHandler = require("../src/core/RequestHandler");
const ConnectionRegistry = require("../src/core/ConnectionRegistry");

const logger = Object.fromEntries(["debug", "info", "warn", "error"].map(k => [k, () => {}]));

test("PlaygroundStreamDecoder emits frames incrementally across arbitrary chunk splits", () => {
    const emitted = [];
    const toolNames = new Map([["alias_long", "a".repeat(80)]]);
    const decoder = new PlaygroundStreamDecoder(chunk => emitted.push(chunk), { toolNames });

    const frame1 = [[[[[[null, "Hello "]], "model"]]]];
    const frame2 = [
        [
            [
                [
                    [
                        [
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            ["alias_long", [[["k", [null, null, "v"]]]], "up-1"],
                            null,
                            null,
                            null,
                            "sig-1",
                        ],
                    ],
                    "model",
                ],
                1,
            ],
        ],
        null,
        [10, 5, 15],
        null,
        null,
        null,
        null,
        "resp-1",
    ];
    const wire = JSON.stringify([[frame1, frame2]]);
    const splitAt = wire.indexOf("Hello ") + 8;

    // Push first frame while second frame has only partially arrived.
    decoder.push(wire.slice(0, splitAt + 20));
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].candidates[0].content.parts[0].text, "Hello ");

    decoder.push(wire.slice(splitAt + 20));
    decoder.finish();
    assert.equal(emitted.length, 2);
    assert.equal(emitted[1].candidates[0].content.parts[0].functionCall.name, "a".repeat(80));
    assert.equal(emitted[1].candidates[0].content.parts[0].thoughtSignature, "sig-1");
    assert.equal(emitted[1].candidates[0].finishReason, "STOP");
    assert.equal(emitted[1].usageMetadata.totalTokenCount, 15);
});

test("PlaygroundStreamDecoder rejects truncated streams and surfaces inline RPC errors", () => {
    const d1 = new PlaygroundStreamDecoder(() => {});
    d1.push('[[[[[[[[null,"part"]],"model"]]]]');
    assert.throws(() => d1.finish(), { status: 502 });

    const d2 = new PlaygroundStreamDecoder(() => {});
    assert.throws(() => d2.push('[[[14,"MakerSuite unavailable"]]]'), { status: 503 });
});

function createStreamBridgeFixture(t, fetchImpl) {
    const context = new EventEmitter();
    const page = new EventEmitter();
    page.mainFrame = () => ({});
    page.isClosed = () => false;
    page.route = async () => {};
    page.unroute = async () => {};
    page.addInitScript = async () => {};
    const sandbox = {
        AbortController,
        addEventListener() {},
        atob: str => Buffer.from(str, "base64").toString("binary"),
        Blob,
        btoa: str => Buffer.from(str, "binary").toString("base64"),
        clearInterval,
        clearTimeout,
        crypto,
        default_MakerSuite: {
            async Cn(a) {
                const p = { snapshot: ({ content }) => content };
                return a && p.snapshot({ content: "proof" });
            },
            async GB(s) {
                const h = { digest: () => "hash", update: () => h };
                new TextEncoder().encode(s);
                return h.update().digest();
            },
        },
        DOMException,
        Event,
        fetch: fetchImpl,
        Headers,
        location: { href: "https://aistudio.google.com/" },
        Request,
        Response,
        setInterval,
        setTimeout,
        TextDecoder,
        TextEncoder,
        URL,
    };
    sandbox.window = sandbox;
    sandbox.window.top = sandbox;
    const realm = vm.createContext(sandbox);
    sandbox.eval = source => vm.runInContext(source, realm);
    vm.runInContext(`(${installPageBridge.toString()})()`, realm);
    sandbox.default_MakerSuite.Cn({
        getMetadata: () => ({ authorization: "SAPISIDHASH test", "x-goog-authuser": "0" }),
    });
    sandbox.__makerSuiteBridge.observe(
        "https://alkalimakersuite-pa.clients6.google.com/$rpc/google.internal.alkali.applications.makersuite.v1.MakerSuiteService/ListModels",
        { "x-goog-api-key": "AIzaSyTestKey1234567890123456789012345" }
    );
    page.evaluate = async (fn, arg) => vm.runInContext(`(${fn.toString()})(${JSON.stringify(arg)})`, realm);
    const bridge = new MakerSuiteBridge({ context, logger, page, readyTimeoutMs: 500, registerRoute: false });
    t.after(() => bridge.dispose());
    return { bridge, sandbox };
}

test("MakerSuiteBridge.streamRequest delivers first chunk before upstream stream closes", async t => {
    let releaseTail;
    const tailGate = new Promise(resolve => {
        releaseTail = resolve;
    });
    const encoder = new TextEncoder();
    const firstFrame = JSON.stringify([[[[[[null, "First token "]], "model"]]]]);
    const secondFrame = JSON.stringify([[[[[[null, "second token"]], "model"], 1]], null, [3, 4, 7]]);
    const { bridge } = createStreamBridgeFixture(t, async () => ({
        body: {
            getReader() {
                let step = 0;
                return {
                    cancel: async () => {},
                    async read() {
                        if (step === 0) {
                            step = 1;
                            return { done: false, value: encoder.encode("[" + firstFrame + ",") };
                        }
                        if (step === 1) {
                            step = 2;
                            await tailGate;
                            return { done: false, value: encoder.encode(secondFrame + "]") };
                        }
                        return { done: true };
                    },
                    releaseLock() {},
                };
            },
        },
        status: 200,
    }));

    const events = [];
    let gotFirstChunk;
    const firstChunkPromise = new Promise(resolve => {
        gotFirstChunk = resolve;
    });
    const run = bridge.streamRequest(
        {
            body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }], role: "user" }] }),
            path: "/v1beta/models/gemini-4-hydrogen:streamGenerateContent",
            request_attempt_id: "req_1_attempt_1",
            request_id: "req_1",
        },
        ev => {
            events.push(ev);
            if (ev.event_type === "chunk") gotFirstChunk();
        }
    );

    await firstChunkPromise;
    assert.equal(events[0].event_type, "response_headers");
    assert.equal(events[1].event_type, "chunk");
    assert.match(events[1].data, /First token /);
    assert.equal(
        events.some(e => e.event_type === "stream_close"),
        false
    );

    releaseTail();
    await run;
    assert.equal(events.at(-1).event_type, "stream_close");
    assert.match(events.map(e => e.data || "").join(""), /second token/);
});

test("MakerSuiteBridge.streamRequest emits 503 before headers on empty completion so retry still switches accounts", async t => {
    const encoder = new TextEncoder();
    const empty = JSON.stringify([[[[[[], "model"], 19]], null, [1, 0, 1]]]);
    const { bridge } = createStreamBridgeFixture(t, async () => ({
        body: {
            getReader() {
                let sent = false;
                return {
                    cancel: async () => {},
                    async read() {
                        if (!sent) {
                            sent = true;
                            return { done: false, value: encoder.encode(empty) };
                        }
                        return { done: true };
                    },
                    releaseLock() {},
                };
            },
        },
        status: 200,
    }));

    const events = [];
    await bridge.streamRequest(
        {
            body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }], role: "user" }] }),
            path: "/v1beta/models/gemini-4-hydrogen:streamGenerateContent",
            request_attempt_id: "req_empty_attempt_1",
            request_id: "req_empty",
        },
        ev => events.push(ev)
    );
    assert.equal(events.length, 1);
    assert.equal(events[0].event_type, "error");
    assert.equal(events[0].status, 503);
    assert.match(events[0].message, /empty completion/i);
});

test("RequestHandler._forwardRequest routes real makersuite streams via MakerSuiteBridge into ConnectionRegistry", async () => {
    const registry = new ConnectionRegistry(logger);
    const queue = registry.createMessageQueue("req_route_1", 0, "req_route_1_attempt_1");
    registry.connectionsByAuth.set(0, { send() {} });
    let capturedRequest = null;
    const handler = {
        _applyFileReferenceInlining() {},
        _extractModelFromPath: RequestHandler.prototype._extractModelFromPath,
        _getMakerSuiteStreamBridge: RequestHandler.prototype._getMakerSuiteStreamBridge,
        browserManager: {
            contexts: new Map([
                [
                    0,
                    {
                        page: {
                            makerSuiteBridge: {
                                closed: false,
                                dispatchStream(req, emit) {
                                    capturedRequest = req;
                                    emit({ event_type: "response_headers", headers: {}, status: 200 });
                                    emit({
                                        data: 'data: {"candidates":[{"content":{"parts":[{"text":"ok"}],"role":"model"},"index":0}]}\n\n',
                                        event_type: "chunk",
                                    });
                                    emit({ event_type: "stream_close" });
                                },
                            },
                        },
                    },
                ],
            ]),
        },
        connectionRegistry: registry,
        logger,
    };
    RequestHandler.prototype._forwardRequest.call(
        handler,
        {
            body: "{}",
            is_generative: true,
            path: "/v1beta/models/gemini-4-hydrogen:streamGenerateContent",
            request_attempt_id: "req_route_1_attempt_1",
            request_id: "req_route_1",
            streaming_mode: "real",
        },
        0
    );
    const headerMsg = await queue.dequeue(1000);
    const chunkMsg = await queue.dequeue(1000);
    const endMsg = await queue.dequeue(1000);
    assert.equal(capturedRequest.request_id, "req_route_1");
    assert.equal(headerMsg.event_type, "response_headers");
    assert.match(chunkMsg.data, /"ok"/);
    assert.equal(endMsg.type, "STREAM_END");
});

test("bridged queue rejects SDK events and stale attempts even after the request object is mutated", () => {
    const registry = new ConnectionRegistry(logger);
    const queue = registry.createMessageQueue("same", 0, "second");
    const source = {};
    registry.messageQueues.get("same").bridgeStreamSource = source;
    const emit = (event, attempt, origin = null) =>
        registry._handleIncomingMessage(
            JSON.stringify({ event_type: event, request_attempt_id: attempt, request_id: "same" }),
            0,
            origin
        );
    emit("error", "second");
    emit("stream_close", "first", source);
    assert.equal(queue.messages.length, 0);
    emit("response_headers", "second", source);
    assert.equal(queue.messages.length, 1);
    registry.removeMessageQueue("same");
});

const frameOf = (parts, finish) => [[[[parts, "model"], ...(finish ? [finish] : [])]]];
const streamSpec = id => ({
    body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }], role: "user" }] }),
    path: "/v1beta/models/gemini-4-hydrogen:streamGenerateContent",
    request_attempt_id: id + "_attempt_1",
    request_id: id,
});
function responseFromBlocks(blocks) {
    let index = 0;
    return {
        body: {
            getReader() {
                return {
                    async cancel() {},
                    async read() {
                        return index < blocks.length
                            ? { done: false, value: new TextEncoder().encode(blocks[index++]) }
                            : { done: true };
                    },
                    releaseLock() {},
                };
            },
        },
        status: 200,
    };
}

test("tools wait for validated EOF and pick up trailing signatures before being exposed", async t => {
    let release;
    const gate = new Promise(resolve => {
        release = resolve;
    });
    const call = Array(15).fill(null);
    call[10] = ["lookup", [], "upstream-id"];
    const signature = Array(15).fill(null);
    signature[14] = "opaque-tail-signature";
    const first = JSON.stringify(frameOf([call]));
    const last = JSON.stringify(frameOf([signature], 1));
    const { bridge } = createStreamBridgeFixture(t, async () => {
        const response = responseFromBlocks(["[" + first + ",", last + "]"]);
        const get = response.body.getReader;
        response.body.getReader = () => {
            const reader = get();
            let n = 0;
            const read = reader.read;
            reader.read = async () => {
                if (n++ === 1) await gate;
                return read();
            };
            return reader;
        };
        return response;
    });
    const events = [];
    const run = bridge.streamRequest(streamSpec("tool-tail"), e => events.push(e));
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(events.length, 0, "no executable tool or premature HTTP success before validation");
    release();
    await run;
    const chunks = events.filter(e => e.data).map(e => JSON.parse(e.data.slice(5)));
    const part = chunks.flatMap(x => x.candidates.flatMap(c => c.content.parts)).find(p => p.functionCall);
    assert.equal(part.thoughtSignature, "opaque-tail-signature");
    assert.equal(part.functionCall.id, "upstream-id");
    assert.equal(events.at(-1).event_type, "stream_close");
});

test("late upstream failure after text is an error, never a successful terminator or duplicate replay", async t => {
    let calls = 0;
    const { bridge } = createStreamBridgeFixture(t, async () => {
        calls++;
        return responseFromBlocks([
            "[" + JSON.stringify(frameOf([[null, "visible text"]])) + ",",
            '[14,"late unavailable"]]',
        ]);
    });
    const events = [];
    await bridge.streamRequest(streamSpec("late"), e => events.push(e));
    assert.equal(calls, 1);
    assert.equal(events[0].event_type, "response_headers");
    assert.match(events.find(e => e.data).data, /visible text/);
    assert.equal(events.at(-1).event_type, "error");
    assert.equal(events.at(-1).status, 503);
    assert(!events.some(e => e.event_type === "stream_close"));
});

test("cancellation aborts blocked browser fetch and retires stream bookkeeping", async t => {
    let signal, started;
    const ready = new Promise(resolve => {
        started = resolve;
    });
    const { bridge } = createStreamBridgeFixture(t, async (_url, init) => {
        signal = init.signal;
        started();
        return new Promise((_, reject) =>
            signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true })
        );
    });
    const spec = streamSpec("cancel-test"),
        events = [];
    const run = bridge.streamRequest(spec, e => events.push(e));
    await ready;
    bridge.cancelAttempt(spec.request_id, spec.request_attempt_id);
    await run;
    assert(signal.aborted);
    assert.equal(bridge.active.size, 0);
    assert.equal(events.length, 0);
});

test("decoder handles escaped Unicode and every character boundary and rejects invalid tails", () => {
    const first = frameOf([[null, '你好😀 [quote "slash\\ ]']]);
    const final = frameOf([], 1);
    const raw = JSON.stringify([[first, final]]);
    const chunks = [],
        decoder = new PlaygroundStreamDecoder(c => chunks.push(c));
    for (const char of raw) decoder.push(char);
    decoder.finish();
    assert.equal(chunks[0].candidates[0].content.parts[0].text, '你好😀 [quote "slash\\ ]');
    assert.throws(() => decoder.push("bad"), { status: 502 });
    const malformed = new PlaygroundStreamDecoder(() => {});
    assert.throws(
        () => {
            malformed.push(JSON.stringify([first, final]).slice(0, -1) + "}");
            malformed.finish();
        },
        { status: 502 }
    );
    const limited = new PlaygroundStreamDecoder(() => {}, { maxMessageChars: 32 });
    assert.throws(() => limited.push('["' + "x".repeat(33)), { status: 502 });
});

test("HTTP stream heartbeat stops on both normal finish and client close", () => {
    const res = new EventEmitter();
    res.headersSent = true;
    res.writableEnded = false;
    const handler = { _isResponseWritable: () => true };
    const before = res.listenerCount("close");
    const stop = RequestHandler.prototype._startStreamKeepAlive.call(handler, res);
    assert.equal(res.listenerCount("close"), before + 1);
    res.emit("finish");
    stop();
    assert.equal(res.listenerCount("close"), before);
    const stop2 = RequestHandler.prototype._startStreamKeepAlive.call(handler, res);
    res.emit("close");
    stop2();
    assert.equal(res.listenerCount("finish"), 0);
});

test("metadata and empty parts cannot commit HTTP success before a code-19 empty failure", async t => {
    const signature = Array(15).fill(null);
    signature[14] = "metadata-only-signature";
    const { bridge } = createStreamBridgeFixture(t, async () =>
        responseFromBlocks([JSON.stringify([frameOf([[null, ""], signature]), frameOf([], 19)])])
    );
    const events = [];
    await bridge.streamRequest(streamSpec("metadata-empty"), e => events.push(e));
    assert.deepEqual(
        events.map(e => e.event_type),
        ["error"]
    );
    assert.equal(events[0].status, 503);
    assert.match(events[0].message, /code=19/);
});

test("metadata-only malformed completion remains a retryable 502 before headers", async t => {
    const { bridge } = createStreamBridgeFixture(t, async () =>
        responseFromBlocks([JSON.stringify([frameOf([[null, ""]])])])
    );
    const events = [];
    await bridge.streamRequest(streamSpec("metadata-unfinished"), e => events.push(e));
    assert.deepEqual(
        events.map(e => e.event_type),
        ["error"]
    );
    assert.equal(events[0].status, 502);
});
