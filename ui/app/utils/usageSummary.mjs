// One completed generation counts once, attributed to the account that finished it.
export function summarizeUsage(records, windowMs = 86400000, now = Date.now()) {
    const groups = new Map();
    let totalRequests = 0;
    let successCount = 0;
    for (const record of records) {
        if (record.requestCategory !== "generation" || !record.model) continue;
        const timestamp = Date.parse(record.finishedAt || record.startedAt);
        if (windowMs && (!Number.isFinite(timestamp) || timestamp < now - windowMs)) continue;
        const authIndex = record.finalAuthIndex ?? record.initialAuthIndex ?? null;
        const accountName = record.finalAccountName || record.initialAccountName || "";
        const key = JSON.stringify([authIndex, accountName, record.model]);
        const item = groups.get(key) || {
            accountName,
            authIndex,
            key,
            lastUsedAt: 0,
            model: record.model,
            successCount: 0,
            totalRequests: 0,
        };
        item.totalRequests++;
        totalRequests++;
        if (record.outcome === "success") {
            item.successCount++;
            successCount++;
        }
        item.lastUsedAt = Math.max(item.lastUsedAt, timestamp || 0);
        groups.set(key, item);
    }
    const rate = (successes, total) => (total ? Number(((100 * successes) / total).toFixed(1)) : 0);
    return {
        rows: [...groups.values()]
            .map(item => ({ ...item, successRate: rate(item.successCount, item.totalRequests) }))
            .sort((a, b) => b.lastUsedAt - a.lastUsedAt),
        successRate: rate(successCount, totalRequests),
        totalRequests,
    };
}
