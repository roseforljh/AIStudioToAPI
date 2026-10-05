"use strict";
const fs = require('fs');
const path = require('path');
// Stores account identifiers only, never cookies or other credentials.
class AccountPoolRotation {
    constructor(statePath, logger) {
        this.statePath = statePath;
        this.logger = logger;
        this.lastAttempt = null;
        try {
            const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            if (state.version === 1 && Number.isInteger(state.lastAttempt)) this.lastAttempt = state.lastAttempt;
        } catch (error) {
            if (error.code !== 'ENOENT') logger?.warn?.(`[PoolRotation] Cannot restore cursor: ${error.message}`);
        }
    }
    order(indices) {
        // Prefer consecutive IDs rather than continuing past the saved cursor.
        return [...new Set(indices.filter(i => Number.isInteger(i) && i >= 0))].sort((a, b) => a - b);
    }
    attempted(index) {
        this.lastAttempt = index;
        try {
            fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
            const temp = this.statePath + '.tmp';
            fs.writeFileSync(temp, JSON.stringify({version: 1, lastAttempt: index}) + '\n', {mode: 0o600});
            fs.renameSync(temp, this.statePath);
        } catch (error) {
            this.logger?.warn?.(`[PoolRotation] Cannot save cursor: ${error.message}`);
        }
    }
}
module.exports = AccountPoolRotation;
