const assert = require("node:assert/strict");
const test = require("node:test");

const RequestHandler = require("../src/core/RequestHandler");

const PIN = { authIndex: 0, source: "file-owner" };

const INLINE_CAP = 18 * 1024 * 1024;

function createContext({ cached = [], pin = PIN, fileSize = 1024, inlineCap = INLINE_CAP } = {}) {
    const calls = [];
    const cachedIds = new Set(cached);
    const context = {
        config: { accountLoadBalancing: true },
        logger: { warn() {}, info() {}, error() {}, debug() {} },
        fileReferenceInliner: { maxInlineBytes: inlineCap },
        _inlineSizeCapBytes: RequestHandler.prototype._inlineSizeCapBytes,
        _loadBalancerTimeouts: RequestHandler.prototype._loadBalancerTimeouts,
        uploadSessionAffinity: {
            resolvePinnedAuthIndex(args) {
                calls.push(args);
                return pin;
            },
        },
        uploadedFileStore: {
            enabled: true,
            getEntry(fileId) {
                return cachedIds.has(fileId) ? { fileId, size: fileSize, mimeType: "video/mp4" } : null;
            },
        },
    };
    return { context, calls };
}

function pinFor(context, { requestPath, bodyBuffer = null }) {
    return RequestHandler.prototype._extractAffinityPin.call(context, {
        requestPath,
        rawUrl: requestPath,
        queryParams: null,
        bodyBuffer,
    });
}

function generationBody(fileId) {
    return Buffer.from(
        JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            fileData: {
                                fileUri: `https://generativelanguage.googleapis.com/v1beta/files/${fileId}`,
                            },
                        },
                    ],
                },
            ],
        })
    );
}

test("文件管理路由（GET /v1beta/files/{id}）始终粘回所属账号", () => {
    const { context, calls } = createContext({ cached: ["evayq36w08k4"] });
    const pin = pinFor(context, { requestPath: "/v1beta/files/evayq36w08k4" });
    assert.deepEqual(pin, PIN, "即使文件已本地缓存，GET 文件状态也必须回到所属账号（换号上游会 500）");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].fileIds, ["evayq36w08k4"]);
});

test("文件管理路由不粘性失效：DELETE 同样粘回所属账号", () => {
    const { context } = createContext({ cached: ["abc123xyz"] });
    assert.deepEqual(pinFor(context, { requestPath: "/v1beta/files/abc123xyz" }), PIN);
});

test("生成请求：文件可内联时不粘账号（保留 403 换号能力）", () => {
    const { context, calls } = createContext({ cached: ["cached1"] });
    const pin = pinFor(context, {
        requestPath: "/v1beta/models/gemini-3-flash-preview:generateContent",
        bodyBuffer: generationBody("cached1"),
    });
    assert.equal(pin, null);
    assert.equal(calls.length, 0);
});

test("生成请求：本地没有缓存字节时仍粘回所属账号", () => {
    const { context, calls } = createContext({ cached: [] });
    const pin = pinFor(context, {
        requestPath: "/v1beta/models/gemini-3-flash-preview:generateContent",
        bodyBuffer: generationBody("unknown99"),
    });
    assert.deepEqual(pin, PIN);
    assert.deepEqual(calls[0].fileIds, ["unknown99"]);
});

test("生成请求：文件超过内联上限时粘回所属账号（改走 fileUri 引用）", () => {
    const { context, calls } = createContext({ cached: ["big1"], fileSize: 64 * 1024 * 1024 });
    const pin = pinFor(context, {
        requestPath: "/v1beta/models/gemini-3-flash-preview:generateContent",
        bodyBuffer: generationBody("big1"),
    });
    assert.deepEqual(pin, PIN, "超限文件无法内联，必须由创建者账号用 fileUri 引用处理");
    assert.deepEqual(calls[0].fileIds, ["big1"]);
});

test("生成请求：文件刚好在内联上限内时不粘账号", () => {
    const { context } = createContext({ cached: ["edge1"], fileSize: INLINE_CAP });
    const pin = pinFor(context, {
        requestPath: "/v1beta/models/gemini-3-flash-preview:generateContent",
        bodyBuffer: generationBody("edge1"),
    });
    assert.equal(pin, null);
});

test("运行时上限（fileInlineMaxBytes）可抬高内联阈值", () => {
    const { context } = createContext({ cached: ["mid1"], fileSize: 34 * 1024 * 1024 });
    context.config.fileInlineMaxBytes = 64 * 1024 * 1024;
    const pin = pinFor(context, {
        requestPath: "/v1beta/models/gemini-3-flash-preview:generateContent",
        bodyBuffer: generationBody("mid1"),
    });
    assert.equal(pin, null, "上限抬到 64MB 后，34MB 文件可内联 -> 不粘账号（保留换号能力）");
});

test("_inlineSizeCapBytes 优先级：运行时设置 > env > 内联器默认", () => {
    const { context } = createContext({});
    assert.equal(context.config.fileInlineMaxBytes, undefined);
    assert.equal(RequestHandler.prototype._inlineSizeCapBytes.call(context), INLINE_CAP);
    context.config.fileInlineMaxBytes = 64 * 1024 * 1024;
    assert.equal(RequestHandler.prototype._inlineSizeCapBytes.call(context), 64 * 1024 * 1024);
});

test("超时窗口默认 45s/120s，可被运行时设置覆盖（超大媒体放宽用）", () => {
    const { context } = createContext({});
    assert.deepEqual(context._loadBalancerTimeouts(), { initial: 45000, total: 120000 });
    context.config.initialResponseTimeoutMs = 240000;
    context.config.totalRequestTimeoutMs = 900000;
    assert.deepEqual(context._loadBalancerTimeouts(), { initial: 240000, total: 900000 });
    context.config.initialResponseTimeoutMs = 0;
    assert.equal(context._loadBalancerTimeouts().initial, 45000, "非法值回退默认 45s");
});

test("上传会话参数存在时按会话粘性处理", () => {
    const { context } = createContext({ cached: [] });
    const pin = RequestHandler.prototype._extractAffinityPin.call(context, {
        requestPath: "/upload/v1main/files",
        rawUrl: "/upload/v1main/files?resumable_upload_session_id=sess123",
        queryParams: { resumable_upload_session_id: "sess123" },
        bodyBuffer: null,
    });
    assert.deepEqual(pin, PIN, "有上传会话参数时按会话解析粘性（与本轮文件路由改动互不影响）");
});
