"use strict";

/**
 * UploadSessionAffinity
 *
 * Google 的 Files API 用的是「可续传上传会话」（resumable upload session）：
 * 1. `POST /upload/v1beta/files` + `x-goog-upload-command: start` 创建会话，返回 `x-goog-upload-url`；
 * 2. 客户端再向该 URL 提交数据（`upload, finalize`）。
 *
 * 这个会话**绑定在创建它的那个已登录 Google 账号上**。本项目的账号负载均衡会把
 * 这两个请求当成独立请求分给不同账号，于是 finalize 阶段 Google 直接返回
 * `500 INTERNAL`（已通过对照实验证实：同账号 200、跨账号 500）。
 *
 * 本模块记录「上传会话 / 已上传文件 -> 账号」的粘性绑定，让同一会话的后续请求
 * 以及引用该文件的生成请求回到正确的账号，并在进程重启后从磁盘恢复。
 */
class UploadSessionAffinity {
    static get SESSION_PARAM() {
        return "resumable_upload_session_id";
    }

    static get SESSION_PREFIX() {
        return "upload:";
    }

    static get FILE_PREFIX() {
        return "file:";
    }

    constructor(options = {}) {
        this.sessionTtlMs = Math.max(1000, Number(options.sessionTtlMs) || 2 * 60 * 60 * 1000);
        this.fileTtlMs = Math.max(1000, Number(options.fileTtlMs) || 48 * 60 * 60 * 1000);
        this.maxEntries = Math.max(10, Number(options.maxEntries) || 5000);
        this.now = typeof options.now === "function" ? options.now : Date.now;
        this.logger = options.logger || null;
        this.filePath = options.filePath || null;
        this.persistDelayMs =
            options.persistDelayMs === undefined ? 250 : Math.max(0, Number(options.persistDelayMs) || 0);
        this.entries = new Map();
        this.persistTimer = null;
        this.stats = { sessionHits: 0, sessionMisses: 0, fileHits: 0, conflicts: 0 };
        if (this.filePath) this._load();
    }

    static _firstValue(value) {
        if (Array.isArray(value)) return value.length ? String(value[0]) : null;
        if (value === undefined || value === null) return null;
        const text = String(value);
        return text.length ? text : null;
    }

    /** 从 query / 原始 URL 中取出 resumable_upload_session_id */
    static extractUploadSessionId(source = {}) {
        const queryParams = source.queryParams || source.query || null;
        if (queryParams) {
            const direct = UploadSessionAffinity._firstValue(queryParams[UploadSessionAffinity.SESSION_PARAM]);
            if (direct) return direct;
        }
        const rawUrl = source.rawUrl || source.originalUrl || source.url || "";
        const queryIndex = rawUrl.indexOf("?");
        if (queryIndex >= 0) {
            try {
                const params = new URLSearchParams(rawUrl.slice(queryIndex + 1));
                const value = params.get(UploadSessionAffinity.SESSION_PARAM);
                if (value) return value;
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    /** 从路径中取出文件 ID：/v1beta/files/abc123 -> abc123 */
    static extractFileIdFromPath(requestPath) {
        if (!requestPath || typeof requestPath !== "string") return null;
        const match = requestPath.match(/\/files\/([A-Za-z0-9_-]{1,128})(?:$|[/?])/);
        return match ? match[1] : null;
    }

    /**
     * 从请求体中取出被引用的文件 ID（fileData.fileUri / file_uri / fileId 等）。
     * 先尝试 JSON 解析，失败时退化为严格正则，避免把普通文本里的 "files/xxx" 误判成引用。
     */
    static extractFileIds(bodyBuffer) {
        if (!bodyBuffer || !bodyBuffer.length) return [];
        const text = Buffer.isBuffer(bodyBuffer) ? bodyBuffer.toString("utf8") : String(bodyBuffer);
        if (!text.includes("files/")) return [];

        const ids = new Set();
        const collect = value => {
            if (typeof value !== "string") return;
            const match = value.match(/files\/([A-Za-z0-9_-]{1,128})/);
            if (match) ids.add(match[1]);
        };
        const walk = (node, depth) => {
            if (depth > 12 || node === null || typeof node !== "object") return;
            if (Array.isArray(node)) {
                for (const item of node) walk(item, depth + 1);
                return;
            }
            for (const [key, value] of Object.entries(node)) {
                const normalizedKey = key.toLowerCase();
                if (
                    typeof value === "string" &&
                    (normalizedKey === "fileuri" ||
                        normalizedKey === "file_uri" ||
                        normalizedKey === "uri" ||
                        normalizedKey === "fileid" ||
                        normalizedKey === "file_id" ||
                        normalizedKey === "name")
                ) {
                    collect(value);
                } else {
                    walk(value, depth + 1);
                }
            }
        };

        try {
            walk(JSON.parse(text), 0);
        } catch (e) {
            const pattern = /"(?:fileUri|file_uri|fileId|file_id|uri)"\s*:\s*"([^"]*)"/gi;
            let match;
            while ((match = pattern.exec(text)) !== null) collect(match[1]);
        }
        return [...ids];
    }

    bindUploadSession(sessionId, authIndex, meta = {}) {
        return this._bind(UploadSessionAffinity.SESSION_PREFIX + sessionId, authIndex, this.sessionTtlMs, {
            kind: "upload-session",
            ...meta,
        });
    }

    bindFile(fileId, authIndex, meta = {}) {
        return this._bind(UploadSessionAffinity.FILE_PREFIX + fileId, authIndex, this.fileTtlMs, {
            kind: "file",
            ...meta,
        });
    }

    _bind(key, authIndex, ttlMs, meta) {
        const index = Number(authIndex);
        if (!Number.isInteger(index) || index < 0) return null;
        const existing = this.entries.get(key);
        const entry = { authIndex: index, expiresAt: this.now() + ttlMs, ...meta };
        this.entries.set(key, entry);
        if (existing && existing.authIndex !== index) {
            this.logger?.warn?.(
                `[Affinity] Binding ${key} moved from account #${existing.authIndex} to account #${index}.`
            );
        }
        this._enforceLimits();
        this._schedulePersist();
        return entry;
    }

    /** 返回绑定的账号，未命中或已过期返回 null */
    resolve(key) {
        const entry = this.entries.get(key);
        if (!entry) return null;
        if (entry.expiresAt <= this.now()) {
            this.entries.delete(key);
            this._schedulePersist();
            return null;
        }
        return entry.authIndex;
    }

    forget(key) {
        if (this.entries.delete(key)) this._schedulePersist();
    }

    /**
     * 综合上传会话 ID 与文件引用，得出应使用的账号。
     * @returns {{authIndex:number, source:string, fileIds?:string[]}|null}
     */
    resolvePinnedAuthIndex({ uploadSessionId = null, fileIds = [] } = {}) {
        this.prune();
        if (uploadSessionId) {
            const authIndex = this.resolve(UploadSessionAffinity.SESSION_PREFIX + uploadSessionId);
            if (authIndex !== null) {
                this.stats.sessionHits++;
                return { authIndex, source: "upload-session" };
            }
            this.stats.sessionMisses++;
        }

        const owners = [];
        for (const fileId of fileIds) {
            const authIndex = this.resolve(UploadSessionAffinity.FILE_PREFIX + fileId);
            if (authIndex !== null) owners.push({ fileId, authIndex });
        }
        if (owners.length === 0) return null;

        const distinct = new Set(owners.map(owner => owner.authIndex));
        if (distinct.size > 1) {
            this.stats.conflicts++;
            this.logger?.warn?.(
                `[Affinity] Request references files owned by different accounts ` +
                    `(${owners.map(o => `${o.fileId}=#${o.authIndex}`).join(", ")}); skipping affinity pin.`
            );
            return null;
        }
        this.stats.fileHits++;
        return { authIndex: owners[0].authIndex, source: "file-owner", fileIds: owners.map(o => o.fileId) };
    }

    prune() {
        const now = this.now();
        let removed = 0;
        for (const [key, entry] of this.entries) {
            if (entry.expiresAt <= now) {
                this.entries.delete(key);
                removed++;
            }
        }
        if (removed > 0) this._schedulePersist();
        return removed;
    }

    _enforceLimits() {
        this.prune();
        if (this.entries.size <= this.maxEntries) return;
        const overflow = this.entries.size - this.maxEntries;
        const ordered = [...this.entries.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
        for (let index = 0; index < overflow; index++) {
            this.entries.delete(ordered[index][0]);
        }
    }

    getStats() {
        return { size: this.entries.size, ...this.stats };
    }

    _load() {
        try {
            if (!this.filePath || !require("fs").existsSync(this.filePath)) return;
            const raw = require("fs").readFileSync(this.filePath, "utf8");
            const parsed = JSON.parse(raw);
            const entries = parsed?.entries && typeof parsed.entries === "object" ? parsed.entries : {};
            const now = this.now();
            for (const [key, value] of Object.entries(entries)) {
                const authIndex = Number(value?.authIndex);
                const expiresAt = Number(value?.expiresAt);
                if (!Number.isInteger(authIndex) || authIndex < 0) continue;
                if (!Number.isFinite(expiresAt) || expiresAt <= now) continue;
                this.entries.set(key, { authIndex, expiresAt });
            }
            this.logger?.info?.(`[Affinity] Restored ${this.entries.size} affinity binding(s) from disk.`);
        } catch (error) {
            this.logger?.warn?.(`[Affinity] Failed to restore bindings: ${error.message}`);
        }
    }

    _schedulePersist() {
        if (!this.filePath || this.persistDelayMs === 0) {
            if (this.filePath && this.persistDelayMs === 0) this.flushSync();
            return;
        }
        if (this.persistTimer) return;
        this.persistTimer = setTimeout(() => {
            this.persistTimer = null;
            this.flushSync();
        }, this.persistDelayMs);
        this.persistTimer.unref?.();
    }

    flushSync() {
        if (!this.filePath) return false;
        try {
            const fs = require("fs");
            const path = require("path");
            const entries = {};
            for (const [key, entry] of this.entries) {
                entries[key] = { authIndex: entry.authIndex, expiresAt: entry.expiresAt };
            }
            const payload = JSON.stringify({ version: 1, savedAt: new Date(this.now()).toISOString(), entries }, null, 2);
            fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
            const tempPath = `${this.filePath}.tmp`;
            fs.writeFileSync(tempPath, payload, "utf8");
            fs.renameSync(tempPath, this.filePath);
            return true;
        } catch (error) {
            this.logger?.warn?.(`[Affinity] Failed to persist bindings: ${error.message}`);
            return false;
        }
    }
}

module.exports = UploadSessionAffinity;
