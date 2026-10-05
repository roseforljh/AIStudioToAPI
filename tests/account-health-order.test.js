const { test } = require('node:test');
const assert = require('node:assert/strict');
const Health = require('../src/core/AccountHealth');
const Rotation = require('../src/core/AccountPoolRotation');
const BrowserManager = require('../src/core/BrowserManager');
const AuthSource = require('../src/auth/AuthSource');

test('ordering is ascending, unique, independent of saved cursor', () => {
    const r = Object.create(Rotation.prototype); r.lastAttempt = 40;
    assert.deepEqual(r.order([40,3,8,5,3,NaN,-1,null,6]), [3,5,6,8,40]);
    r.lastAttempt = 999;
    assert.deepEqual(r.order([12,10,11]), [10,11,12]);
    assert.deepEqual(r.order([]), []);
});
test('temporary failures never recommend deletion', () => {
    const h = new Health();
    for (const msg of ['Timeout 30000ms', '429 quota exceeded', '403 Forbidden', 'net::ERR_FAILED', 'The current IP does not support access', 'unknown failure']) {
        const v = h.record(1, new Error(msg));
        assert.equal(v.deletable, false); assert.equal(v.severity, 'warning');
    }
    assert.equal(h.record(1, new Error('aborted'), {aborted:true}).deletable, false);
});
test('confirmed expiry is visible and success clears diagnostics', () => {
    const h = new Health();
    const v = h.record(7, new Error('expired'), {expired:true});
    assert.equal(v.deletable, true); assert.equal(v.code, 'AUTH_EXPIRED');
    assert.equal(h.get(7).severity, 'error');h.clear(7);assert.equal(h.get(7),null);
});
test('diagnostics never echo raw secrets', () => {
    const h = new Health();const secret = 'test-only-private-cookie-value';
    assert.ok(!JSON.stringify(h.record(2,new Error(secret))).includes(secret));
});
test('all initialization callers pass through diagnostic wrapper', async () => {
    const h = new Health();
    const b = { accountHealth:h, _initializeContextWithHealth: async () => { throw new Error('Timeout'); } };
    await assert.rejects(BrowserManager.prototype._initializeContext.call(b, 1, true));
    assert.equal(h.get(1).code,'TIMEOUT');
    b._initializeContextWithHealth = async () => ({ok:true});
    assert.deepEqual(await BrowserManager.prototype._initializeContext.call(b,1),{ok:true});
    assert.equal(h.get(1),null);
});
test('invalid auth JSON stays in inventory but is excluded from available accounts', () => {
    const docs = ['{broken','{}',JSON.stringify({cookies:[]}),JSON.stringify({cookies:[{name:'n',value:'fixture'}]}),JSON.stringify({cookies:[{name:'n',value:'fixture'}],expired:true}),JSON.stringify({cookies:[{name:4,value:'fixture'}]})];
    const a=Object.create(AuthSource.prototype);
    Object.assign(a,{initialIndices:[0,1,2,3,4,5],accountNameMap:new Map(),canonicalIndexMap:new Map(),duplicateGroups:[],logger:{warn(){}},_getAuthContent:i=>docs[i],_buildRotationIndices(){}});
    a._preValidateAndFilter();
    assert.deepEqual(a.initialIndices,[0,1,2,3,4,5]);
    assert.deepEqual(a.availableIndices,[3,4]);assert.deepEqual(a.expiredIndices,[4]);
});
