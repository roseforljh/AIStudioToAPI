"use strict";
const fs = require("fs");
const path = require("path");
const { cleanModel } = require("./ModelTransportPolicy");
class AccountRoutingPolicy {
    constructor(scanner, config) {
        this.scanner = scanner;
        this.config = config;
        this.path = path.join(process.cwd(), "data", "account-routing-policy.json");
        this.settings = { normalActive: 2, normalStandby: 3, paidActive: 3, paidStandby: 2 };
        this.modelEvidence = {};
        // Learned, short-lived group restriction: e.g. a model rejected by a
        // standard account but accepted by a paid account. Never a hardcoded model list.
        this.groupEvidence = {};
        this.rotation = [];
        try {
            const d = JSON.parse(fs.readFileSync(this.path, "utf8"));
            this.settings = { ...this.settings, ...d.settings };
            this.modelEvidence = d.modelEvidence || {};
            this.groupEvidence = d.groupEvidence || {};
            this.rotation = Array.isArray(d.rotation) ? d.rotation : [];
        } catch {
            // Missing or unreadable saved state uses the default pool order.
        }
    }
    group(index) {
        return this.scanner.get(index)?.state === "ready-paid" ? "paid" : "normal";
    }
    update(value) {
        const keys = ["paidActive", "paidStandby", "normalActive", "normalStandby"];
        if (!value || keys.some(k => !Number.isInteger(value[k]) || value[k] < 0 || value[k] > 30))
            throw new Error("Each count must be an integer between 0 and 30");
        const sum = keys.reduce((a, k) => a + value[k], 0);
        if (sum < 1 || sum > 30 || value.paidActive + value.normalActive < 1)
            throw new Error("Total must be 1–30 and at least one active account is required");
        this.settings = Object.fromEntries(keys.map(k => [k, value[k]]));
        this.persist();
    }
    persist() {
        fs.mkdirSync(path.dirname(this.path), { mode: 0o700, recursive: true });
        const p = this.path + ".tmp";
        fs.writeFileSync(
            p,
            JSON.stringify({
                groupEvidence: this.groupEvidence,
                modelEvidence: this.modelEvidence,
                rotation: this.rotation,
                settings: this.settings,
            }),
            { mode: 0o600 }
        );
        fs.renameSync(p, this.path);
    }
    targets(indices, preferred = null) {
        let list = this.order(indices);
        if (preferred) list = [...list.filter(preferred), ...list.filter(i => !preferred(i))];
        const paid = list
            .filter(i => this.group(i) === "paid")
            .slice(0, this.settings.paidActive + this.settings.paidStandby);
        const normal = list
            .filter(i => this.group(i) === "normal")
            .slice(0, this.settings.normalActive + this.settings.normalStandby);
        return [...paid, ...normal];
    }
    order(indices) {
        const positions = new Map((this.rotation || []).map((index, position) => [index, position]));
        const list = [...new Set(indices.filter(i => Number.isInteger(i) && i >= 0))].sort(
            (a, b) => (positions.get(a) ?? Infinity) - (positions.get(b) ?? Infinity) || a - b
        );
        const p = list.filter(i => this.group(i) === "paid"),
            n = list.filter(i => this.group(i) === "normal");
        const selected = [
            ...p.slice(0, this.settings.paidActive + this.settings.paidStandby),
            ...n.slice(0, this.settings.normalActive + this.settings.normalStandby),
        ];
        return [...selected, ...list.filter(i => !selected.includes(i))];
    }
    promote(index, previousIndex, indices) {
        const valid = new Set(indices);
        const rest = [...new Set([...(this.rotation || []), ...indices])].filter(
            i => valid.has(i) && i !== index && i !== previousIndex
        );
        this.rotation = [index, ...rest];
        if (previousIndex !== index && valid.has(previousIndex)) this.rotation.push(previousIndex);
        this.persist();
    }
    retire(index, indices) {
        const valid = new Set(indices.filter(i => Number.isInteger(i) && i >= 0));
        this.rotation = [...new Set([...(this.rotation || []), ...[...valid].sort((a, b) => a - b)])].filter(
            i => valid.has(i) && i !== index
        );
        // Recovery must rejoin behind the replacements, including after a restart.
        if (valid.has(index)) this.rotation.push(index);
        this.persist();
    }
    choose(ready, unavailable = () => false) {
        const ordered = this.order(ready).filter(i => !unavailable(i));
        const paid = ordered.filter(i => this.group(i) === "paid").slice(0, this.settings.paidActive);
        const normal = ordered.filter(i => this.group(i) === "normal").slice(0, this.settings.normalActive);
        return [...paid, ...normal];
    }
    evidence(index, model) {
        model = cleanModel(String(model || ""));
        const entry = this.modelEvidence[model]?.[index];
        return entry && entry.fingerprint === this.scanner.fingerprint(index) ? entry : null;
    }
    blocked(index, model) {
        const entry = this.evidence(index, model);
        return !!entry && entry.until > Date.now();
    }
    rank(index, model) {
        const entry = this.evidence(index, model);
        const recentSuccess = entry?.successAt && Date.now() - entry.successAt < 7 * 86400000;
        return recentSuccess ? 0 : this.group(index) === "normal" ? 10 : 20;
    }
    noteSuccess(index, model) {
        model = cleanModel(String(model || ""));
        const fingerprint = this.scanner.fingerprint(index);
        if (!model || !fingerprint) return;
        this.modelEvidence[model] ||= {};
        const old = this.evidence(index, model) || {};
        this.modelEvidence[model][index] = {
            fingerprint,
            successAt: Date.now(),
            successes: Math.min(100000, (old.successes || 0) + 1),
            until: 0,
        };
        const group = this.group(index);
        if (this.groupEvidence?.[model]?.[group]) delete this.groupEvidence[model][group];
        this.persist();
    }
    groupDenied(group, model) {
        model = cleanModel(String(model || ""));
        const until = this.groupEvidence?.[model]?.[group];
        return !!until && until > Date.now();
    }
    markGroupDenied(group, model, durationMs = 600000) {
        model = cleanModel(String(model || ""));
        if (!model) return;
        (this.groupEvidence ||= {})[model] ||= {};
        this.groupEvidence[model][group] = Date.now() + durationMs;
        this.persist();
    }
    clearGroupDenied(model) {
        model = cleanModel(String(model || ""));
        if (this.groupEvidence?.[model]) {
            delete this.groupEvidence[model];
            this.persist();
        }
    }
    noteDenied(index, model, options = {}) {
        this.markUnsupported(index, model, options.accountMs || 600000);
    }
    markUnsupported(index, model, durationMs = 86400000) {
        model = cleanModel(String(model || ""));
        if (!model) return;
        const fingerprint = this.scanner.fingerprint(index);
        if (!fingerprint) return;
        this.modelEvidence[model] ||= {};
        const old = this.evidence(index, model) || {};
        this.modelEvidence[model][index] = {
            ...old,
            fingerprint,
            lastDeniedAt: Date.now(),
            until: Date.now() + durationMs,
        };
        this.persist();
    }
    clear(index, model) {
        this.noteSuccess(index, model);
    }
}
module.exports = AccountRoutingPolicy;
