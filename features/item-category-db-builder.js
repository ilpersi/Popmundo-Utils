/**
 * Item Category Database Builder (developer mode only)
 *
 * On the Shopping Assistant page, adds a box that reads every shop category (and the
 * item types it contains) and builds the matching entries of ITEM_CATEGORY_SEARCHER_DB:
 *   - for the current game language: the entry is printed in the debug log, ready to be
 *     pasted in features/item-category-searcher-data.js;
 *   - for several languages: the account language is switched for each selected language
 *     (and restored at the end), the entries are printed in the debug log and the whole
 *     database can be downloaded as a stand-alone JavaScript file.
 *
 * Selecting a category in the game is an ASP.NET postback: we replay it with the page
 * form for every category and read the item type select of each response.
 */
(function () {
    'use strict';

    const CATEGORY_SELECT_SELECTOR = 'select[id$="_ddlShopItemCategories"]';
    const ITEM_TYPE_OPTIONS_SELECTOR = 'select[id$="_ddlShopItemTypes"] option';
    const BOX_ID = 'pm-item-category-db-builder';
    const SHOPPING_ASSISTANT_PATH = '/World/Popmundo.aspx/Character/ShoppingAssistant';
    const ORIGINAL_LANGUAGE_KEY = DbBuilderHelper.ORIGINAL_LANGUAGE_KEY;
    const DOWNLOAD_FILE_NAME = 'item-category-searcher-data.generated.js';
    const DATA_FILE_HEADER = [
        '/**',
        ' * Item Category Searcher - master data',
        ' *',
        ' * Item types grouped by shop category, used by features/item-category-searcher.js.',
        ' *',
        ' * Credits: data originally compiled by Appriapos for the "Popmundo Item Category',
        ' * Searcher" user script (v1.0.2, MIT, https://greasyfork.org/users/733822).',
        ' * Ported to Popmundo Utils with the author\'s work acknowledged here.',
        ' *',
        ' * Shape: { <game language id>: { categories: { <categoryId>: { n: <category name>, i: { <itemTypeId>: <item name> } } } } }',
        ' * Language ids are the values of the game\'s language combo (see Utils.getGameLanguage()).',
        ' * Names are game data and are intentionally kept in the game language they belong to.',
        ' * Languages without an entry fall back to a guess based on the live category names.',
        ' */',
        '',
        '// eslint-disable-next-line no-unused-vars',
    ];

    const { el, createButton, fetchDocument, readLanguages, switchLanguage, restoreLanguage, downloadTextFile } = DbBuilderHelper;
    const runExclusive = (buttons, status, action) =>
        DbBuilderHelper.runExclusive(buttons, status, action, 'Item Category Database Builder');
    const LANGUAGE_SETTINGS_PATH = DbBuilderHelper.LANGUAGE_SETTINGS_PATH;

    /**
     * Finds the innermost div.box containing the given node.
     *
     * @param {Node} node
     * @return {HTMLElement|null}
     */
    function getContainingBox(node) {
        const boxes = Array.from(new CssSelectorHelper('div.box').getAll()).filter(box => box.contains(node));
        return boxes.length ? boxes[boxes.length - 1] : null;
    }

    // ── Reading the shop data ──────────────────────────────────────────────

    /**
     * Reads the real categories (placeholder excluded) from the game category select.
     *
     * @param {HTMLSelectElement} categorySelect
     * @return {Array<{id: string, name: string}>}
     */
    function readCategories(categorySelect) {
        return Array.from(new CssSelectorHelper('option').getAll(categorySelect))
            .filter(option => option.value !== '0')
            .map(option => ({ id: option.value, name: option.text.trim() }));
    }

    /**
     * Fetches the Shopping Assistant page with the given category selected, replaying the
     * game postback with the fields of the original form, and reads its item types.
     *
     * @param {HTMLFormElement} form
     * @param {HTMLSelectElement} categorySelect
     * @param {string} categoryId
     * @return {Promise<Object<string, string>>} item type id -> item name
     */
    async function readCategoryItems(form, categorySelect, categoryId) {
        const body = new URLSearchParams(new FormData(form));
        body.set('__EVENTTARGET', categorySelect.name);
        body.set('__EVENTARGUMENT', '');
        body.set(categorySelect.name, categoryId);

        const doc = await fetchDocument(SHOPPING_ASSISTANT_PATH, { method: 'POST', body });

        const items = {};
        new CssSelectorHelper(ITEM_TYPE_OPTIONS_SELECTOR).getAll(doc).forEach(option => {
            if (option.value !== '0') items[option.value] = option.text.trim();
        });
        return items;
    }

    /**
     * Reads all the categories and item types of the Shopping Assistant in the current game language.
     *
     * @param {function(string): void} onProgress Called with the progress message of each category
     * @return {Promise<{categories: Array<{id: string, name: string, items: Object<string, string>}>, failed: string[]}>}
     */
    async function crawlLanguage(onProgress) {
        const doc = await fetchDocument(SHOPPING_ASSISTANT_PATH);
        const categorySelect = new CssSelectorHelper(CATEGORY_SELECT_SELECTOR).getSingle(doc);
        const form = categorySelect && new CssSelectorHelper(DbBuilderHelper.FORM_SELECTOR).getSingle(doc);
        if (!form) throw new Error('Shopping Assistant form not found');

        const categories = readCategories(categorySelect);
        const result = [];
        const failed = [];

        for (let i = 0; i < categories.length; i++) {
            const category = categories[i];
            onProgress(chrome.i18n.getMessage('itemCategoryDbBuilderProgress',
                [category.name, String(i + 1), String(categories.length)]));
            try {
                const items = await readCategoryItems(form, categorySelect, category.id);
                result.push({ ...category, items });
            } catch (error) {
                Logger.warn(`Item Category Database Builder: unable to read category ${category.name} (${category.id})`, error);
                failed.push(category.name);
            }
        }
        return { categories: result, failed };
    }

    // ── Formatting ─────────────────────────────────────────────────────────

    /**
     * Formats the data as the entry to paste in ITEM_CATEGORY_SEARCHER_DB, with the same
     * layout used in item-category-searcher-data.js (ids in ascending numeric order).
     *
     * @param {{id: number, name: string}} language
     * @param {Array<{id: string, name: string, items: Object<string, string>}>} categories
     * @return {string}
     */
    function formatDatabaseEntry(language, categories) {
        const lines = [`    // ${language.name}`, `    ${language.id}: {`, '        categories: {'];
        categories
            .slice()
            .sort((a, b) => Number(a.id) - Number(b.id))
            .forEach(category => {
                // Integer-like keys are always serialized in ascending numeric order
                lines.push(`            ${category.id}: { n: ${JSON.stringify(category.name)}, i: ${JSON.stringify(category.items)} },`);
            });
        lines.push('        }', '    },');
        return lines.join('\n');
    }

    /**
     * Builds the content of a stand-alone data file from the formatted language entries.
     *
     * @param {Array<{id: number, entry: string}>} languageEntries
     * @return {string}
     */
    function formatDatabaseFile(languageEntries) {
        const entries = languageEntries.slice().sort((a, b) => a.id - b.id).map(item => item.entry);
        return [...DATA_FILE_HEADER, 'const ITEM_CATEGORY_SEARCHER_DB = {', ...entries, '};', ''].join('\n');
    }

    /**
     * Ids of the languages already present in the item category database.
     *
     * @return {number[]}
     */
    function getKnownLanguageIds() {
        return typeof ITEM_CATEGORY_SEARCHER_DB === 'undefined'
            ? []
            : Object.keys(ITEM_CATEGORY_SEARCHER_DB).map(Number);
    }

    /**
     * Builds the content of the downloadable file. When merging, the existing database is
     * included and the newly read languages override the existing ones with the same id.
     *
     * @param {Array<{id: number, entry: string}>} newEntries The newly read languages
     * @param {boolean} merge Whether to include the existing database
     * @param {Map<number, string>} languageNames Language names by id, used for the comments of existing languages
     * @return {string}
     */
    function buildFileContent(newEntries, merge, languageNames) {
        const entriesById = new Map();

        if (merge && typeof ITEM_CATEGORY_SEARCHER_DB !== 'undefined') {
            Object.entries(ITEM_CATEGORY_SEARCHER_DB).forEach(([key, data]) => {
                const id = Number(key);
                const categories = Object.entries(data.categories).map(([categoryId, category]) => ({
                    id: categoryId, name: category.n, items: category.i,
                }));
                entriesById.set(id, formatDatabaseEntry({ id, name: languageNames.get(id) || `Language ${id}` }, categories));
            });
        }
        newEntries.forEach(item => entriesById.set(item.id, item.entry));

        return formatDatabaseFile(Array.from(entriesById, ([id, entry]) => ({ id, entry })));
    }

    // ── UI ─────────────────────────────────────────────────────────────────

    /**
     * Builds the entry for the current game language and prints it in the debug log.
     *
     * @param {HTMLElement} status
     */
    async function buildCurrentLanguage(status) {
        const language = await Utils.getGameLanguage();
        if (!language) {
            status.textContent = chrome.i18n.getMessage('itemCategoryDbBuilderNoLanguage');
            return;
        }

        const { categories, failed } = await crawlLanguage(message => { status.textContent = message; });

        const itemCount = categories.reduce((sum, category) => sum + Object.keys(category.items).length, 0);
        Logger.debug(`Item category database for ${language.name} (id ${language.id}):\n${formatDatabaseEntry(language, categories)}`);

        status.textContent = chrome.i18n.getMessage('itemCategoryDbBuilderDone',
            [String(itemCount), String(categories.length), language.name, String(language.id)]);
        if (failed.length) {
            status.textContent += ' ' + chrome.i18n.getMessage('itemCategoryDbBuilderFailed',
                [String(failed.length), failed.join(', ')]);
        }
    }

    /**
     * Builds the entries of the selected languages, switching the account language for each one
     * and restoring it at the end, and prepares the stand-alone file for download.
     *
     * @param {Array<{id: number, name: string}>} selected
     * @param {boolean} skipKnown Whether to skip the languages already present in the database
     * @param {HTMLElement} status
     * @param {HTMLInputElement} downloadButton
     * @param {function(Array<{id: number, entry: string}>): void} setNewEntries Receives the newly read languages
     */
    async function buildLanguages(selected, skipKnown, status, downloadButton, setNewEntries) {
        if (!selected.length) {
            status.textContent = chrome.i18n.getMessage('itemCategoryDbBuilderNoneSelected');
            return;
        }

        let skippedLanguages = [];
        if (skipKnown) {
            const knownIds = getKnownLanguageIds();
            skippedLanguages = selected.filter(language => knownIds.includes(language.id));
            selected = selected.filter(language => !knownIds.includes(language.id));
            if (!selected.length) {
                status.textContent = chrome.i18n.getMessage('itemCategoryDbBuilderAllKnown');
                return;
            }
        }

        const original = await Utils.getGameLanguage();
        if (!original) {
            status.textContent = chrome.i18n.getMessage('itemCategoryDbBuilderNoLanguage');
            return;
        }

        downloadButton.style.display = 'none';
        const entries = [];
        const failedLanguages = [];

        // Remembered so the language can be restored even if this run is interrupted
        await chrome.storage.local.set({ [ORIGINAL_LANGUAGE_KEY]: original.id });
        try {
            for (let i = 0; i < selected.length; i++) {
                const language = selected[i];
                const prefix = message => chrome.i18n.getMessage('itemCategoryDbBuilderLanguageProgress',
                    [language.name, String(i + 1), String(selected.length), message]);
                try {
                    status.textContent = prefix('...');
                    await switchLanguage(language.id);
                    const { categories, failed } = await crawlLanguage(message => { status.textContent = prefix(message); });
                    if (failed.length) {
                        // An incomplete language would silently lose items, so it is left out
                        throw new Error(`Categories not read: ${failed.join(', ')}`);
                    }
                    const entry = formatDatabaseEntry(language, categories);
                    Logger.debug(`Item category database for ${language.name} (id ${language.id}):\n${entry}`);
                    entries.push({ id: language.id, entry });
                } catch (error) {
                    Logger.warn(`Item Category Database Builder: language ${language.name} (${language.id}) skipped`, error);
                    failedLanguages.push(language.name);
                }
            }
        } finally {
            try {
                await restoreLanguage(original.id);
            } catch (error) {
                Logger.error('Item Category Database Builder: unable to restore the game language', error);
                status.textContent = chrome.i18n.getMessage('itemCategoryDbBuilderRestoreFailed');
                // The marker is kept: the Restore button is shown at the next visit
                setNewEntries(entries);
                downloadButton.style.display = entries.length ? '' : 'none';
                return;
            }
        }

        setNewEntries(entries);
        downloadButton.style.display = entries.length ? '' : 'none';
        status.textContent = chrome.i18n.getMessage('itemCategoryDbBuilderAllDone',
            [String(entries.length), entries.map(item => item.id).join(', ')]);
        if (skippedLanguages.length) {
            status.textContent += ' ' + chrome.i18n.getMessage('itemCategoryDbBuilderLanguagesSkipped',
                [skippedLanguages.map(language => language.name).join(', ')]);
        }
        if (failedLanguages.length) {
            status.textContent += ' ' + chrome.i18n.getMessage('itemCategoryDbBuilderLanguagesFailed',
                [failedLanguages.join(', ')]);
        }
    }

    /**
     * Fills the language checklist from the language settings page.
     *
     * @param {HTMLElement} list
     * @param {HTMLElement} status
     * @param {Map<number, string>} languageNames Filled with the language names by id
     * @return {Promise<void>}
     */
    async function fillLanguageList(list, status, languageNames) {
        status.textContent = chrome.i18n.getMessage('itemCategoryDbBuilderLoadingLanguages');
        const { languages } = readLanguages(await fetchDocument(LANGUAGE_SETTINGS_PATH));

        languages.forEach(language => {
            languageNames.set(language.id, language.name);

            const checkbox = el('input');
            checkbox.type = 'checkbox';
            checkbox.id = `${BOX_ID}-lang-${language.id}`;
            checkbox.checked = language.active;
            checkbox.dataset.languageId = String(language.id);
            checkbox.dataset.languageName = language.name;

            const label = el('label', ` ${language.name}${language.active ? '' : ' *'}`);
            label.htmlFor = checkbox.id;

            const item = el('span');
            item.style.display = 'inline-block';
            item.style.marginRight = '1em';
            item.append(checkbox, label);
            list.appendChild(item);
        });
        status.textContent = '';
    }

    /**
     * Builds the developer box.
     *
     * @param {boolean} needsRestore True when a previous multi-language run did not restore the language
     * @return {HTMLElement}
     */
    function buildBox(needsRestore) {
        const box = el('div');
        box.className = 'box';
        box.id = BOX_ID;
        box.appendChild(el('h2', chrome.i18n.getMessage('itemCategoryDbBuilderTitle')));

        // Current language
        box.appendChild(el('p', chrome.i18n.getMessage('itemCategoryDbBuilderInfo')));
        const currentButton = createButton(chrome.i18n.getMessage('itemCategoryDbBuilderButton'));
        const currentParagraph = el('p');
        currentParagraph.appendChild(currentButton);
        box.appendChild(currentParagraph);

        // Several languages
        box.appendChild(el('h3', chrome.i18n.getMessage('itemCategoryDbBuilderAllTitle')));
        box.appendChild(el('p', chrome.i18n.getMessage('itemCategoryDbBuilderAllInfo')));
        const languageList = el('p');
        box.appendChild(languageList);

        /**
         * Creates a labelled checkbox in its own paragraph.
         *
         * @param {string} label
         * @param {boolean} checked
         * @return {HTMLInputElement}
         */
        let optionCount = 0;
        const addOption = (label, checked) => {
            const checkbox = el('input');
            checkbox.type = 'checkbox';
            checkbox.id = `${BOX_ID}-option-${optionCount++}`;
            checkbox.checked = checked;
            const optionLabel = el('label', ' ' + label);
            optionLabel.htmlFor = checkbox.id;
            const paragraph = el('p');
            paragraph.append(checkbox, optionLabel);
            box.appendChild(paragraph);
            return checkbox;
        };
        const skipKnownCheckbox = addOption(chrome.i18n.getMessage('itemCategoryDbBuilderSkipKnown'), false);
        const mergeCheckbox = addOption(chrome.i18n.getMessage('itemCategoryDbBuilderMerge'), true);

        const allButton = createButton(chrome.i18n.getMessage('itemCategoryDbBuilderBuildAll'));
        const downloadButton = createButton(chrome.i18n.getMessage('itemCategoryDbBuilderDownload'));
        downloadButton.style.display = 'none';
        const restoreButton = createButton(chrome.i18n.getMessage('itemCategoryDbBuilderRestore'));
        const allParagraph = el('p');
        allParagraph.append(allButton, ' ', downloadButton);
        box.appendChild(allParagraph);

        const status = el('p');
        box.appendChild(status);

        if (needsRestore) {
            const restoreParagraph = el('p', chrome.i18n.getMessage('itemCategoryDbBuilderRestoreInfo') + ' ');
            restoreParagraph.appendChild(restoreButton);
            box.insertBefore(restoreParagraph, box.children[1]);
        }

        const buttons = [currentButton, allButton, restoreButton, skipKnownCheckbox, mergeCheckbox];
        const languageNames = new Map();
        let newEntries = [];

        currentButton.addEventListener('click', () => runExclusive(buttons, status, () => buildCurrentLanguage(status)));

        allButton.addEventListener('click', () => runExclusive(buttons, status, () => {
            const selected = Array.from(new CssSelectorHelper('input[type="checkbox"]').getAll(languageList))
                .filter(checkbox => checkbox.checked)
                .map(checkbox => ({ id: parseInt(checkbox.dataset.languageId), name: checkbox.dataset.languageName }));
            return buildLanguages(selected, skipKnownCheckbox.checked, status, downloadButton, entries => { newEntries = entries; });
        }));

        // The merge option is read here, so it can be changed after a run
        downloadButton.addEventListener('click', () => {
            if (newEntries.length) {
                downloadTextFile(DOWNLOAD_FILE_NAME, buildFileContent(newEntries, mergeCheckbox.checked, languageNames));
            }
        });

        restoreButton.addEventListener('click', () => runExclusive(buttons, status, async () => {
            const stored = await chrome.storage.local.get({ [ORIGINAL_LANGUAGE_KEY]: null });
            if (stored[ORIGINAL_LANGUAGE_KEY] === null) return;
            await restoreLanguage(stored[ORIGINAL_LANGUAGE_KEY]);
            restoreButton.parentNode.remove();
        }));

        runExclusive(buttons, status, () => fillLanguageList(languageList, status, languageNames));

        return box;
    }

    /**
     * Injects the builder box right before the game's shop search box.
     */
    async function injectBuilder() {
        if (new CssSelectorHelper(`#${BOX_ID}`).getSingle()) return;

        const categorySelect = new CssSelectorHelper(CATEGORY_SELECT_SELECTOR).getSingle();
        if (!categorySelect) return;

        const searchBox = getContainingBox(categorySelect);
        if (!searchBox) return;

        const stored = await chrome.storage.local.get({ [ORIGINAL_LANGUAGE_KEY]: null });
        // The box may have been injected by a concurrent call while we were waiting
        if (new CssSelectorHelper(`#${BOX_ID}`).getSingle()) return;

        searchBox.parentNode.insertBefore(buildBox(stored[ORIGINAL_LANGUAGE_KEY] !== null), searchBox);
    }

    chrome.storage.local.get({ install_type: '' }, function (items) {
        if (items.install_type !== 'development') return;

        chrome.storage.sync.get({ item_category_db_builder: false }, function (options) {
            if (!options.item_category_db_builder) return;

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', injectBuilder);
            } else {
                injectBuilder();
            }
        });
    });
})();
