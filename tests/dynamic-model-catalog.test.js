const {test}=require('node:test');const assert=require('node:assert/strict');
const Catalog=require('../src/core/DynamicModelCatalog');
test('merges live models without losing static fallback and reuses fresh cache',async()=>{
 let calls=0;const page={isClosed:()=>false,buildBenefit:{_evaluate:async()=>{calls++;return {models:[{name:'models/gemini-4-argon',displayName:'Argon',supportedGenerationMethods:['generateContent']}]};}}};
 const system={config:{modelList:[{name:'models/old-model'}]},browserManager:{contexts:new Map([[0,{page}]])},connectionRegistry:{getConnectionByAuth:()=>({readyState:1})}};
 const c=new Catalog(system);assert.deepEqual((await c.list()).map(x=>x.name),['models/gemini-4-argon','models/old-model']);await c.list();assert.equal(calls,1);
});
test('upstream failure falls back to configured list',async()=>{
 const page={isClosed:()=>false,buildBenefit:{_evaluate:async()=>({error:'upstream_http'})}};const system={config:{modelList:[{name:'models/fallback'}]},browserManager:{contexts:new Map([[0,{page}]])},connectionRegistry:{getConnectionByAuth:()=>({readyState:1})}};const c=new Catalog(system);assert.equal((await c.list())[0].name,'models/fallback');
});
