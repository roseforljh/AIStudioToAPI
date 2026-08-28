"use strict";

class AccountAcquireTimeoutError extends Error {
    constructor(message = "Timed out waiting for an available account") {
        super(message);
        this.code = "ACCOUNT_ACQUIRE_TIMEOUT";
        this.name = "AccountAcquireTimeoutError";
    }
}

class AccountLoadBalancer {
    constructor(options = {}) {
        if (typeof options.getEligibleAuthIndices !== "function") {
            throw new TypeError("getEligibleAuthIndices must be a function");
        }

        this.getEligibleAuthIndices = options.getEligibleAuthIndices;
        this.maxConcurrentRequests = options.maxConcurrentRequests ?? null;
        this.maxConcurrentPerAccount = Math.max(1, Number(options.maxConcurrentPerAccount) || 1);
        this.acquireTimeoutMs = Math.max(1, Number(options.acquireTimeoutMs) || 30000);
        this.cooldownByStatus = new Map(
            Object.entries(options.cooldownByStatus || { 429: 60000, 503: 30000 }).map(([status, duration]) => [
                Number(status),
                Math.max(0, Number(duration) || 0),
            ])
        );
        this.now = typeof options.now === "function" ? options.now : Date.now;
        this.logger = options.logger || null;
        this.states = new Map();
        this.waiters = [];
        this.assignmentSequence = 0;
    }

    _getState(authIndex) {
        let state = this.states.get(authIndex);
        if (!state) {
            state = {
                activeRequests: 0,
                cooldownUntil: 0,
                lastAssignedSequence: -1,
            };
            this.states.set(authIndex, state);
        }
        return state;
    }

    _normalizeExcluded(exclude) {
        if (!exclude) return new Set();
        if (exclude instanceof Set) return exclude;
        if (Array.isArray(exclude)) return new Set(exclude);
        return new Set([exclude]);
    }

    _selectAuthIndex(exclude) {
        const excluded = this._normalizeExcluded(exclude);
        const now = this.now();
        const eligible = [...new Set(this.getEligibleAuthIndices())]
            .filter(authIndex => Number.isInteger(authIndex) && authIndex >= 0)
            .filter(authIndex => !excluded.has(authIndex))
            .map(authIndex => ({ authIndex, state: this._getState(authIndex) }))
            .filter(({ state }) => state.cooldownUntil <= now)
            .filter(({ state }) => state.activeRequests < this.maxConcurrentPerAccount)
            .sort((a, b) => {
                if (a.state.activeRequests !== b.state.activeRequests) {
                    return a.state.activeRequests - b.state.activeRequests;
                }
                if (a.state.lastAssignedSequence !== b.state.lastAssignedSequence) {
                    return a.state.lastAssignedSequence - b.state.lastAssignedSequence;
                }
                return a.authIndex - b.authIndex;
            });

        return eligible.length > 0 ? eligible[0].authIndex : null;
    }

    _getGlobalConcurrencyLimit() {
        const eligibleCount = new Set(
            this.getEligibleAuthIndices().filter(authIndex => Number.isInteger(authIndex) && authIndex >= 0)
        ).size;
        if (eligibleCount === 0) return 0;
        if (typeof this.maxConcurrentRequests === "function") {
            return Math.max(1, Math.min(eligibleCount, Number(this.maxConcurrentRequests(eligibleCount)) || 1));
        }
        if (Number.isFinite(this.maxConcurrentRequests) && this.maxConcurrentRequests > 0) {
            return Math.max(1, Math.min(eligibleCount, Math.floor(this.maxConcurrentRequests)));
        }
        return Math.max(1, Math.floor(eligibleCount / 2));
    }

    _getActiveRequestCount() {
        let active = 0;
        for (const state of this.states.values()) active += state.activeRequests;
        return active;
    }

    _reserve(authIndex) {
        const state = this._getState(authIndex);
        state.activeRequests++;
        state.lastAssignedSequence = this.assignmentSequence++;
    }

    _release(authIndex, options = {}) {
        const state = this._getState(authIndex);
        state.activeRequests = Math.max(0, state.activeRequests - 1);
        const status = Number(options.status);
        const cooldownMs = this.cooldownByStatus.get(status) || 0;
        if (cooldownMs > 0) {
            state.cooldownUntil = Math.max(state.cooldownUntil, this.now() + cooldownMs);
            this._scheduleWakeup(cooldownMs);
            this.logger?.warn?.(
                `[LoadBalancer] Account #${authIndex} cooling down for ${cooldownMs}ms after ${status}`
            );
        }
        this._drainWaiters();
    }

    _createLease(authIndex) {
        const balancer = this;
        let released = false;
        let currentAuthIndex = authIndex;

        return {
            _transfer() {
                released = true;
            },
            get authIndex() {
                return currentAuthIndex;
            },
            async move(options = {}) {
                if (released) throw new Error("Cannot move a released account lease");
                const previousAuthIndex = currentAuthIndex;
                const releaseOptions = options.release || {};
                const previousState = balancer._getState(previousAuthIndex);
                const previousCooldownUntil = previousState.cooldownUntil;
                balancer._release(previousAuthIndex, releaseOptions);
                try {
                    const replacement = await balancer.acquire(options);
                    currentAuthIndex = replacement.authIndex;
                    replacement._transfer();
                    return currentAuthIndex;
                } catch (error) {
                    const status = Number(releaseOptions.status);
                    const cooldownMs = balancer.cooldownByStatus.get(status) || 0;
                    if (cooldownMs === 0) {
                        previousState.cooldownUntil = previousCooldownUntil;
                    }
                    balancer._reserve(previousAuthIndex);
                    throw error;
                }
            },
            release(options = {}) {
                if (released) return;
                released = true;
                balancer._release(currentAuthIndex, options);
            },
        };
    }

    acquire(options = {}) {
        const exclude = this._normalizeExcluded(options.exclude);
        const globalLimit = this._getGlobalConcurrencyLimit();
        const authIndex =
            globalLimit > 0 && this._getActiveRequestCount() < globalLimit ? this._selectAuthIndex(exclude) : null;
        if (authIndex !== null) {
            this._reserve(authIndex);
            return Promise.resolve(this._createLease(authIndex));
        }

        const signal = options.signal;
        if (signal?.aborted) return Promise.reject(this._createAbortError());
        const timeoutMs = Math.max(1, Number(options.timeoutMs) || this.acquireTimeoutMs);

        return new Promise((resolve, reject) => {
            const waiter = { abortHandler: null, exclude, reject, resolve, signal, timeoutId: null };
            const cleanup = () => {
                if (waiter.timeoutId) clearTimeout(waiter.timeoutId);
                if (waiter.signal && waiter.abortHandler) {
                    waiter.signal.removeEventListener("abort", waiter.abortHandler);
                }
            };
            waiter.cleanup = cleanup;
            waiter.timeoutId = setTimeout(() => {
                this._removeWaiter(waiter);
                cleanup();
                reject(new AccountAcquireTimeoutError());
            }, timeoutMs);
            if (signal) {
                waiter.abortHandler = () => {
                    this._removeWaiter(waiter);
                    cleanup();
                    reject(this._createAbortError());
                };
                signal.addEventListener("abort", waiter.abortHandler, { once: true });
            }
            this.waiters.push(waiter);
        });
    }

    _createAbortError() {
        const error = new Error("Account acquisition aborted");
        error.name = "AbortError";
        return error;
    }

    _removeWaiter(waiter) {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
    }

    _drainWaiters() {
        if (this.waiters.length === 0) return;
        for (const waiter of [...this.waiters]) {
            const globalLimit = this._getGlobalConcurrencyLimit();
            if (globalLimit <= 0 || this._getActiveRequestCount() >= globalLimit) break;
            const authIndex = this._selectAuthIndex(waiter.exclude);
            if (authIndex === null) continue;
            this._removeWaiter(waiter);
            waiter.cleanup();
            this._reserve(authIndex);
            waiter.resolve(this._createLease(authIndex));
        }
    }

    _scheduleWakeup(durationMs) {
        const timer = setTimeout(() => this._drainWaiters(), durationMs + 1);
        timer.unref?.();
    }

    notifyAvailabilityChanged() {
        this._drainWaiters();
    }

    markCooldown(authIndex, statusOrDuration, maybeDuration) {
        const state = this._getState(authIndex);
        let durationMs = maybeDuration;
        if (durationMs === undefined) {
            durationMs = this.cooldownByStatus.get(Number(statusOrDuration)) || Number(statusOrDuration) || 0;
        }
        durationMs = Math.max(0, Number(durationMs) || 0);
        if (durationMs === 0) return;
        state.cooldownUntil = Math.max(state.cooldownUntil, this.now() + durationMs);
        this._scheduleWakeup(durationMs);
    }

    getSnapshot() {
        return {
            accounts: [...this.states.entries()].map(([authIndex, state]) => ({ authIndex, ...state })),
            activeRequests: this._getActiveRequestCount(),
            globalConcurrencyLimit: this._getGlobalConcurrencyLimit(),
        };
    }
}

AccountLoadBalancer.AccountAcquireTimeoutError = AccountAcquireTimeoutError;
module.exports = AccountLoadBalancer;
