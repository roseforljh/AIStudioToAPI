const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildBody, decStruct } = require("../src/core/MakerSuiteCodec");
const FormatConverter = require("../src/core/FormatConverter");
const converter = new FormatConverter(
    { info() {}, warn() {}, debug() {}, error() {} },
    {
        config: { forceThinking: false, safetySettingsThreshold: "OFF" },
    }
);
const base = () => ({ contents: [{ role: "user", parts: [{ text: "hello" }] }] });
const schema = () => ({
    type: "object",
    properties: { metadata: { type: "string" }, value: { type: "integer", minimum: 0 } },
    required: ["value"],
});

test("unknown protocol fields are ignored recursively without changing the supported wire request", () => {
    const clean = {
        ...base(),
        generationConfig: { maxOutputTokens: 128, thinkingConfig: { includeThoughts: true } },
        tools: [{ functionDeclarations: [{ name: "lookup", parameters: schema() }] }],
    };
    const extra = structuredClone(clean);
    extra.future_agent_option = { anything: true };
    extra.metadata = { platform: "arbitrary-client" };
    extra.contents[0].cache_control = { type: "ephemeral" };
    extra.contents[0].parts[0].future_part_option = true;
    extra.generationConfig.future_sampler_option = 123;
    extra.generationConfig.thinkingConfig.future_budget_option = 123;
    extra.generationConfig.thinkingConfig.thinkingLevel = "future-level";
    extra.toolConfig = { includeServerSideToolInvocations: true, functionCallingConfig: { mode: "ANY" } };
    const declaration = extra.tools[0].functionDeclarations[0];
    declaration.strict = true;
    declaration.cache_control = { type: "ephemeral" };
    declaration.parameters.additionalProperties = false;
    declaration.parameters.$ref = "#/$defs/unsupported";
    declaration.parameters.properties.value.exclusiveMinimum = 0;
    declaration.parameters.properties.value.future_constraint = { x: 1 };
    extra.tools.push({ googleSearch: {} }, { futureHostedTool: { enabled: true } });
    const before = JSON.stringify(extra);
    assert.deepEqual(buildBody("fixture-model", extra).body, buildBody("fixture-model", clean).body);
    assert.equal(JSON.stringify(extra), before);
});

test("schema property names and tool payloads are user data, not protocol fields", () => {
    const data = { metadata: { cache_control: true }, additionalProperties: false, future_option: [0, false, ""] };
    const request = {
        ...base(),
        tools: [
            {
                functionDeclarations: [
                    {
                        name: "lookup",
                        parameters: {
                            type: "object",
                            properties: {
                                additionalProperties: { type: "boolean" },
                                future_option: { type: "string" },
                            },
                        },
                    },
                ],
            },
        ],
    };
    request.contents.push(
        { role: "model", parts: [{ functionCall: { name: "lookup", args: data, future_option: "ignore" } }] },
        { role: "user", parts: [{ functionResponse: { name: "lookup", response: data, future_option: "ignore" } }] }
    );
    const { body } = buildBody("fixture-model", request);
    assert.deepEqual(
        body[6][0][1][0][2][6].map(([name]) => name),
        ["additionalProperties", "future_option"]
    );
    assert.deepEqual(decStruct(body[1][1][0][0][10][1]), data);
    assert.deepEqual(decStruct(body[1][2][0][0][11][1]), data);
});

test("all four API formats use the same upstream whitelist", async () => {
    const s = { ...schema(), additionalProperties: false, future_constraint: "ignore" };
    const extension = { metadata: { any: 1 }, future_platform_flag: true };
    const requests = await Promise.all([
        converter.translateOpenAIToGoogle({
            ...extension,
            model: "fixture-model",
            messages: [{ role: "user", content: "hi" }],
            tools: [{ type: "function", function: { name: "lookup", parameters: s }, strict: true }],
        }),
        converter.translateClaudeToGoogle({
            ...extension,
            model: "fixture-model",
            max_tokens: 128,
            messages: [{ role: "user", content: "hi" }],
            tools: [{ name: "lookup", input_schema: s, cache_control: { type: "ephemeral" } }],
        }),
        converter.translateOpenAIResponseToGoogle({
            ...extension,
            model: "fixture-model",
            input: "hi",
            tools: [{ type: "function", name: "lookup", parameters: s, strict: true }, { type: "web_search" }],
        }),
    ]);
    const native = { ...base(), ...extension, tools: [{ functionDeclarations: [{ name: "lookup", parameters: s }] }] };
    converter.sanitizeGeminiTools(native);
    for (const request of [...requests.map(result => result.googleRequest), native]) {
        const wire = buildBody("fixture-model", request).body;
        assert.equal(wire[6][0][1][0][0], "lookup");
        assert.deepEqual(wire[6][0][1][0][2][7], ["value"]);
    }
});

test("ignoring extensions does not bypass validation of malformed core data", () => {
    for (const request of [
        { ...base(), generationConfig: { seed: "not-an-int", future: true } },
        { ...base(), contents: [] },
        { ...base(), tools: [{ functionDeclarations: [{ parameters: schema() }] }] },
        { ...base(), contents: [{ parts: [{ functionCall: { name: "lookup", args: [] } }] }] },
    ])
        assert.throws(
            () => buildBody("fixture-model", request),
            error => error.status === 400
        );
});
