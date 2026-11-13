const { test } = require("node:test");
const assert = require("node:assert/strict");
const FormatConverter = require("../src/core/FormatConverter");
const { buildBody } = require("../src/core/MakerSuiteCodec");
const logger = Object.fromEntries(["debug", "info", "warn", "error"].map(k => [k, () => {}]));
const converter = () => new FormatConverter(logger, { config: { safetySettingsThreshold: "OFF" } });
const model = "fixture";
const signed = (overrides = {}) => ({
    functionCall: { args: { path: "sample.txt" }, id: "upstream-123", name: "lookup" },
    thoughtSignature: "opaque-original-signature",
    ...overrides,
});
const response = parts => ({ candidates: [{ content: { parts, role: "model" }, finishReason: "STOP", index: 0 }] });
const decode = text =>
    (text || "")
        .split(/\r?\n/)
        .filter(l => l.startsWith("data:") && !l.includes("[DONE]"))
        .map(l => JSON.parse(l.slice(5)));

function calls(c, format, stream, parts) {
    if (stream) {
        const events = decode(
            c["translateGoogleTo" + format + "Stream"]("data: " + JSON.stringify(response(parts)) + "\n\n", model, {})
        );
        if (format === "OpenAI") return events.flatMap(e => (e.choices || []).flatMap(x => x.delta?.tool_calls || []));
        if (format === "Claude")
            return events.filter(e => e.content_block?.type === "tool_use").map(e => e.content_block);
        return events
            .filter(e => e.type === "response.output_item.added" && e.item?.type === "function_call")
            .map(e => e.item);
    }
    const r = c["convertGoogleTo" + format + "NonStream"](response(parts), model);
    return format === "OpenAI"
        ? r.choices[0].message.tool_calls
        : format === "Claude"
          ? r.content.filter(x => x.type === "tool_use")
          : r.output.filter(x => x.type === "function_call");
}
async function replay(c, format, out, parts) {
    if (format === "OpenAI")
        return (
            await c.translateOpenAIToGoogle({
                messages: [
                    { content: "read", role: "user" },
                    {
                        content: null,
                        role: "assistant",
                        tool_calls: out.map((x, i) => ({
                            function: {
                                arguments: JSON.stringify(parts[i].functionCall.args || {}),
                                name: parts[i].functionCall.name,
                            },
                            id: x.id,
                            type: "function",
                        })),
                    },
                    ...out.map(x => ({ content: "ok", role: "tool", tool_call_id: x.id })),
                ],
                model,
            })
        ).googleRequest;
    if (format === "Claude")
        return (
            await c.translateClaudeToGoogle({
                messages: [
                    { content: "read", role: "user" },
                    {
                        content: out.map((x, i) => ({
                            id: x.id,
                            input: parts[i].functionCall.args || {},
                            name: parts[i].functionCall.name,
                            type: "tool_use",
                        })),
                        role: "assistant",
                    },
                    {
                        content: out.map(x => ({ content: "ok", tool_use_id: x.id, type: "tool_result" })),
                        role: "user",
                    },
                ],
                model,
            })
        ).googleRequest;
    return (
        await c.translateOpenAIResponseToGoogle({
            input: [
                { content: "read", role: "user" },
                ...out.flatMap((x, i) => [
                    {
                        arguments: JSON.stringify(parts[i].functionCall.args || {}),
                        call_id: x.call_id,
                        name: parts[i].functionCall.name,
                        type: "function_call",
                    },
                    { call_id: x.call_id, output: "ok", type: "function_call_output" },
                ]),
            ],
            model,
        })
    ).googleRequest;
}
for (const format of ["OpenAI", "Claude", "ResponseAPI"])
    for (const stream of [false, true]) {
        test(
            format + (stream ? " stream" : " JSON") + ": opaque signature and upstream IDs survive a client roundtrip",
            async () => {
                const c = converter(),
                    parts = [signed()],
                    out = calls(c, format, stream, parts);
                assert.equal(out.length, 1);
                assert(!JSON.stringify(out).includes("opaque-original-signature"));
                const request = await replay(c, format, out, parts);
                const flat = request.contents.flatMap(x => x.parts);
                assert.equal(flat.find(x => x.functionCall).thoughtSignature, parts[0].thoughtSignature);
                assert.equal(flat.find(x => x.functionCall).functionCall.id, "upstream-123");
                assert.equal(flat.find(x => x.functionResponse).functionResponse.id, "upstream-123");
                const wire = buildBody(model, request).body[1].flatMap(x => x[0]);
                assert.equal(wire.find(x => x[10])[14], parts[0].thoughtSignature);
            }
        );
        test(
            format +
                (stream ? " stream" : " JSON") +
                ": parallel tool calls keep the signature on its original part only",
            async () => {
                const c = converter(),
                    parts = [signed(), { functionCall: { args: {}, id: "upstream-other", name: "other" } }];
                const out = calls(c, format, stream, parts),
                    req = await replay(c, format, out, parts);
                const fc = req.contents.flatMap(x => x.parts).filter(x => x.functionCall);
                assert.equal(fc.length, 2);
                assert.equal(fc[0].thoughtSignature, "opaque-original-signature");
                assert.equal(fc[1].thoughtSignature, undefined);
                assert.equal(fc[1].functionCall.id, "upstream-other");
            }
        );
    }
test("cache misses do not expose unrelated signatures; model, function and argument mismatches are rejected", () => {
    const c = converter(),
        part = signed(),
        id = c._rememberToolCall(part, model, "call_");
    for (const [m, n, a] of [
        ["different", "lookup", part.functionCall.args],
        [model, "other", part.functionCall.args],
        [model, "lookup", { path: "changed.txt" }],
    ]) {
        assert.equal(c._toolContext(id, m, n, a), null);
    }
    const dest = {
        functionCall: structuredClone(part.functionCall),
        thoughtSignature: FormatConverter.DUMMY_THOUGHT_SIGNATURE,
    };
    delete dest.functionCall.id;
    c._restoreToolCall(dest, "unknown", model);
    assert.equal(dest.thoughtSignature, FormatConverter.DUMMY_THOUGHT_SIGNATURE);
    assert.equal(dest.functionCall.id, undefined);
    assert.equal(converter()._toolContext(id, model, "lookup", part.functionCall.args), null);
});
test("cache is bounded, expires, and does not persist raw arguments", () => {
    const c = converter(),
        part = signed();
    const expired = c._rememberToolCall(part, model, "call_");
    c.toolContexts.get(expired).expires = 0;
    assert.equal(c._toolContext(expired, model, "lookup", part.functionCall.args), null);
    let first;
    for (let i = 0; i < 1025; i++) {
        const id = c._rememberToolCall(part, model, "call_");
        first ||= id;
    }
    assert.equal(c.toolContexts.size, 1024);
    assert(!c.toolContexts.has(first));
    assert(!JSON.stringify([...c.toolContexts.values()]).includes("sample.txt"));
    const oversized = c._rememberToolCall(signed({ thoughtSignature: "x".repeat(16385) }), model, "call_");
    assert(!c.toolContexts.has(oversized));
});

test("argument hashes ignore nested object key order but preserve array order and values", () => {
    const c = converter();
    const args = { first: 1, list: [{ a: 1, b: 2 }, 3], nested: { left: 2, right: 3 } };
    const reordered = { first: 1, list: [{ a: 1, b: 2 }, 3], nested: { left: 2, right: 3 } };
    assert.equal(c._toolArgsHash(args), c._toolArgsHash(reordered));
    assert.notEqual(c._toolArgsHash(args), c._toolArgsHash({ ...args, list: [3, { a: 1, b: 2 }] }));
    assert.notEqual(c._toolArgsHash(args), c._toolArgsHash({ ...args, first: "1" }));
    const part = signed({ functionCall: { args, name: "lookup" } });
    const id = c._rememberToolCall(part, model, "call_");
    const next = { functionCall: { args: reordered, name: "lookup" } };
    c._restoreToolCall(next, id, model);
    assert.equal(next.thoughtSignature, part.thoughtSignature);
});
