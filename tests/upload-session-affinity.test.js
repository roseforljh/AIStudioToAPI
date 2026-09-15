"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const UploadSessionAffinity = require("../src/core/UploadSessionAffinity");

test("extracts resumable upload session id from query params and raw url", () => {
    assert.equal(
        UploadSessionAffinity.extractUploadSessionId({
            queryParams: { resumable_upload_session_id: "session-abc", file_proto: "x" },
        }),
        "session-abc"
    );
    assert.equal(
        UploadSessionAffinity.extractUploadSessionId({
            rawUrl: "/upload/v1main/files?resumable_upload_session_id=session-xyz&file_proto=x",
        }),
        "session-xyz"
    );
    assert.equal(UploadSessionAffinity.extractUploadSessionId({ rawUrl: "/upload/v1main/files" }), null);
});

test("extracts file ids from gemini fileData references but ignores unrelated text", () => {
    const body = Buffer.from(
        JSON.stringify({
            contents: [
                { parts: [{ text: "look at files/notafile in my notes" }] },
                {
                    parts: [
                        {
                            fileData: {
                                mimeType: "video/mp4",
                                fileUri: "https://generativelanguage.googleapis.com/v1beta/files/video123",
                            },
                        },
                    ],
                },
            ],
        })
    );
    assert.deepEqual(UploadSessionAffinity.extractFileIds(body), ["video123"]);
    assert.deepEqual(UploadSessionAffinity.extractFileIds(Buffer.from("no references here")), []);
});

test("pins the account that created an upload session and ignores it after ttl", () => {
    let now = 1000;
    const affinity = new UploadSessionAffinity({ now: () => now, sessionTtlMs: 60 });
    assert.equal(affinity.resolvePinnedAuthIndex({ uploadSessionId: "s1" }), null);

    affinity.bindUploadSession("s1", 4);
    assert.deepEqual(affinity.resolvePinnedAuthIndex({ uploadSessionId: "s1" }), {
        authIndex: 4,
        source: "upload-session",
    });

    now += 1001;
    assert.equal(affinity.resolvePinnedAuthIndex({ uploadSessionId: "s1" }), null);
});

test("pins uploaded files so later generation requests return to the owning account", () => {
    const affinity = new UploadSessionAffinity();
    affinity.bindFile("video123", 7);
    assert.deepEqual(affinity.resolvePinnedAuthIndex({ fileIds: ["video123"] }), {
        authIndex: 7,
        source: "file-owner",
        fileIds: ["video123"],
    });
    assert.equal(affinity.resolvePinnedAuthIndex({ fileIds: ["unknown"] }), null);
});

test("refuses to pin when referenced files belong to different accounts", () => {
    const affinity = new UploadSessionAffinity();
    affinity.bindFile("a", 1);
    affinity.bindFile("b", 2);
    assert.equal(affinity.resolvePinnedAuthIndex({ fileIds: ["a", "b"] }), null);
});

test("persists bindings to disk and restores them on restart", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "affinity-"));
    const filePath = path.join(dir, "upload-affinity.json");
    const first = new UploadSessionAffinity({ filePath, persistDelayMs: 0 });
    first.bindFile("video123", 5);
    first.bindUploadSession("session-1", 5);
    assert.ok(fs.existsSync(filePath), "binding file should be written");

    const restored = new UploadSessionAffinity({ filePath });
    assert.deepEqual(restored.resolvePinnedAuthIndex({ fileIds: ["video123"] }), {
        authIndex: 5,
        source: "file-owner",
        fileIds: ["video123"],
    });
    assert.deepEqual(restored.resolvePinnedAuthIndex({ uploadSessionId: "session-1" }), {
        authIndex: 5,
        source: "upload-session",
    });
    fs.rmSync(dir, { recursive: true, force: true });
});

test("does not restore expired bindings from disk", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "affinity-"));
    const filePath = path.join(dir, "upload-affinity.json");
    fs.writeFileSync(
        filePath,
        JSON.stringify({ version: 1, entries: { "file:stale": { authIndex: 3, expiresAt: 1 } } })
    );
    const restored = new UploadSessionAffinity({ filePath });
    assert.equal(restored.resolvePinnedAuthIndex({ fileIds: ["stale"] }), null);
    fs.rmSync(dir, { recursive: true, force: true });
});
