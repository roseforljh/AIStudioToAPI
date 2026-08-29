"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

class RuntimeSettingsStore {
    constructor(filePath = path.join(process.cwd(), "data", "runtime-settings.json")) {
        this.filePath = filePath;
        this.settings = null;
        this.writePromise = Promise.resolve();
    }

    async _load() {
        if (this.settings) return this.settings;
        try {
            this.settings = JSON.parse(await fs.readFile(this.filePath, "utf8"));
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
            this.settings = {};
        }
        return this.settings;
    }

    async load() {
        return this._load();
    }

    async getAll() {
        return { ...(await this._load()) };
    }

    async get(key, fallback = undefined) {
        const settings = await this._load();
        return Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : fallback;
    }

    async set(key, value) {
        const settings = await this._load();
        if (value === undefined || value === null) {
            delete settings[key];
        } else {
            settings[key] = value;
        }
        this.writePromise = this.writePromise.then(async () => {
            await fs.mkdir(path.dirname(this.filePath), { recursive: true });
            const temporaryPath = `${this.filePath}.tmp`;
            await fs.writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
            await fs.rename(temporaryPath, this.filePath);
        });
        await this.writePromise;
        return value;
    }
}

module.exports = RuntimeSettingsStore;
