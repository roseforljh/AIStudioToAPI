const { test } = require('node:test');
const assert = require('node:assert/strict');
const AccountLoadBalancer = require('../src/core/AccountLoadBalancer');
const Policy = require('../src/core/AccountRoutingPolicy');
test('separate pool selection honors quotas and never treats unknown as paid', () => {
 const scanner={get:i=>({state:i<3?'ready-paid':i===9?'unknown':'ready-free'}),fingerprint:i=>String(i)};
 const p=Object.create(Policy.prototype);p.scanner=scanner;p.settings={paidActive:2,paidStandby:1,normalActive:1,normalStandby:2};
 assert.deepEqual(p.choose([0,1,2,3,4,9]),[0,1,3]);
 assert.deepEqual(p.choose([0,1,2,3,4],i=>i===0),[1,2,3]);
 assert.deepEqual(p.order([3,4,5,0,1,2]),[0,1,2,3,4,5]);
});
test('model-filtered leases cannot fall back to a disallowed account', async () => {
 const b=new AccountLoadBalancer({getEligibleAuthIndices:()=>[0,1],maxConcurrentRequests:2,acquireTimeoutMs:25});
 const lease=await b.acquire({allowed:new Set([1])});assert.equal(lease.authIndex,1);
 await assert.rejects(b.acquire({allowed:new Set([1]),timeoutMs:25}), {code:'ACCOUNT_ACQUIRE_TIMEOUT'});lease.release();
});
test('paid-only model and temporary 403 cooldown are scoped to the account and model', () => {
 const scanner={get:i=>({state:i===0?'ready-paid':'ready-free'}),fingerprint:i=>'fp'+i};const p=Object.create(Policy.prototype);p.scanner=scanner;p.modelEvidence={};p.persist=()=>{};
 assert.equal(p.isPaidOnly('gemini-4-argon'),true);assert.equal(p.isPaidOnly('gemini-3.5-flash-lite'),false);
 p.noteDenied(1,'gemini-4-argon');assert.equal(p.blocked(1,'gemini-4-argon'),true);assert.equal(p.blocked(1,'gemini-3.5-flash-lite'),false);assert.equal(p.blocked(0,'gemini-4-argon'),false);
});
test('fail-fast account transfer avoids immediate repeated 403 and does not block',async()=>{
 const b=new AccountLoadBalancer({getEligibleAuthIndices:()=>[0],maxConcurrentRequests:1,acquireTimeoutMs:10000});const lease=await b.acquire({allowed:new Set([0]),noCoolingFallback:true});
 await assert.rejects(lease.move({exclude:new Set([0]),release:{status:403},failFast:true}),{code:'ACCOUNT_ACQUIRE_TIMEOUT'});assert.equal(lease.authIndex,0);lease.release();
});
test('paid-only protection also applies to model aliases and suffixes', () => {
 const p=Object.create(Policy.prototype); assert.equal(p.isPaidOnly('models/gemini-4-argon-search'),true);assert.equal(p.isPaidOnly('gemini-4-argon-fake'),true);
});
