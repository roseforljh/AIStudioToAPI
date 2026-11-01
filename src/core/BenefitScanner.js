/* Background entitlement observations. Never stores cookies or authorization headers. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { BuildBenefitContext } = require('./BuildBenefitContext');
const { parseProxyFromEnv } = require('../utils/ProxyUtils');
class BenefitScanner {
    constructor(system) {
        this.system = system; this.path = path.join(process.cwd(), 'data', 'benefit-observations.json');
        this.records = {}; this.running = false; this.queued = new Set(); this.progress = { total: 0, completed: 0, currentIndex: null, running: false, error: null };
        try { this.records = JSON.parse(fs.readFileSync(this.path, 'utf8')).records || {}; } catch {}
    }
    fingerprint(index) {
        try {
            const auth = this.system.authSource.getAuth(index);
            if (!auth) return null;
            const cookies = (auth.cookies || []).filter(c => /google\./i.test(c.domain || '')).map(c => [c.domain, c.name, c.value]).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
            return crypto.createHash('sha256').update(JSON.stringify(cookies)).digest('hex');
        } catch { return null; }
    }
    get(index) {
        const r = this.records[index], hash = this.fingerprint(index);
        return r && hash && r.hash === hash ? r : null;
    }
    save(index, hash, state, reason) {
        if (!hash || this.fingerprint(index) !== hash) return;
        const prev = this.records[index];
        if (state !== 'ready-paid' && state !== 'ready-free' && prev && prev.hash === hash && ['ready-paid','ready-free'].includes(prev.state)) {
            this.records[index] = { ...prev, lastAttempt: Date.now(), lastError: reason || 'unknown' };
        } else this.records[index] = { hash, state, checkedAt: Date.now(), lastAttempt: Date.now(), lastError: reason || null };
        fs.mkdirSync(path.dirname(this.path), {recursive:true, mode:0o700});
        const temp = this.path + '.tmp'; fs.writeFileSync(temp, JSON.stringify({records:this.records}), {mode:0o600}); fs.renameSync(temp, this.path);
        const manager = this.system.browserManager;
        if (prev?.state !== state && manager?.config?.accountLoadBalancing) manager.rebalanceContextPool().catch(() => {});
    }
    enqueue(index) {
        if (!Number.isSafeInteger(index) || index < 0) return false;
        this.queued.add(index);
        if (!this.running) this._drainQueue();
        return true;
    }
    _drainQueue() {
        if (this.running || !this.queued.size) return;
        const indices = [...this.queued]; this.queued.clear();
        this.start(true, indices);
    }
    start(force = false, selected = null) {
        if (this.running) return false;
        this.running = true;
        this.progress = { total: 0, completed: 0, currentIndex: null, running: true, error: null };
        this.run(force, selected).catch(error => { this.progress.error = "scan_failed"; this.system.logger.warn(`[BenefitScan] stopped: ${error.name}`); }).finally(() => { this.running = false; this.progress.running = false; this.progress.currentIndex = null; this.progress.finishedAt = Date.now(); this._drainQueue(); });
        return true;
    }
    async run(force, selected = null) {
        const manager = this.system.browserManager, auth = this.system.authSource;
        auth.reloadAuthSources();
        const indices = (selected || [...auth.initialIndices]).filter(index => auth.initialIndices.includes(index)).filter(index => {
            const existing = this.get(index);
            return force || !existing || Date.now() - (existing.lastAttempt || 0) >= (existing.state === 'ready-paid' || existing.state === 'ready-free' ? 7*86400000 : 86400000);
        });
        this.progress.total = indices.length;
        for (const index of indices) {
            this.progress.currentIndex = index;
            this.system.logger.info(`[BenefitScan] checking account #${index}`);
            const hash = this.fingerprint(index);
            if (!hash || auth.expiredIndices.includes(index)) { this.save(index, hash, 'unknown', 'invalid_or_expired'); this.progress.completed++; continue; }
            let context, benefit;
            try {
                while (!manager.browser || !manager.browser.isConnected()) await new Promise(r=>setTimeout(r,10000));
                const active = manager.contexts.get(index)?.page;
                if (active?.buildBenefit && !active.isClosed()) benefit = active.buildBenefit;
                else {
                    const sticky = manager.stickyProxyManager.getProxyForAuth(index);
                    const proxy = sticky ? sticky.proxy : parseProxyFromEnv();
                    context = await manager.browser.newContext({storageState:auth.getAuth(index), ...(proxy ? {proxy} : {})});
                    const page = await context.newPage();
                    benefit = new BuildBenefitContext(page, {authIndex:index, timeoutMs:8000});
                    benefit.dispatcher = true;
                    await benefit.install();
                    await page.goto(manager.targetUrl, {waitUntil:'domcontentloaded', timeout:45000});
                    await page.waitForTimeout(7000);
                }
                let state = await benefit.ensure({refresh:true});
                if (state === 'failed' && benefit.failureReason === 'auth_unavailable') {
                    await new Promise(r=>setTimeout(r,5000)); state = await benefit.ensure({refresh:true});
                }
                this.save(index, hash, ['ready-paid','ready-free'].includes(state) ? state : 'unknown', benefit.failureReason);
                this.system.logger.info(`[BenefitScan] account #${index} finished: ${state}`);
            } catch (error) { this.system.logger.warn(`[BenefitScan] account #${index} failed: ${error.name}`); this.save(index, hash, 'unknown', 'check_failed'); }
            finally { if (context) await context.close().catch(()=>{}); }
            this.progress.completed++;
            await new Promise(r=>setTimeout(r,1500));
        }
    }
}
module.exports = BenefitScanner;
