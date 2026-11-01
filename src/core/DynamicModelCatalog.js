'use strict';
class DynamicModelCatalog {
    constructor(system, options = {}) {
        this.system = system;
        this.ttl = options.ttl || 300000;
        this.perAccount = new Map();
        this.inflight = null;
    }
    async fetchForAccount(index) {
        const page = this.system.browserManager.contexts.get(index)?.page;
        if (!page || page.isClosed() || !page.buildBenefit) throw new Error('account_not_connected');
        const result = await page.buildBenefit._evaluate(async () => {
            const s=window.__buildBenefit;
            if (!s?.auth || !s.nativeFetch) return {error:'auth_unavailable'};
            const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),12000);
            try {
                const url='https://alkalimakersuite-pa.clients6.google.com/$rpc/google.internal.alkali.applications.makersuite.v1.MakerSuiteService/ListModels';
                const r=await s.nativeFetch(url,{method:'POST',credentials:'include',headers:{...s.auth,'content-type':'application/json+protobuf'},body:'[]',signal:ctrl.signal});
                if(!r.ok) return {error:'upstream_http',status:r.status};
                const d=await r.json();
                if(!Array.isArray(d)||!Array.isArray(d[0]))return {error:'unexpected_response'};
                const models=d[0].filter(x=>Array.isArray(x)&&typeof x[0]==='string'&&/^models\/[A-Za-z0-9._-]+$/.test(x[0])).map(x=>({name:x[0],displayName:typeof x[3]==='string'?x[3].slice(0,150):x[0],inputTokenLimit:Number.isFinite(x[5])&&x[5]>0?x[5]:undefined,outputTokenLimit:Number.isFinite(x[6])&&x[6]>0?x[6]:undefined,supportedGenerationMethods:Array.isArray(x[7])?x[7].filter(y=>typeof y==='string').slice(0,20):[]}));
                return models.length ? {models:models.slice(0,500)} : {error:'empty_or_unrecognized'};
            } catch {return {error:'request_failed'};} finally {clearTimeout(timer);}
        });
        if(result.error) throw Object.assign(new Error(result.error),{status:result.status});
        this.perAccount.set(index,{models:result.models,at:Date.now(),page});
        return result.models;
    }
    async list() {
        if(this.inflight) return this.inflight;
        const fresh=()=>[...this.perAccount.entries()].filter(([i,x])=>Date.now()-x.at<this.ttl && this.system.browserManager.contexts.get(i)?.page===x.page).flatMap(([,x])=>x.models);
        const cached=fresh();
        if(cached.length) return this.merge(cached);
        this.inflight=(async()=>{
            const connected=[...this.system.browserManager.contexts.entries()].filter(([i,x])=>x.page&&!x.page.isClosed()&&this.system.connectionRegistry.getConnectionByAuth(i,false)?.readyState===1);
            for(const [i] of connected.slice(0,3)) { try { await this.fetchForAccount(i); } catch {} }
            return this.merge(fresh());
        })();
        try{return await this.inflight;}finally{this.inflight=null;}
    }
    merge(dynamic) {
        const list=new Map();
        for(const item of this.system.config.modelList||[]) if(item?.name) list.set(item.name,{...item});
        for(const item of dynamic) if(item?.name) list.set(item.name,{...(list.get(item.name)||{}),...item});
        return [...list.values()].sort((a,b)=>a.name.localeCompare(b.name));
    }
}
module.exports=DynamicModelCatalog;
