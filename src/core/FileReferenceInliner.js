"use strict";

/**
 * FileReferenceInliner
 *
 * 找出 Gemini 请求体里对 Files API 文件的引用，并在拿到字节后替换成内联数据。
 *
 * 为什么需要：
 *   浏览器自动化链路中，生成请求的调用方身份与创建上传文件的身份不一致，
 *   Google 对 fileData.fileUri 引用会返回 403 PERMISSION_DENIED（实测）。
 *   内联 base64（inlineData）不受影响，因此把引用替换为内联字节即可让模型真正看到文件。
 */

const FILE_ID_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;

class FileReferenceInliner {
    constructor({ maxInlineBytes = 18 * 1024 * 1024, logger = null } = {}) {
        this.maxInlineBytes = Math.max(1024, Number(maxInlineBytes) || 18 * 1024 * 1024);
        this.logger = logger;
    }

    static extractFileId(uri) {
        if (typeof uri !== "string" || !uri) return null;
        const trimmed = uri.trim();
        const match = /\/files\/([A-Za-z0-9_.-]+)\/?$/.exec(trimmed.split("?")[0]);
        if (match) return match[1];
        const short = /^files\/([A-Za-z0-9_.-]+)$/.exec(trimmed);
        return short ? short[1] : null;
    }

    /** 遍历 contents[].parts[]，收集 fileData / file_data 引用 */
    findReferences(body) {
        const references = [];
        const contents = body && Array.isArray(body.contents) ? body.contents : [];
        contents.forEach((content, contentIndex) => {
            const parts = content && Array.isArray(content.parts) ? content.parts : [];
            parts.forEach((part, partIndex) => {
                if (!part || typeof part !== "object") return;
                const isCamel = Boolean(part.fileData);
                const fileData = part.fileData || part.file_data;
                if (!fileData || typeof fileData !== "object") return;
                const uri = fileData.fileUri || fileData.file_uri || null;
                const rawId = fileData.fileId || fileData.file_id || null;
                const fileId = FileReferenceInliner.extractFileId(uri) || (rawId && FILE_ID_PATTERN.test(String(rawId)) ? String(rawId) : null);
                if (!fileId) return;
                references.push({
                    contentIndex,
                    partIndex,
                    fileId,
                    mimeType: fileData.mimeType || fileData.mime_type || null,
                    style: isCamel ? "camel" : "snake",
                });
            });
        });
        return references;
    }

    /**
     * 用内联数据替换引用。
     * resolveBase64(fileId) -> { data, mimeType } | null
     */
    replaceReferences(body, references, resolveBase64) {
        const stats = { replaced: 0, skipped: 0, bytes: 0, fileIds: [] };
        for (const reference of references) {
            let resolved = null;
            try {
                resolved = resolveBase64(reference.fileId);
            } catch (error) {
                this.logger?.warn?.(`[Inline] 读取文件 ${reference.fileId} 失败: ${error.message}`);
            }
            if (!resolved || !resolved.data) {
                stats.skipped += 1;
                continue;
            }
            const part = body.contents[reference.contentIndex].parts[reference.partIndex];
            const payload = {
                mimeType: resolved.mimeType || reference.mimeType || "application/octet-stream",
                data: resolved.data,
            };
            if (reference.style === "snake") {
                part.inline_data = { mime_type: payload.mimeType, data: payload.data };
                delete part.file_data;
            } else {
                part.inlineData = payload;
                delete part.fileData;
            }
            stats.replaced += 1;
            stats.bytes += resolved.bytes || 0;
            if (!stats.fileIds.includes(reference.fileId)) stats.fileIds.push(reference.fileId);
        }
        return stats;
    }
}

module.exports = FileReferenceInliner;
