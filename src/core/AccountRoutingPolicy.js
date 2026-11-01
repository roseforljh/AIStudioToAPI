"use strict";
const fs = require('fs');
const path = require('path');
const { cleanModel } = require('./ModelTransportPolicy');
class AccountRoutingPolicy {
    constructor(scanner, config) {
        this.scanner = scanner; this.config = config;
        this.path = path.join(process.cwd(), 'data', 'account-routing-policy.json');
        this.settings = { paidActive: 3, paidStandby: 2, normalActive: 2, normalStandby: 3 };
        this.modelEvidence = {};
        try { const d=JSON.parse(fs.readFileSync(this.path,'utf8')); this.settings={...this.settings,...d.settings}; this.modelEvidence=d.modelEvidence||{}; } catch {}
    }
    group(index) { return this.scanner.get(index)?.state === 'ready-paid' ? 'paid' : 'normal'; }
    update(value) {
        const keys=['paidActive','paidStandby','normalActive','normalStandby'];
        if (!value || keys.some(k => !Number.isInteger(value[k]) || value[k]<0 || value[k]>30)) throw new Error('Each count must be an integer between 0 and 30');
        const sum=keys.reduce((a,k)=>a+value[k],0);
        if (sum < 1 || sum > 30 || value.paidActive+value.normalActive < 1) throw new Error('Total must be 1–30 and at least one active account is required');
        this.settings=Object.fromEntries(keys.map(k=>[k,value[k]])); this.persist();
    }
    persist() { fs.mkdirSync(path.dirname(this.path),{recursive:true,mode:0o700}); const p=this.path+'.tmp';fs.writeFileSync(p,JSON.stringify({settings:this.settings,modelEvidence:this.modelEvidence}),{mode:0o600});fs.renameSync(p,this.path); }
    targets(indices) {
        const list=[...new Set(indices)];
        const paid=list.filter(i=>this.group(i)==='paid').slice(0,this.settings.paidActive+this.settings.paidStandby);
        const normal=list.filter(i=>this.group(i)==='normal').slice(0,this.settings.normalActive+this.settings.normalStandby);
        return [...paid,...normal];
    }
    order(indices) {
        const list=[...new Set(indices)]; const p=list.filter(i=>this.group(i)==='paid'), n=list.filter(i=>this.group(i)==='normal');
        const selected=[...p.slice(0,this.settings.paidActive+this.settings.paidStandby),...n.slice(0,this.settings.normalActive+this.settings.normalStandby)];
        return [...selected,...list.filter(i=>!selected.includes(i))];
    }
    choose(ready, unavailable = () => false) {
        const ordered=[...new Set(ready)].filter(i=>Number.isInteger(i)&&i>=0&&!unavailable(i));
        const paid=ordered.filter(i=>this.group(i)==='paid').slice(0,this.settings.paidActive);
        const normal=ordered.filter(i=>this.group(i)==='normal').slice(0,this.settings.normalActive);
        return [...paid,...normal];
    }
    isPaidOnly(model) { return /^gemini-4-argon$/i.test(cleanModel(String(model || ''))); }
    noteDenied(index, model) { this.markUnsupported(index, model, 600000); }
    blocked(index,model) { model=cleanModel(String(model||'')); const x=this.modelEvidence[model]?.[index];return !!x && x.until>Date.now() && x.fingerprint===this.scanner.fingerprint(index); }
    markUnsupported(index,model, durationMs=86400000) { model=cleanModel(String(model||'')); if (!model) return; const fingerprint=this.scanner.fingerprint(index);if(!fingerprint)return;this.modelEvidence[model] ||= {};this.modelEvidence[model][index]={until:Date.now()+durationMs,fingerprint};this.persist(); }
    clear(index,model) { model=cleanModel(String(model||'')); if (this.modelEvidence[model]?.[index]) {delete this.modelEvidence[model][index];this.persist();} }
}
module.exports=AccountRoutingPolicy;
