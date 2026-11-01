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
test('403 cooldown and success evidence are scoped per model and account', () => {
 const scanner={get:i=>({state:i===0?'ready-paid':'ready-free'}),fingerprint:i=>'fp'+i};const p=Object.create(Policy.prototype);p.scanner=scanner;p.modelEvidence={};p.persist=()=>{};
 p.noteDenied(1,'new-model');assert.equal(p.blocked(1,'new-model'),true);assert.equal(p.blocked(1,'other-model'),false);assert.equal(p.blocked(0,'new-model'),false);
 p.noteSuccess(1,'new-model');assert.equal(p.blocked(1,'new-model'),false);assert.equal(p.rank(1,'new-model'),0);assert.equal(p.rank(0,'new-model'),20);
});
test('fail-fast account transfer avoids immediate repeated 403 and does not block',async()=>{
 const b=new AccountLoadBalancer({getEligibleAuthIndices:()=>[0],maxConcurrentRequests:1,acquireTimeoutMs:10000});const lease=await b.acquire({allowed:new Set([0]),noCoolingFallback:true});
 await assert.rejects(lease.move({exclude:new Set([0]),release:{status:403},failFast:true}),{code:'ACCOUNT_ACQUIRE_TIMEOUT'});assert.equal(lease.authIndex,0);lease.release();
});
test('normal account is preferred and ranked known successes are chosen first', async () => {
 const scanner={get:i=>({state:i===0?'ready-paid':'ready-free'}),fingerprint:i=>'fp'+i};const p=Object.create(Policy.prototype);p.scanner=scanner;p.modelEvidence={};p.persist=()=>{};p.noteSuccess(2,'models/new-model');
 const b=new AccountLoadBalancer({getEligibleAuthIndices:()=>[0,1,2],maxConcurrentRequests:3});const first=await b.acquire({rank:i=>p.rank(i,'new-model')});assert.equal(first.authIndex,2);const second=await b.acquire({rank:i=>p.rank(i,'new-model')});assert.equal(second.authIndex,1);const third=await b.acquire({rank:i=>p.rank(i,'new-model')});assert.equal(third.authIndex,0);first.release();second.release();third.release();
});

test('known working paid account ranks before an untested normal account', () => {
 const p=Object.create(Policy.prototype);p.scanner={get:i=>({state:i===0?'ready-paid':'ready-free'}),fingerprint:i=>'fp'+i};p.modelEvidence={};p.persist=()=>{};p.noteSuccess(0,'new-model');assert.ok(p.rank(0,'new-model')<p.rank(1,'new-model'));
});
