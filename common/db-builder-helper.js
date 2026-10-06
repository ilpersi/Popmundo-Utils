/**
 * Helpers shared by the developer-only database builders (features/item-category-db-builder.js,
 * features/achievement-db-builder.js): game language switching, page fetching and file download.
 *
 * @class DbBuilderHelper
 */
class DbBuilderHelper {

    static LANGUAGE_SELECT_SELECTOR = 'select[id$="ddlLanguage"]';
    static LANGUAGE_SAVE_BUTTON_SELECTOR = 'input[id$="btnSetLocale"]';
    static LANGUAGE_SETTINGS_PATH = '/User/Popmundo.aspx/User/LanguageSettings';

    /**
     * chrome.storage.local key holding the language to restore if a multi-language run is interrupted.
     * The account language is global, so the builders share the same marker.
     */
    static ORIGINAL_LANGUAGE_KEY = 'ics_db_builder_original_language';

    /**
     * Creates an element with optional text content.
     *
     * @static
     * @param {string} tag
     * @param {string} [text]
     * @return {HTMLElement}
     * @memberof DbBuilderHelper
     */
    static el(tag, text) {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        return node;
    }

    /**
     * Creates a button.
     *
     * @static
     * @param {string} label
     * @return {HTMLInputElement}
     * @memberof DbBuilderHelper
     */
    static createButton(label) {
        const button = DbBuilderHelper.el('input');
        button.type = 'button';
        button.className = 'round';
        button.value = label;
        return button;
    }

    /**
     * Runs an async action with the buttons disabled and the failures shown in the status line.
     *
     * @static
     * @param {HTMLInputElement[]} buttons
     * @param {HTMLElement} status
     * @param {function(): Promise<void>} action
     * @param {string} logLabel Name of the builder, used in the error log
     * @memberof DbBuilderHelper
     */
    static async runExclusive(buttons, status, action, logLabel) {
        buttons.forEach(button => { button.disabled = true; });
        try {
            await action();
        } catch (error) {
            Logger.error(`${logLabel} failed`, error);
            status.textContent = String(error && error.message || error);
        } finally {
            buttons.forEach(button => { button.disabled = false; });
        }
    }

    /**
     * Fetches a game page (never from cache) and parses it.
     *
     * @static
     * @param {string} path Page path on the current server
     * @param {Object} [options] fetch options
     * @return {Promise<Document>}
     * @memberof DbBuilderHelper
     */
    static async fetchDocument(path, options = {}) {
        const html = await new TimedFetch().fetch(Utils.getServerLink(path), options, false);
        return new DOMParser().parseFromString(html, 'text/html');
    }

    /**
     * Reads the languages offered by the language settings page.
     *
     * @static
     * @param {Document} doc The parsed language settings page
     * @return {{languages: Array<{id: number, name: string, active: boolean}>, currentId: number|null}}
     * @memberof DbBuilderHelper
     */
    static readLanguages(doc) {
        const select = new CssSelectorHelper(DbBuilderHelper.LANGUAGE_SELECT_SELECTOR).getSingle(doc);
        if (!select) return { languages: [], currentId: null };

        const languages = Array.from(new CssSelectorHelper('option').getAll(select)).map(option => ({
            id: parseInt(option.value),
            // "(Inactive)" is how the English game marks languages that are not maintained anymore
            name: option.text.replace(/\s*\(Inactive\)\s*$/i, '').trim(),
            active: !/\(Inactive\)/i.test(option.text),
        }));
        const selected = new CssSelectorHelper('option:checked').getSingle(select)
            || new CssSelectorHelper('option[selected]').getSingle(select);
        return { languages, currentId: selected ? parseInt(selected.value) : null };
    }

    /**
     * Switches the language of the account using the form of the language settings page.
     * Does nothing when the language is already the requested one. The result is verified
     * by reading the settings page again.
     *
     * @static
     * @param {number} languageId
     * @return {Promise<{id: number, name: string}>} The language set after the switch, with its localized name
     * @throws {Error} When the language could not be set
     * @memberof DbBuilderHelper
     */
    static async switchLanguage(languageId) {
        const settingsPath = DbBuilderHelper.LANGUAGE_SETTINGS_PATH;
        const doc = await DbBuilderHelper.fetchDocument(settingsPath);
        const select = new CssSelectorHelper(DbBuilderHelper.LANGUAGE_SELECT_SELECTOR).getSingle(doc);
        const saveButton = new CssSelectorHelper(DbBuilderHelper.LANGUAGE_SAVE_BUTTON_SELECTOR).getSingle(doc);
        const form = select && select.closest('form');
        if (!form || !saveButton) throw new Error('Language settings form not found');

        if (DbBuilderHelper.readLanguages(doc).currentId !== languageId) {
            const body = new URLSearchParams(new FormData(form));
            body.set(select.name, String(languageId));
            body.set(saveButton.name, saveButton.value);
            await new TimedFetch().fetch(Utils.getServerLink(settingsPath), { method: 'POST', body }, false);
        }

        const verifyDoc = await DbBuilderHelper.fetchDocument(settingsPath);
        const verifySelect = new CssSelectorHelper(DbBuilderHelper.LANGUAGE_SELECT_SELECTOR).getSingle(verifyDoc);
        const selected = verifySelect && (new CssSelectorHelper('option:checked').getSingle(verifySelect)
            || new CssSelectorHelper('option[selected]').getSingle(verifySelect));
        if (!selected || parseInt(selected.value) !== languageId) {
            throw new Error(`Unable to switch the game language to ${languageId}`);
        }
        return { id: languageId, name: selected.text.trim() };
    }

    /**
     * Restores the language saved before a multi-language run, and refreshes the language cache.
     *
     * @static
     * @param {number} languageId
     * @memberof DbBuilderHelper
     */
    static async restoreLanguage(languageId) {
        const language = await DbBuilderHelper.switchLanguage(languageId);
        await Utils.setGameLanguage(language);
        await chrome.storage.local.remove(DbBuilderHelper.ORIGINAL_LANGUAGE_KEY);
    }

    /**
     * Saves a text as a file through a temporary download link.
     *
     * @static
     * @param {string} fileName
     * @param {string} content
     * @memberof DbBuilderHelper
     */
    static downloadTextFile(fileName, content) {
        const url = URL.createObjectURL(new Blob([content], { type: 'text/javascript;charset=utf-8' }));
        const link = DbBuilderHelper.el('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}
