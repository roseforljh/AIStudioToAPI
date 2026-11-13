const { test } = require("node:test");
const assert = require("node:assert/strict");
const FormatConverter = require("../src/core/FormatConverter");
const { buildBody, decStruct, encStruct, wrapResponse } = require("../src/core/MakerSuiteCodec");
const logger = Object.fromEntries(["debug", "info", "warn", "error"].map(key => [key, () => {}]));
const converter = new FormatConverter(logger, { config: { safetySettingsThreshold: "OFF" } });
const base = () => ({ contents: [{ role: "user", parts: [{ text: "hello" }] }] });
const wireSchema = schema =>
    buildBody("fixture-model", {
        ...base(),
        tools: [{ functionDeclarations: [{ name: "lookup", parameters: schema }] }],
    }).body[6][0][1][0][2];
const badRequest = error => error.status === 400;
const badResponse = error => error.status === 502;

test("decodes native empty Struct encodings without accepting malformed arguments", () => {
    assert.deepEqual(decStruct([]), {});
    assert.deepEqual(decStruct([[]]), {});
    for (const value of [null, {}, [null], [[null]], [[["x"]]], [[[1, [0]]]]])
        assert.throws(() => decStruct(value), badResponse);
});

test("round trips nested Struct values, including empty objects and lists", () => {
    const args = { empty: {}, list: [false, 0, "", null, [], {}], nested: { x: 1 } };
    assert.deepEqual(decStruct(encStruct(args)), args);
    const malicious = JSON.parse('{"__proto__":{"polluted":true},"constructor":"data"}');
    assert.deepEqual(decStruct(encStruct(malicious)), malicious);
    assert.equal({}.polluted, undefined);
});

test("empty-argument function calls survive both response envelope modes", () => {
    const part = [];
    part[10] = ["lookup", []];
    const raw = JSON.stringify([[[[[[part], "model"], 1]], null, [1, 1, 2]]]);
    const nonstream = JSON.parse(JSON.parse(wrapResponse(raw, false))[0]);
    const streamed = JSON.parse(wrapResponse(raw, true));
    for (const response of [nonstream, JSON.parse(streamed[0][0][0])])
        assert.deepEqual(response.candidates[0].content.parts[0].functionCall, { name: "lookup", args: {} });
});

test("encodes all 23 observed native Schema fields in their original positions", () => {
    const schema = {
        type: "OBJECT",
        format: "fixture",
        description: "description",
        nullable: false,
        enum: ["first", "second"],
        items: { type: "STRING" },
        properties: { value: { type: "NUMBER" } },
        required: ["value"],
        minProperties: 0,
        maxProperties: 4,
        minimum: -1.5,
        maximum: 3,
        minLength: 0,
        maxLength: 10,
        pattern: "^x",
        example: { x: 1 },
        oneOf: [{ type: "STRING" }],
        anyOf: [{ type: "INTEGER" }],
        allOf: [{ type: "OBJECT" }],
        not: { type: "BOOLEAN" },
        maxItems: 8,
        minItems: 0,
        propertyOrdering: ["value"],
    };
    assert.deepEqual(wireSchema(schema), [
        6,
        "fixture",
        "description",
        false,
        ["first", "second"],
        [1],
        [["value", [2]]],
        ["value"],
        "0",
        "4",
        -1.5,
        3,
        "0",
        "10",
        "^x",
        [null, null, null, null, encStruct({ x: 1 })],
        [[1]],
        [[3]],
        [[6]],
        [4],
        "8",
        "0",
        ["value"],
    ]);
});

test("union-only schema does not acquire a spurious OBJECT type", () => {
    const wire = wireSchema({ anyOf: [{ type: "STRING" }, { type: "INTEGER" }] });
    assert.equal(wire[0], null);
    assert.deepEqual(wire[17], [[1], [3]]);
});

test("structured output and seed use the existing generation config, not another transport", () => {
    const body = buildBody("fixture-model", {
        ...base(),
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: { type: "OBJECT" },
            seed: 0,
        },
    }).body;
    assert.equal(body[3][7], "application/json");
    assert.deepEqual(body[3][8], [6]);
    assert.equal(body[3][18], 0);
});

for (const [key, value] of [
    ["minLength", -1],
    ["maxItems", 1.5],
    ["minProperties", "1"],
    ["minimum", Infinity],
    ["nullable", "false"],
    ["enum", [1]],
    ["required", "x"],
    ["anyOf", []],
    ["oneOf", {}],
    ["properties", []],
    ["type", "invalid"],
    ["pattern", 1],
])
    test(`rejects invalid or unmapped Schema field ${key}`, () => {
        assert.throws(() => wireSchema({ [key]: value }), badRequest);
    });

test("converters preserve unions and numeric constraints instead of silently dropping them", () => {
    const schema = {
        type: "object",
        properties: {
            choice: {
                anyOf: [
                    { type: "string", minLength: 2 },
                    { type: "integer", minimum: 0 },
                ],
            },
            alternative: { oneOf: [{ type: "string" }, { type: "number" }] },
            merged: { allOf: [{ type: "object" }, { required: ["name"] }] },
            nullable: { type: ["integer", "null"] },
            multi: { type: ["string", "integer"] },
            type: { type: "string" },
            properties: { type: "string" },
        },
    };
    const input = JSON.stringify(schema);
    const converted = converter._convertSchemaToGemini(schema);
    const props = converted.properties;
    assert.deepEqual(props.choice.anyOf, [
        { type: "STRING", minLength: 2 },
        { type: "INTEGER", minimum: 0 },
    ]);
    assert.deepEqual(props.alternative.oneOf, [{ type: "STRING" }, { type: "NUMBER" }]);
    assert.equal(props.merged.allOf.length, 2);
    assert.deepEqual(props.nullable, { nullable: true, type: "INTEGER" });
    assert.deepEqual(props.multi, { anyOf: [{ type: "STRING" }, { type: "INTEGER" }] });
    assert.deepEqual(props.type, { type: "STRING" });
    assert.deepEqual(props.properties, { type: "STRING" });
    assert.equal(JSON.stringify(schema), input);
    assert.doesNotThrow(() => wireSchema(converted));
});

test("type-array intersection is independent of input key order", () => {
    const entries = [
        ["type", ["string", "integer"]],
        ["anyOf", [{ minLength: 2 }, { minimum: 5 }]],
        ["allOf", [{ description: "constraint" }]],
    ];
    const forward = converter._convertSchemaToGemini(Object.fromEntries(entries));
    const reverse = converter._convertSchemaToGemini(Object.fromEntries(entries.toReversed()));
    assert.deepEqual(forward, reverse);
    assert.equal(forward.allOf.length, 2);
});

test("native camelCase and snake_case declarations use the same schema normalizer", () => {
    for (const key of ["functionDeclarations", "function_declarations"]) {
        const request = {
            tools: [
                {
                    [key]: [
                        {
                            name: "lookup",
                            parameters: {
                                type: "object",
                                properties: {
                                    type: { type: "string" },
                                    value: { type: ["integer", "null"], minimum: 0 },
                                },
                            },
                        },
                    ],
                },
            ],
        };
        converter.sanitizeGeminiTools(request);
        assert.deepEqual(request.tools[0][key][0].parameters.properties.type, { type: "STRING" });
        assert.equal(request.tools[0][key][0].parameters.properties.value.minimum, 0);
        assert.doesNotThrow(() => buildBody("fixture-model", { ...base(), ...request }));
    }
});

test("unmapped constraints are ignored at the shared upstream boundary", () => {
    const schema = converter._convertSchemaToGemini({ type: "object", additionalProperties: false });
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(wireSchema(schema), [6]);
});

test("OpenAI, Responses and Claude tools all reach the in-process native encoder", async () => {
    const schema = { type: "object", properties: { value: { anyOf: [{ type: "string" }, { type: "integer" }] } } };
    const outputs = await Promise.all([
        converter.translateOpenAIToGoogle({
            model: "fixture-model",
            messages: [{ role: "user", content: "hi" }],
            tools: [{ type: "function", function: { name: "lookup", parameters: schema } }],
        }),
        converter.translateClaudeToGoogle({
            model: "fixture-model",
            max_tokens: 64,
            messages: [{ role: "user", content: "hi" }],
            tools: [{ name: "lookup", input_schema: schema }],
        }),
        converter.translateOpenAIResponseToGoogle({
            model: "fixture-model",
            input: "hi",
            tools: [{ type: "function", name: "lookup", parameters: schema }],
        }),
    ]);
    for (const { googleRequest } of outputs) {
        const wire = buildBody("fixture-model", googleRequest).body[6][0][1][0][2];
        assert.deepEqual(wire[6][0][1][17], [[1], [3]]);
    }
});

test("nullable anyOf and oneOf branches remain encodable and independent of key order", () => {
    for (const key of ["anyOf", "oneOf"]) {
        const entries = [
            [key, [{ type: "string", minLength: 1 }, { type: "null" }]],
            ["nullable", false],
        ];
        const forward = converter._convertSchemaToGemini(Object.fromEntries(entries));
        const reverse = converter._convertSchemaToGemini(Object.fromEntries(entries.toReversed()));
        assert.deepEqual(forward, reverse);
        assert.equal(forward.nullable, true);
        assert.deepEqual(forward[key], [{ type: "STRING", minLength: 1 }]);
        assert.doesNotThrow(() => wireSchema(forward));
    }
});

test("null-only schemas are rejected explicitly rather than widened to STRING or OBJECT", () => {
    for (const input of [{ type: "null" }, { type: ["null"] }, { anyOf: [{ type: "null" }] }]) {
        const converted = converter._convertSchemaToGemini(input);
        assert.equal(converted.type, "NULL");
        assert.throws(() => wireSchema(converted), /Unsupported MakerSuite schema type/);
    }
});

test("existing structured-output string-enum normalization is independent of key order", () => {
    const entries = [
        ["enum", [1, 2]],
        ["type", "number"],
    ];
    const forward = converter._convertSchemaToGemini(Object.fromEntries(entries), true);
    const reverse = converter._convertSchemaToGemini(Object.fromEntries(entries.toReversed()), true);
    assert.deepEqual(forward, reverse);
    assert.deepEqual(forward, { enum: ["1", "2"], type: "STRING" });
});

test("parametersJsonSchema reaches the same native schema encoder", () => {
    const request = {
        ...base(),
        tools: [
            {
                functionDeclarations: [
                    {
                        name: "lookup",
                        parametersJsonSchema: {
                            type: "object",
                            properties: { value: { type: ["integer", "null"], minimum: 0 } },
                        },
                    },
                ],
            },
        ],
    };
    converter.sanitizeGeminiTools(request);
    const schema = request.tools[0].functionDeclarations[0].parametersJsonSchema;
    assert.deepEqual(schema.properties.value, { type: "INTEGER", nullable: true, minimum: 0 });
    assert.doesNotThrow(() => buildBody("fixture-model", request));
});

test("enumDescriptions remain useful in descriptions and never become wire fields", () => {
    const converted = converter._convertSchemaToGemini({
        type: "string",
        enum: ["a", "b"],
        enumDescriptions: ["first", "second"],
        description: "Choose one",
    });
    assert.equal(converted.enumDescriptions, undefined);
    assert.match(converted.description, /Choose one\n\nEnum descriptions:\n- a: first\n- b: second/);
    assert.doesNotThrow(() => wireSchema(converted));
});

test("seed validation preserves signed int32 bounds and rejects invalid values", () => {
    for (const seed of [-2147483648, 0, 2147483647]) {
        assert.equal(buildBody("fixture-model", { ...base(), generationConfig: { seed } }).body[3][18], seed);
    }
    for (const seed of [-2147483649, 2147483648, 1.5, "1", null, Infinity]) {
        assert.throws(() => buildBody("fixture-model", { ...base(), generationConfig: { seed } }), badRequest);
    }
});
