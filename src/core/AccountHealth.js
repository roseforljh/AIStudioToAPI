"use strict";
// Fixed public messages only: never expose raw errors, credentials or account names.
class AccountHealth {
    constructor() { this.issues = new Map(); }
    clear(index) { this.issues.delete(index); }
    get(index) { return this.issues.get(index) || null; }
    record(index, error, { expired = false, aborted = false } = {}) {
        const text = String(error?.message || "");
        let code = "INIT_FAILED", message = "初始化失败，原因未确认；请重试，暂勿删除认证文件";
        let severity = "warning", deletable = false;
        if (aborted) {
            code = "INTERRUPTED"; message = "加载被中断（切换或账号列表变动），不代表认证失效";
        } else if (expired) {
            code = "AUTH_EXPIRED"; message = "认证已失效：跳转到 Google 登录页；需要重新登录或删除文件";
            severity = "error"; deletable = true;
        } else if (/current IP|available regions|region.*support|change the IP/i.test(text)) {
            code = "REGION_BLOCKED"; message = "服务器 IP 或地区无法访问 AI Studio，不是认证文件失效";
        } else if (/429|quota|rate.limit/i.test(text)) {
            code = "RATE_LIMITED"; message = "限流或配额不足，待冷却后重试；不建议删除";
        } else if (/timeout|timed out|ETIMEDOUT/i.test(text)) {
            code = "TIMEOUT"; message = "加载超时，未确认认证失效；请重试";
        } else if (/403|forbidden|permission.denied/i.test(text)) {
            code = "ACCESS_DENIED"; message = "访问被拒绝，可能与权限或风控有关；需复核，暂勿删除";
        } else if (/net::|ECONN|ENOTFOUND|socket|network|browser.*closed/i.test(text)) {
            code = "NETWORK_ERROR"; message = "网络或浏览器异常，未确认认证失效；请重试";
        }
        const issue = { code, message, severity, deletable, updatedAt: Date.now() };
        this.issues.set(index, issue); return issue;
    }
}
module.exports = AccountHealth;
