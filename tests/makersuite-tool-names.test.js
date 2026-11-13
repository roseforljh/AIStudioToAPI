const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildBody, wrapResponse } = require('../src/core/MakerSuiteCodec');
const longName = 'mcp_' + 'a'.repeat(32) + '_search_a_very_long_specialized_documentation_tool';
const request = names => ({
    contents: [{ role: 'user', parts: [{ text: 'Use a tool' }] }],
    tools: [{ functionDeclarations: names.map(name => ({
        name, parameters: { type: 'OBJECT', properties: { value: { type: 'STRING' } } }
    })) }]
});
const response = name => {
    const part = [];
    part[10] = [name, [[['value', [null, null, 'ok']]]]];
    const candidate = [[[part], 'model'], 1];
    return JSON.stringify([[[candidate], null, [1, 1, 2]]]);
};

test('short valid tool names stay unchanged',()=>{
 const {body}=buildBody('gemini-4-hydrogen',request(['lookup','functions.exec','get-time','x'.repeat(63)]));
 assert.deepEqual(body[6][0][1].map(d=>d[0]),['lookup','functions.exec','get-time','x'.repeat(63)]);
});
test('aliases long and unsupported names without changing the input',()=>{
 const g=request([longName,'functions:exec']);const before=JSON.stringify(g);
 const {body,toolNames}=buildBody('gemini-4-hydrogen',g);
 for(const [i,d] of body[6][0][1].entries()){
  assert.match(d[0],/^[A-Za-z_][A-Za-z0-9_.-]{0,62}$/);
  assert.equal(toolNames.get(d[0]),[longName,'functions:exec'][i]);
 }
 assert.equal(JSON.stringify(g),before);
});
test('uses identical aliases for declarations, call history and tool results',()=>{
 const g=request([longName]);g.contents.push({role:'model',parts:[{functionCall:{name:longName,args:{value:'hi'}}}]},{role:'user',parts:[{functionResponse:{name:longName,response:{value:'ok'}}}]});
 const {body}=buildBody('gemini-4-hydrogen',g);const alias=body[6][0][1][0][0];
 assert.notEqual(alias,longName);assert.equal(body[1][1][0][0][10][0],alias);assert.equal(body[1][2][0][0][11][0],alias);
 assert.equal(buildBody('gemini-4-hydrogen',request([longName])).body[6][0][1][0][0],alias);
});
test('restores original names in both streaming and non-streaming responses',()=>{
 const {body,toolNames}=buildBody('gemini-4-hydrogen',request([longName]));const alias=body[6][0][1][0][0];
 const raw=response(alias);
 const nonstream=JSON.parse(JSON.parse(wrapResponse(raw,false,toolNames))[0]);
 assert.equal(nonstream.candidates[0].content.parts[0].functionCall.name,longName);
 const stream=JSON.parse(wrapResponse(raw,true,toolNames));const chunk=JSON.parse(stream[0][0][0]);
 assert.equal(chunk.candidates[0].content.parts[0].functionCall.name,longName);
});
test('aliases only within this request and do not change plain text',()=>{
 const {body,toolNames}=buildBody('gemini-4-hydrogen',request([longName]));const alias=body[6][0][1][0][0];
 const out=JSON.parse(JSON.parse(wrapResponse(response(alias),false))[0]);
 assert.equal(out.candidates[0].content.parts[0].functionCall.name,alias);
 assert.notEqual(buildBody('gemini-4-hydrogen',request([longName+'2'])).body[6][0][1][0][0],alias);
});
