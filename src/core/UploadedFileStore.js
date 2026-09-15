"use strict";

/**
 * UploadedFileStore
 *
 * 通过本代理上传到 Google Files API 的文件的字节缓存。
 *
 * 背景：浏览器自动化链路里，Google 会拒绝对 Files API 文件引用（fileData.fileUri）的
 * 生成请求（实测返回 500 INTERNAL，真实来自上游 fetch）；而内联 base64（inlineData）
 * 是通的。所以把客户端上传时分块送进来的字节存到本地，生成请求引用同一文件时改写为
 * inlineData，视频/图片就能真正被模型看到。
 *
 * 落盘布局：
 *   <dir>/sessions/<sessionId>.part   进行中的可续传上传（按 offset 定位写入）
 *   <dir>/files/<fileId>.bin          已提交的文件内容
 *   <dir>/index.json                  索引（fileId -> 大小/时间），重启后可继续内联
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
const DEFAULT_MAX_FILE_BYTES = 256 * 1024 * 1024;
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
const INDEX_VERSION = 1;

class UploadedFileStore {
    constructor(options = {}) {
        this.dir = options.dir || null;
        this.sessionsDir = this.dir ? path.join(this.dir, "sessions") : null;
        this.filesDir = this.dir ? path.join(this.dir, "files") : null;
        this.indexPath = this.dir ? path.join(this.dir, "index.json") : null;
        this.maxTotalBytes = UploadedFileStore._positiveInt(options.maxTotalBytes, DEFAULT_MAX_TOTAL_BYTES);
        this.maxFileBytes = UploadedFileStore._positiveInt(options.maxFileBytes, DEFAULT_MAX_FILE_BYTES);
        this.ttlMs = UploadedFileStore._positiveInt(options.ttlMs, DEFAULT_TTL_MS);
        this.logger = options.logger || null;
        this.now = typeof options.now === "function" ? options.now : Date.now;

        /** @type {Map<string, {size:number, mimeType:string|null, createdAt:number, expiresAt:number}>} */
        this.index = new Map();
        /** @type {Map<string, {fd:number, written:number, createdAt:number}>} */
        this.sessions = new Map();
        this.totalBytes = 0;

        if (this.dir) {
            fs.mkdirSync(this.sessionsDir, { recursive: true });
            fs.mkdirSync(this.filesDir, { recursive: true });
            this._loadIndex();
        }
    }

    get enabled() {
        return Boolean(this.dir);
    }

    static _positiveInt(value, fallback) {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
    }

    static sanitizeId(id) {
        if (id === undefined || id === null) return null;
        const cleaned = String(id).replace(/[^A-Za-z0-9_.-]/g, "");
        return cleaned.length > 0 && cleaned.length <= 200 ? cleaned : null;
    }

    _sessionPath(sessionId) {
        return path.join(this.sessionsDir, `${sessionId}.part`);
    }

    _filePath(fileId) {
        return path.join(this.filesDir, `${fileId}.bin`);
    }

    // === 进行中的上传 ===

    /**
     * 按 offset 写入一个上传分块（重复写入同一 offset 是幂等的，便于代理层重试）。
     */
    appendChunk(sessionId, offset, buffer) {
        if (!this.enabled || !buffer || !buffer.length) return false;
        const id = UploadedFileStore.sanitizeId(sessionId);
        const start = Number(offset);
        if (!id || !Number.isFinite(start) || start < 0) return false;
        if (start + buffer.length > this.maxFileBytes) {
            this._warn(`upload for session ${id} exceeds max file size (${this.maxFileBytes} bytes); not caching`);
            this.abortSession(id);
            return false;
        }

        let session = this.sessions.get(id);
        try {
            if (!session) {
                session = {
                    createdAt: this.now(),
                    fd: fs.openSync(this._sessionPath(id), "w+"),
                    written: 0,
                };
                this.sessions.set(id, session);
            }
            fs.writeSync(session.fd, buffer, 0, buffer.length, start);
            session.written = Math.max(session.written, start + buffer.length);
            return true;
        } catch (error) {
            this._warn(`failed to cache upload chunk for session ${id}: ${error.message}`);
            this.abortSession(id);
            return false;
        }
    }

    /**
     * 上传成功后把会话字节提交为文件内容。
     * @returns {{ok:boolean, size?:number, reason?:string}}
     */
    commitSession(sessionId, fileId, options = {}) {
        if (!this.enabled) return { ok: false, reason: "disabled" };
        const sessionKey = UploadedFileStore.sanitizeId(sessionId);
        const fileKey = UploadedFileStore.sanitizeId(fileId);
        if (!sessionKey || !fileKey) return { ok: false, reason: "invalid-id" };
        const session = this.sessions.get(sessionKey);
        if (!session) return { ok: false, reason: "no-session" };

        const expectedSize = Number(options.expectedSize);
        if (Number.isFinite(expectedSize) && expectedSize > 0 && expectedSize !== session.written) {
            this.abortSession(sessionKey);
            return { ok: false, reason: `size-mismatch:${session.written}!=${expectedSize}` };
        }
        if (session.written <= 0) {
            this.abortSession(sessionKey);
            return { ok: false, reason: "empty" };
        }

        try {
            fs.closeSync(session.fd);
            this.sessions.delete(sessionKey);
            fs.renameSync(this._sessionPath(sessionKey), this._filePath(fileKey));
            const size = session.written;
            this.index.set(fileKey, {
                createdAt: this.now(),
                expiresAt: this.now() + this.ttlMs,
                mimeType: options.mimeType || null,
                size,
            });
            this._recountTotal();
            this._prune();
            this._saveIndex();
            this._info(`cached uploaded file ${fileKey} (${size} bytes) for inline delivery`);
            return { ok: true, size };
        } catch (error) {
            this._warn(`failed to commit upload session ${sessionKey}: ${error.message}`);
            this.abortSession(sessionKey);
            return { ok: false, reason: error.message };
        }
    }

    abortSession(sessionId) {
        const id = UploadedFileStore.sanitizeId(sessionId);
        if (!id) return;
        const session = this.sessions.get(id);
        if (session) {
            try {
                fs.closeSync(session.fd);
            } catch (error) {
                /* ignore */
            }
            this.sessions.delete(id);
        }
        if (!this.enabled) return;
        try {
            fs.unlinkSync(this._sessionPath(id));
        } catch (error) {
            /* already gone */
        }
    }

    // === 已提交的文件 ===

    getEntry(fileId) {
        if (!this.enabled) return null;
        const id = UploadedFileStore.sanitizeId(fileId);
        if (!id) return null;
        this._prune();
        const entry = this.index.get(id);
        if (!entry) return null;
        if (entry.expiresAt <= this.now()) {
            this.remove(id);
            return null;
        }
        const filePath = this._filePath(id);
        try {
            if (!fs.existsSync(filePath)) {
                this.index.delete(id);
                this._recountTotal();
                return null;
            }
        } catch (error) {
            return null;
        }
        return { ...entry, fileId: id, path: filePath };
    }

    readBuffer(fileId) {
        const entry = this.getEntry(fileId);
        if (!entry) return null;
        try {
            return fs.readFileSync(entry.path);
        } catch (error) {
            this._warn(`failed to read cached file ${fileId}: ${error.message}`);
            return null;
        }
    }

    remove(fileId) {
        if (!this.enabled) return false;
        const id = UploadedFileStore.sanitizeId(fileId);
        if (!id) return false;
        const existed = this.index.delete(id);
        try {
            fs.unlinkSync(this._filePath(id));
        } catch (error) {
            /* already gone */
        }
        if (existed) {
            this._recountTotal();
            this._saveIndex();
        }
        return existed;
    }

    getStats() {
        this._prune();
        return {
            enabled: this.enabled,
            entries: this.index.size,
            maxTotalBytes: this.maxTotalBytes,
            openSessions: this.sessions.size,
            totalBytes: this.totalBytes,
        };
    }

    close() {
        for (const sessionId of [...this.sessions.keys()]) this.abortSession(sessionId);
    }

    // === 内部 ===

    _recountTotal() {
        let total = 0;
        for (const entry of this.index.values()) total += entry.size || 0;
        this.totalBytes = total;
    }

    _prune() {
        if (!this.enabled) return;
        const now = this.now();
        let removed = false;
        for (const [fileId, entry] of [...this.index.entries()]) {
            if (entry.expiresAt <= now) {
                this.index.delete(fileId);
                try {
                    fs.unlinkSync(this._filePath(fileId));
                } catch (error) {
                    /* ignore */
                }
                removed = true;
            }
        }
        this._recountTotal();

        while (this.totalBytes > this.maxTotalBytes && this.index.size > 0) {
            let oldest = null;
            for (const [fileId, entry] of this.index.entries()) {
                if (!oldest || entry.createdAt < oldest.entry.createdAt) oldest = { entry, fileId };
            }
            if (!oldest) break;
            this.index.delete(oldest.fileId);
            try {
                fs.unlinkSync(this._filePath(oldest.fileId));
            } catch (error) {
                /* ignore */
            }
            removed = true;
            this._recountTotal();
        }

        // 过期仍未提交的上传会话
        try {
            for (const name of fs.readdirSync(this.sessionsDir)) {
                const sessionId = name.replace(/\.part$/, "");
                if (this.sessions.has(sessionId)) continue;
                const fullPath = path.join(this.sessionsDir, name);
                const stats = fs.statSync(fullPath);
                if (now - stats.mtimeMs > this.ttlMs) fs.unlinkSync(fullPath);
            }
        } catch (error) {
            /* ignore */
        }

        if (removed) this._saveIndex();
    }

    _loadIndex() {
        if (!this.indexPath) return;
        try {
            const raw = JSON.parse(fs.readFileSync(this.indexPath, "utf8"));
            const entries = raw && typeof raw.entries === "object" ? raw.entries : {};
            for (const [fileId, entry] of Object.entries(entries)) {
                const id = UploadedFileStore.sanitizeId(fileId);
                if (!id || !entry || typeof entry !== "object") continue;
                this.index.set(id, {
                    createdAt: Number(entry.createdAt) || this.now(),
                    expiresAt: Number(entry.expiresAt) || this.now() + this.ttlMs,
                    mimeType: typeof entry.mimeType === "string" ? entry.mimeType : null,
                    size: Number(entry.size) || 0,
                });
            }
            this._recountTotal();
        } catch (error) {
            if (error.code !== "ENOENT") this._warn(`failed to load file cache index: ${error.message}`);
        }
    }

    _saveIndex() {
        if (!this.indexPath) return;
        try {
            const payload = {
                entries: Object.fromEntries(this.index.entries()),
                updatedAt: new Date(this.now()).toISOString(),
                version: INDEX_VERSION,
            };
            const tmpPath = `${this.indexPath}.tmp`;
            fs.writeFileSync(tmpPath, JSON.stringify(payload));
            fs.renameSync(tmpPath, this.indexPath);
        } catch (error) {
            this._warn(`failed to persist file cache index: ${error.message}`);
        }
    }

    _info(message) {
        if (this.logger && typeof this.logger.info === "function") this.logger.info(`[FileCache] ${message}`);
    }

    _warn(message) {
        if (this.logger && typeof this.logger.warn === "function") this.logger.warn(`[FileCache] ${message}`);
    }
}

module.exports = UploadedFileStore;
