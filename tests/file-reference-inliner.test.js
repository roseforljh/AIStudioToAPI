"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const FileReferenceInliner = require("../src/core/FileReferenceInliner");

const makeBody = (fileDataKey, fileData) => ({
    contents: [{ role: "user", parts: [{ [fileDataKey]: fileData }, { text: "描述这段视频" }] }],
});

test("extracts the file id from a full Files API uri", () => {
    assert.equal(
        FileReferenceInliner.extractFileId("https://generativelanguage.googleapis.com/v1beta/files/abc-123_XYZ"),
        "abc-123_XYZ"
    );
    assert.equal(FileReferenceInliner.extractFileId("https://generativelanguage.googleapis.com/v1beta/files/abc?alt=media"), "abc");
    assert.equal(FileReferenceInliner.extractFileId("files/shortform"), "shortform");
    assert.equal(FileReferenceInliner.extractFileId("https://example.com/nothing"), null);
});

test("finds camelCase and snake_case file references", () => {
    const inliner = new FileReferenceInliner();
    const camel = inliner.findReferences(makeBody("fileData", { mimeType: "video/mp4", fileUri: "https://x/files/video1" }));
    assert.equal(camel.length, 1);
    assert.equal(camel[0].fileId, "video1");
    assert.equal(camel[0].mimeType, "video/mp4");
    assert.equal(camel[0].style, "camel");

    const snake = inliner.findReferences(makeBody("file_data", { mime_type: "image/png", file_uri: "https://x/v1beta/files/pic1" }));
    assert.equal(snake.length, 1);
    assert.equal(snake[0].fileId, "pic1");
    assert.equal(snake[0].style, "snake");
});

test("ignores requests without file references", () => {
    const inliner = new FileReferenceInliner();
    assert.deepEqual(inliner.findReferences({ contents: [{ role: "user", parts: [{ text: "你好" }] }] }), []);
    assert.deepEqual(inliner.findReferences(null), []);
});

test("replaces a reference with inline base64 data", () => {
    const inliner = new FileReferenceInliner();
    const body = makeBody("fileData", { mimeType: "video/mp4", fileUri: "https://x/v1beta/files/video1" });
    const references = inliner.findReferences(body);
    const stats = inliner.replaceReferences(body, references, () => ({ data: "QUJD", mimeType: "video/mp4", bytes: 3 }));

    assert.equal(stats.replaced, 1);
    assert.equal(stats.skipped, 0);
    assert.deepEqual(stats.fileIds, ["video1"]);
    const part = body.contents[0].parts[0];
    assert.equal(part.fileData, undefined);
    assert.deepEqual(part.inlineData, { mimeType: "video/mp4", data: "QUJD" });
});

test("keeps the original reference when the bytes are unavailable", () => {
    const inliner = new FileReferenceInliner();
    const body = makeBody("fileData", { mimeType: "video/mp4", fileUri: "https://x/v1beta/files/missing" });
    const references = inliner.findReferences(body);
    const stats = inliner.replaceReferences(body, references, () => null);

    assert.equal(stats.replaced, 0);
    assert.equal(stats.skipped, 1);
    assert.equal(body.contents[0].parts[0].fileData.fileUri, "https://x/v1beta/files/missing");
});

test("supports snake_case replacement", () => {
    const inliner = new FileReferenceInliner();
    const body = makeBody("file_data", { mime_type: "image/png", file_uri: "https://x/v1beta/files/pic1" });
    const references = inliner.findReferences(body);
    inliner.replaceReferences(body, references, () => ({ data: "QUJD", mimeType: "image/png" }));

    const part = body.contents[0].parts[0];
    assert.equal(part.file_data, undefined);
    assert.deepEqual(part.inline_data, { mime_type: "image/png", data: "QUJD" });
});
