const assert = require("node:assert/strict");
const test = require("node:test");
const now = Date.now();
function record(overrides = {}) {
    return {
        finalAccountName: "a@example.test",
        finalAuthIndex: 0,
        finishedAt: new Date(now - 1000).toISOString(),
        model: "gemini-test",
        outcome: "success",
        requestCategory: "generation",
        ...overrides,
    };
}
test("usage summary groups final account and model, excludes non-generation noise and sorts by recency", async () => {
    const { summarizeUsage } = await import("../ui/app/utils/usageSummary.mjs");
    const records = [
        record(),
        record({ outcome: "error" }),
        record({ outcome: "aborted" }),
        record({ attemptCount: 5, finalAuthIndex: 1, finishedAt: new Date(now).toISOString(), model: "other" }),
        record({ requestCategory: "models" }),
        record({ requestCategory: "count_tokens" }),
        record({ model: null }),
        record({ finishedAt: new Date(now - 90000000).toISOString() }),
    ];
    const result = summarizeUsage(records, 86400000, now);
    assert.equal(result.totalRequests, 4);
    assert.equal(result.successRate, 50);
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].authIndex, 1);
    assert.equal(result.rows[0].totalRequests, 1, "retries don't inflate request counts");
    assert.equal(result.rows[1].totalRequests, 3);
    assert.equal(result.rows[1].successRate, 33.3);
    assert.equal(summarizeUsage(records, 0, now).totalRequests, 5);
});
test("usage summary handles empty history, deleted accounts, missing timestamps and fallback account", async () => {
    const { summarizeUsage } = await import("../ui/app/utils/usageSummary.mjs");
    assert.deepEqual(summarizeUsage([]), { rows: [], successRate: 0, totalRequests: 0 });
    const result = summarizeUsage(
        [record({ finalAccountName: null, finalAuthIndex: null, initialAccountName: "old", initialAuthIndex: 5 })],
        0,
        now
    );
    assert.equal(result.rows[0].authIndex, 5);
    assert.equal(result.rows[0].accountName, "old");
    assert.equal(summarizeUsage([record({ finishedAt: "bad" })], 86400000, now).totalRequests, 0);
});
