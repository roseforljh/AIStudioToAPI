"use strict";

const { AsyncLocalStorage } = require("node:async_hooks");

class AccountRequestContext {
    constructor() {
        this.storage = new AsyncLocalStorage();
    }

    run(store, callback) {
        return this.storage.run(store, callback);
    }

    getStore() {
        return this.storage.getStore() || null;
    }

    getAuthIndex(fallback = -1) {
        const authIndex = this.getStore()?.lease?.authIndex ?? this.getStore()?.authIndex;
        return Number.isInteger(authIndex) && authIndex >= 0 ? authIndex : fallback;
    }

    getLease() {
        return this.getStore()?.lease || null;
    }
}

module.exports = AccountRequestContext;
