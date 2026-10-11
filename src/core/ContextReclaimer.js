"use strict";

/**
 * Safely recycles idle browser contexts without interrupting in-flight work.
 * The browser manager owns the actual close/reopen operations; this class only
 * schedules and gates reclamation.
 */
class ContextReclaimer {
    constructor({ logger, browserManager, getActiveRequestCount, config }) {
        this.logger = logger;
        this.browserManager = browserManager;
        this.getActiveRequestCount = getActiveRequestCount;
        this.config = config;
        this.timer = null;
        this.running = false;
    }

    start() {
        if (this.timer || !this.config.contextReclaimerEnabled) return;
        const intervalMs = Math.max(30000, Number(this.config.contextReclaimerIntervalMs) || 60000);
        this.timer = setInterval(() => {
            this.runOnce().catch(error => {
                this.logger.warn(`[ContextReclaimer] Check failed: ${error.message}`);
            });
        }, intervalMs);
        this.timer.unref?.();
        this.logger.info(
            `[ContextReclaimer] Enabled (interval=${intervalMs}ms, idle=${this.config.contextReclaimerIdleMs}ms, memory=${this.config.contextReclaimerMemoryMb}MiB).`
        );
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
    }

    async runOnce() {
        if (this.running || !this.config.contextReclaimerEnabled) return false;
        if (this.browserManager.isClosingIntentionally || this.browserManager.initializingContexts.size > 0)
            return false;
        if (typeof this.getActiveRequestCount === "function" && this.getActiveRequestCount() > 0) return false;

        const memoryMb = this.browserManager.getProcessMemoryMb();
        const thresholdMb = Number(this.config.contextReclaimerMemoryMb) || 0;
        // Fail closed when cgroup memory metrics are unavailable.
        if (!Number.isFinite(memoryMb)) return false;
        if (thresholdMb > 0 && memoryMb < thresholdMb) return false;

        const candidate = this.browserManager.findIdleContextForReclaim(
            Number(this.config.contextReclaimerIdleMs) || 3600000
        );
        if (candidate === null) return false;

        this.running = true;
        try {
            this.logger.info(`[ContextReclaimer] Recycling idle context #${candidate} (rss=${memoryMb}MiB).`);
            await this.browserManager.reclaimContext(candidate, "memory_budget");
            return true;
        } finally {
            this.running = false;
        }
    }
}

module.exports = ContextReclaimer;
