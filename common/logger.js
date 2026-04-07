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
 * Debug output is also written to an in-page Shadow DOM panel when active.
 * The panel is created by global-content-script.js and registered via
 * Logger.setDebugPanel(). Debug mode is active when the log level is DEBUG
 * or when the current page URL contains the query parameter ?debug=true.
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

    // True when ?debug=true is present in the current page URL.
    // Evaluated once at class load time; never changes within a page lifetime.
    static #debugParam = new URLSearchParams(window.location.search).get('debug') === 'true';

    // Reference to the scrollable log <div> inside the Shadow DOM panel.
    // Set by global-content-script.js via Logger.setDebugPanel().
    // Reset to null when the panel is closed.
    static #debugPanel = null;

    static get level() { return Logger.#level; }

    /**
     * True when debug output (console + panel) should be produced, i.e. when
     * the stored log level is DEBUG or ?debug=true is in the URL.
     * Reliable only after Logger.init() has resolved for the level part;
     * the URL-param part is always accurate regardless.
     *
     * @static
     * @readonly
     * @memberof Logger
     */
    static get debugMode() {
        return Logger.#level <= Logger.DEBUG || Logger.#debugParam;
    }

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

        if ((this.#level === Logger.DEBUG || Logger.debugMode) && !this.#debugPanel) Logger.createDebugPanel();
    }

    /**
     * Creates the Shadow DOM debug panel and appends it as the last element of
     * <body>. The panel's scrollable log element is registered internally so
     * that Logger.debug() can write to it. Should only be called once per page,
     * which global-content-script.js ensures.
     *
     * @static
     * @memberof Logger
     */
    static #PANEL_HEIGHT_PX = 220;

    static createDebugPanel() {
        const host = document.createElement('div');
        host.id = 'pm-debug-host';
        document.body.appendChild(host);
        document.body.style.paddingBottom = `${Logger.#PANEL_HEIGHT_PX}px`;

        const shadow = host.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            * { box-sizing: border-box; margin: 0; padding: 0; }

            #pm-panel {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: ${Logger.#PANEL_HEIGHT_PX}px;
                background: #1e1e1e;
                color: #d4d4d4;
                font-family: monospace;
                font-size: 12px;
                z-index: 2147483647;
                display: flex;
                flex-direction: column;
                border-top: 2px solid #007acc;
            }

            #pm-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 4px 8px;
                background: #252526;
                border-bottom: 1px solid #3c3c3c;
                flex-shrink: 0;
            }

            #pm-header span {
                font-weight: bold;
                color: #9cdcfe;
            }

            #pm-header button {
                background: transparent;
                border: 1px solid #555;
                color: #d4d4d4;
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 11px;
                margin-left: 4px;
            }

            #pm-header button:hover { background: #3c3c3c; }

            #pm-log {
                flex: 1;
                overflow-y: auto;
                padding: 4px 8px;
            }

            .pm-entry {
                padding: 1px 0;
                border-bottom: 1px solid #2d2d2d;
                word-break: break-all;
                white-space: pre-wrap;
            }

            .pm-entry:last-child { border-bottom: none; }
        `;

        const panel = document.createElement('div');
        panel.id = 'pm-panel';

        const header = document.createElement('div');
        header.id = 'pm-header';

        const title = document.createElement('span');
        title.textContent = 'PM Debug Log';

        const btnGroup = document.createElement('div');

        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear';
        clearBtn.addEventListener('click', () => { log.innerHTML = ''; });

        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', () => {
            const text = [...new CssSelectorHelper('.pm-entry', log).getAll()]
                .map(el => el.textContent)
                .join('\n');
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
            });
        });

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', () => {
            host.remove();
            document.body.style.paddingBottom = '';
            Logger.#debugPanel = null;
        });

        const log = document.createElement('div');
        log.id = 'pm-log';

        btnGroup.appendChild(clearBtn);
        btnGroup.appendChild(copyBtn);
        btnGroup.appendChild(closeBtn);
        header.appendChild(title);
        header.appendChild(btnGroup);
        panel.appendChild(header);
        panel.appendChild(log);
        shadow.appendChild(style);
        shadow.appendChild(panel);

        Logger.#debugPanel = log;
    }

    /**
     * Appends a formatted log entry to the in-page debug panel, if one is
     * registered. Each entry is prefixed with a locale-formatted timestamp.
     * Objects are JSON-serialised; Errors are converted via toString().
     * The panel auto-scrolls to the latest entry.
     *
     * @static
     * @param {...*} args
     * @memberof Logger
     */
    static #appendToPanel(...args) {
        if (!Logger.#debugPanel) return;

        const entry = document.createElement('div');
        entry.className = 'pm-entry';

        const time = new Date().toLocaleTimeString('en-GB');
        const text = args.map(a => {
            if (a instanceof Error) return a.toString();
            if (typeof a === 'object' && a !== null) {
                try { return JSON.stringify(a); } catch (_) { return String(a); }
            }
            return String(a);
        }).join(' ');

        entry.textContent = `[${time}] ${text}`;
        Logger.#debugPanel.appendChild(entry);
        Logger.#debugPanel.scrollTop = Logger.#debugPanel.scrollHeight;
    }

    /**
     * @static
     * @param {...*} args
     * @memberof Logger
     */
    static debug(...args) {
        if (Logger.#level <= Logger.DEBUG || Logger.#debugParam) {
            if (!Logger.#debugPanel) Logger.createDebugPanel();

            console.debug('[PM]', ...args);
            Logger.#appendToPanel(...args);
        }
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
