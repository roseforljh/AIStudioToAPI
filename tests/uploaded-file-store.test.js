"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const UploadedFileStore = require("../src/core/UploadedFileStore");

const makeStore = (options = {}) =>
    new UploadedFileStore({ dir: fs.mkdtempSync(path.join(os.tmpdir(), "upload-store-")), ...options });

test("assembles chunked uploads by offset and commits them to a file id", () => {
    const store = makeStore();
    const session = "sess-1";
    store.appendChunk(session, 0, Buffer.from("hello "));
    store.appendChunk(session, 6, Buffer.from("world"));

    const committed = store.commitSession(session, "file1", { expectedSize: 11, mimeType: "text/plain" });
    assert.equal(committed.ok, true);
    assert.equal(committed.size, 11);
    assert.equal(store.readBuffer("file1").toString(), "hello world");
    assert.equal(store.getEntry("file1").mimeType, "text/plain");
});

test("rejects a commit when the assembled size differs from the expected size", () => {
    const store = makeStore();
    store.appendChunk("sess-2", 0, Buffer.from("partial"));
    const committed = store.commitSession("sess-2", "file2", { expectedSize: 999 });

    assert.equal(committed.ok, false);
    assert.equal(store.getEntry("file2"), null);
});

test("exposes the file size and removes files on request", () => {
    const store = makeStore();
    store.appendChunk("sess-3", 0, Buffer.from("12345"));
    store.commitSession("sess-3", "file3", { expectedSize: 5 });

    assert.equal(store.getEntry("file3").size, 5);
    assert.equal(store.remove("file3"), true);
    assert.equal(store.getEntry("file3"), null);
});

test("ignores expired entries and survives a reload from disk", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "upload-store-"));
    const ttlMs = 60 * 1000;
    const store = new UploadedFileStore({ dir, ttlMs });
    store.appendChunk("sess-4", 0, Buffer.from("persisted-bytes"));
    store.commitSession("sess-4", "file4", { expectedSize: 15 });
    store.close();

    const reloaded = new UploadedFileStore({ dir, ttlMs });
    assert.equal(reloaded.getEntry("file4").size, 15);
    assert.equal(reloaded.readBuffer("file4").toString(), "persisted-bytes");

    const expired = new UploadedFileStore({ dir, ttlMs, now: () => Date.now() + ttlMs + 1000 });
    assert.equal(expired.getEntry("file4"), null);
});

test("sanitises ids so a malicious file id cannot escape the cache directory", () => {
    const store = makeStore();
    const entry = store.appendChunk("../../evil", 0, Buffer.from("x"));
    assert.equal(entry, true);
    assert.equal(UploadedFileStore.sanitizeId("../../evil"), "....evil");
    assert.equal(UploadedFileStore.sanitizeId("ok-id_1.2"), "ok-id_1.2");
});

test("a store without a directory is disabled and never throws", () => {
    const store = new UploadedFileStore({});
    assert.equal(store.enabled, false);
    assert.equal(store.appendChunk("s", 0, Buffer.from("x")), false);
    assert.equal(store.commitSession("s", "f").ok, false);
    assert.equal(store.getEntry("f"), null);
});
