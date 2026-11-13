const { test } = require("node:test");
const assert = require("node:assert/strict");
const FormatConverter = require("../src/core/FormatConverter");
const { wrapResponse } = require("../src/core/MakerSuiteCodec");
const logger = Object.fromEntries(["debug", "info", "warn", "error"].map(k => [k, () => {}]));
const converter = () => new FormatConverter(logger, { config: { safetySettingsThreshold: "OFF" } });
const response = parts => ({ candidates: [{ index: 0, content: { role: "model", parts }, finishReason: "STOP" }] });
const sse = value => `data: ${JSON.stringify(value)}\r\n\r\n`;
const decode = text => (text || "").split(/\r?\n/).filter(l => l.startsWith("data:") && !l.includes("[DONE]"))
    .map(l => JSON.parse(l.slice(5)));
const toolPart = () => ({ thought: true, text: "", functionCall: { name: "lookup", args: {} } });

for (const format of ["OpenAI", "Claude", "ResponseAPI"]) {
    test(`${format}: a tool call marked as thought is not swallowed`, () => {
        const c = converter();
        const stream = c[`translateGoogleTo${format}Stream`](sse(response([toolPart()])), "fixture", {});
        const events = decode(stream);
        if (format === "OpenAI") {
            assert.equal(events[0].choices[0].delta.tool_calls[0].function.name, "lookup");
            assert.equal(events.at(-1).choices[0].finish_reason, "tool_calls");
        } else if (format === "Claude") {
            assert(events.some(e => e.content_block?.type === "tool_use" && e.content_block.name === "lookup"));
            assert(events.some(e => e.delta?.stop_reason === "tool_use"));
        } else {
            assert(events.some(e => e.item?.type === "function_call" && e.item.name === "lookup"));
        }
        const names = { OpenAI: "convertGoogleToOpenAINonStream", Claude: "convertGoogleToClaudeNonStream", ResponseAPI: "convertGoogleToResponseAPINonStream" };
        const result = c[names[format]](response([toolPart()]), "fixture");
        if (format === "OpenAI") assert.equal(result.choices[0].message.tool_calls[0].function.name, "lookup");
        else if (format === "Claude") assert.equal(result.content[0].type, "tool_use");
        else assert(result.output.some(item => item.type === "function_call"));
    });
    test(`${format}: SSE split at every character preserves the tool and terminal event`, () => {
        const c = converter(), state = {};
        const method = `translateGoogleTo${format}Stream`;
        const wire = ': heartbeat\r\n\r\nevent: message\r\n' + sse(response([toolPart()]));
        let output = "";
        for (const char of wire) output += c[method](char, "fixture", state) || "";
        output += c[method]("", "fixture", state, true) || "";
        assert.match(output, /lookup/);
        assert.match(output, format === "OpenAI" ? /tool_calls/ : format === "Claude" ? /message_stop/ : /response.completed/);
        assert.equal(state.googleStreamBuffer, "");
    });
    test(`${format}: coalesced events and unframed JSON are accepted`, () => {
        const c = converter(), state = {};
        const first = { candidates: [{ content: { parts: [{ text: "first" }], role: "model" } }] };
        const output = c[`translateGoogleTo${format}Stream`](sse(first) + sse(response([{ text: "second" }])), "fixture", state);
        assert.match(output, /first/); assert.match(output, /second/);
        assert.match(c[`translateGoogleTo${format}Stream`](JSON.stringify(response([{ text: "raw" }])), "fixture", {}), /raw/);
    });
    test(`${format}: truncated JSON fails on stream end instead of reporting success`, () => {
        const c = converter(), state = {}, method = `translateGoogleTo${format}Stream`;
        assert.equal(c[method]('data: {"candidates":', "fixture", state), null);
        assert.throws(() => c[method]("", "fixture", state, true), e => e.status === 502);
    });
}

test("OpenAI results without name resolve each opaque ID to its function", async () => {
    const { googleRequest } = await converter().translateOpenAIToGoogle({
        model: "fixture", messages: [
            { role: "user", content: "check" },
            { role: "assistant", content: null, tool_calls: [
                { id: "call_random_1", type: "function", function: { name: "alpha", arguments: "{}" } },
                { id: "call_random_2", type: "function", function: { name: "beta", arguments: "{}" } },
            ] },
            { role: "tool", tool_call_id: "call_random_2", content: "42" },
            { role: "tool", tool_call_id: "call_random_1", content: "null" },
        ],
    });
    const results = googleRequest.contents.flatMap(m => m.parts).filter(p => p.functionResponse).map(p => p.functionResponse);
    assert.deepEqual(results.map(r => r.name), ["beta", "alpha"]);
    assert.deepEqual(results.map(r => r.response), [{ result: 42 }, { result: null }]);
});

test("unmatched OpenAI tool result produces a local 400", async () => {
    await assert.rejects(converter().translateOpenAIToGoogle({ model: "fixture", messages: [
        { role: "tool", tool_call_id: "unknown", content: "ok" },
    ] }), e => e.status === 400);
});

const envelope = (parts, finish = 5) => JSON.stringify([[[[[parts, "model"], finish]], null, [0, 0, 0]]]);
test("thought/signature flags alone are not a successful completion", () => {
    const part = []; part[12] = true; part[14] = "sig";
    for (const streamed of [true, false]) assert.throws(() => wrapResponse(envelope([part]), streamed), e => e.status === 503);
});
test("empty-completion diagnostics retain the observed finish code", () => {
    const part = []; part[1] = "";
    assert.throws(() => wrapResponse(envelope([part], 12), false), e => e.status === 503 && /code=12/.test(e.message));
});
