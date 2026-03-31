'use strict';

/**
 * A simple levelled logger for the Popmundo Utils extension.
 *
 * Call `await Logger.init()` once at the top of each feature script before
 * making any log calls. Until init() resolves the level defaults to ERROR so
 * no debug/info/warn output leaks by accident.
 *
 * Log level is stored in chrome.storage.sync under the key 'log_level'.
 * The initial value is set by background.js on first install:
 *   - development builds  → DEBUG  (0)
 *   - production builds   → ERROR  (3)
 *
 * In development mode the level can be overridden at any time from the
 * Options page → Developer tab.
 *
 * @class Logger
 */
class Logger {
    static DEBUG = 0;
    static INFO  = 1;
    static WARN  = 2;
    static ERROR = 3;

    // Safe default: emit nothing below ERROR until init() has resolved.
    static #level = 3;

    static get level() { return Logger.#level; }

    /**
     * Reads log_level from chrome.storage.sync and caches it locally.
     * Must be awaited before the first log call in each content script.
     *
     * @static
     * @return {Promise<void>}
     * @memberof Logger
     */
    static async init() {
        const { log_level } = await chrome.storage.sync.get({ log_level: Logger.ERROR });
        Logger.#level = log_level;
    }

    /**
     * @static
     * @param {...*} args
     * @memberof Logger
     */
    static debug(...args) {
        if (Logger.#level <= Logger.DEBUG) console.debug('[PM]', ...args);
    }

    /**
     * @static
     * @param {...*} args
     * @memberof Logger
     */
    static info(...args) {
        if (Logger.#level <= Logger.INFO) console.info('[PM]', ...args);
    }

    /**
     * @static
     * @param {...*} args
     * @memberof Logger
     */
    static warn(...args) {
        if (Logger.#level <= Logger.WARN) console.warn('[PM]', ...args);
    }

    /**
     * @static
     * @param {...*} args
     * @memberof Logger
     */
    static error(...args) {
        if (Logger.#level <= Logger.ERROR) console.error('[PM]', ...args);
    }
}
