/**
 * Item Category Searcher
 *
 * Adds an "Item Category Searcher" box on the Shopping Assistant page
 * (https://<server>.popmundo.com/World/Popmundo.aspx/Character/ShoppingAssistant)
 * to find the shop category of an item by name. Clicking a result selects its
 * category and item type in the game's own search selects (two ASP.NET postbacks),
 * then scrolls back to the shop search box.
 *
 * Credits: this feature is a port of the "Popmundo Item Category Searcher" user
 * script (v1.0.2, MIT) by Appriapos (https://greasyfork.org/users/733822). The
 * original custom-styled box has been rebuilt with standard Popmundo markup
 * (div.box, table.data, game inputs) so it follows the active game skin.
 *
 * The feature is disabled by default and enabled from Misc Options
 * (`item_category_searcher_enable` in chrome.storage.sync).
 *
 * Data comes from features/item-category-searcher-data.js (ITEM_CATEGORY_SEARCHER_DB),
 * keyed by game language id. The language is read with Utils.getGameLanguage(); when
 * there is no data for it, the language is guessed from the live category names.
 */
(function () {
    'use strict';

    const CATEGORY_SELECT_SELECTOR = 'select[id$="_ddlShopItemCategories"]';
    const ITEM_SELECT_SELECTOR = 'select[id$="_ddlShopItemTypes"]';
    const BOX_ID = 'pm-item-category-searcher';
    // sessionStorage is tab scoped and survives the postbacks triggered by the game selects
    const PENDING_KEY = 'pu-ics-pending';
    const MIN_CHARS = 2;
    const DEFAULT_MAX_RESULTS = 25;
    const MAX_RESULTS_LIMIT = 100;
    const SEARCH_DEBOUNCE_MS = 200;
    // Game language id (US English) used when no language can be determined
    const DEFAULT_LANGUAGE_ID = '2';

    /**
     * Creates an element with optional text content.
     *
     * @param {string} tag
     * @param {string} [text]
     * @return {HTMLElement}
     */
    function el(tag, text) {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        return node;
    }

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

    /**
     * Sets a select value and fires its change event. This runs the game's inline
     * postback handler and keeps the Searchable Selects filter input in sync.
     *
     * @param {HTMLSelectElement} select
     * @param {string} value
     */
    function changeSelect(select, value) {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function readPending() {
        try {
            return JSON.parse(sessionStorage.getItem(PENDING_KEY));
        } catch (_) {
            return null;
        }
    }

    function writePending(data) {
        try {
            if (data) sessionStorage.setItem(PENDING_KEY, JSON.stringify(data));
            else sessionStorage.removeItem(PENDING_KEY);
        } catch (_) { /* storage unavailable: the item will need a manual selection */ }
    }

    /**
     * Picks the DB language whose category names best match the live category select.
     * Only used as a fallback when the game language has no data (or cannot be retrieved).
     *
     * @param {HTMLSelectElement} categorySelect
     * @return {{lang: string, matched: boolean}}
     */
    function detectLanguage(categorySelect) {
        const liveNames = new Set(Array.from(categorySelect.options).map(o => o.text.trim().toLowerCase()));
        let best = { lang: DEFAULT_LANGUAGE_ID, score: 0 };
        Object.entries(ITEM_CATEGORY_SEARCHER_DB).forEach(([lang, data]) => {
            const score = Object.values(data.categories)
                .filter(category => liveNames.has(category.n.toLowerCase())).length;
            if (score > best.score) best = { lang, score };
        });
        return { lang: best.lang, matched: best.score > 0 };
    }

    /**
     * Resolves the DB language to use: the user's game language when we have data for it,
     * otherwise a guess based on the live category names.
     *
     * @param {HTMLSelectElement} categorySelect
     * @return {Promise<{lang: string, matched: boolean}>}
     */
    async function resolveDbLanguage(categorySelect) {
        const gameLanguage = await Utils.getGameLanguage();
        if (gameLanguage && ITEM_CATEGORY_SEARCHER_DB[gameLanguage.id]) {
            return { lang: String(gameLanguage.id), matched: true };
        }
        return detectLanguage(categorySelect);
    }

    /**
     * Flattens the DB categories into a searchable list, using the live category
     * names (game language) when available.
     *
     * @param {object} categories
     * @param {HTMLSelectElement} categorySelect
     * @return {Array<{itemId: string, itemName: string, categoryId: string, categoryName: string}>}
     */
    function buildItemList(categories, categorySelect) {
        const liveNames = {};
        Array.from(categorySelect.options).forEach(o => { liveNames[o.value] = o.text.trim(); });

        const items = [];
        Object.entries(categories).forEach(([categoryId, category]) => {
            const categoryName = liveNames[categoryId] || category.n;
            Object.entries(category.i).forEach(([itemId, itemName]) => {
                items.push({ itemId, itemName, categoryId, categoryName });
            });
        });
        return items;
    }

    /**
     * Starts the selection of an item in the game search selects.
     *
     * @param {HTMLSelectElement} categorySelect
     * @param {{itemId: string, categoryId: string}} item
     */
    function selectItem(categorySelect, item) {
        const itemSelect = new CssSelectorHelper(ITEM_SELECT_SELECTOR).getSingle();
        if (categorySelect.value === item.categoryId && itemSelect) {
            writePending({ step: 'scroll' });
            changeSelect(itemSelect, item.itemId);
            return;
        }

        writePending({ step: 'select-item', categoryId: item.categoryId, itemId: item.itemId });
        changeSelect(categorySelect, item.categoryId);
    }

    /**
     * Resumes a selection started before a postback.
     *
     * @param {HTMLSelectElement} categorySelect
     */
    function resumePending(categorySelect) {
        const pending = readPending();
        if (!pending) return;
        writePending(null);

        if (pending.step === 'select-item') {
            const itemSelect = new CssSelectorHelper(ITEM_SELECT_SELECTOR).getSingle();
            const hasOption = itemSelect
                && Array.from(itemSelect.options).some(o => o.value === String(pending.itemId));
            if (categorySelect.value !== String(pending.categoryId) || !hasOption) {
                Logger.debug(`Item Category Searcher: unable to select item ${pending.itemId} in category ${pending.categoryId}`);
                return;
            }
            writePending({ step: 'scroll' });
            changeSelect(itemSelect, String(pending.itemId));
        } else if (pending.step === 'scroll') {
            // Scroll to the box: with Searchable Selects on the native select is hidden
            const searchBox = getContainingBox(categorySelect);
            if (searchBox) searchBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /**
     * Appends the item name to a cell, highlighting the matched part.
     *
     * @param {HTMLElement} parent
     * @param {string} name
     * @param {number} start
     * @param {number} length
     */
    function appendHighlighted(parent, name, start, length) {
        if (start > 0) parent.appendChild(document.createTextNode(name.slice(0, start)));
        parent.appendChild(el('strong', name.slice(start, start + length)));
        if (start + length < name.length) parent.appendChild(document.createTextNode(name.slice(start + length)));
    }

    /**
     * Builds the searcher box and wires its behaviour.
     *
     * @param {HTMLSelectElement} categorySelect
     * @param {{lang: string, matched: boolean}} language The resolved DB language
     * @return {HTMLElement}
     */
    function buildBox(categorySelect, { lang, matched }) {
        const categories = ITEM_CATEGORY_SEARCHER_DB[lang].categories;
        const items = buildItemList(categories, categorySelect);

        const box = el('div');
        box.className = 'box';
        box.id = BOX_ID;
        box.appendChild(el('h2', chrome.i18n.getMessage('itemCategorySearcherTitle')));

        box.appendChild(el('p', chrome.i18n.getMessage('itemCategorySearcherInfo',
            [items.length.toLocaleString(), String(Object.keys(categories).length)])));
        if (!matched) box.appendChild(el('p', chrome.i18n.getMessage('itemCategorySearcherLanguageFallback')));

        // Search controls
        const controls = el('p');

        const searchInput = el('input');
        searchInput.type = 'text';
        searchInput.id = `${BOX_ID}-search`;
        searchInput.className = 'round';
        searchInput.setAttribute('autocomplete', 'off');
        const searchLabel = el('label', chrome.i18n.getMessage('itemCategorySearcherSearchLabel') + ' ');
        searchLabel.htmlFor = searchInput.id;

        const regexCheckbox = el('input');
        regexCheckbox.type = 'checkbox';
        regexCheckbox.id = `${BOX_ID}-regex`;
        const regexLabel = el('label', chrome.i18n.getMessage('itemCategorySearcherRegexLabel'));
        regexLabel.htmlFor = regexCheckbox.id;

        const maxInput = el('input');
        maxInput.type = 'number';
        maxInput.id = `${BOX_ID}-max`;
        maxInput.className = 'round';
        maxInput.min = '1';
        maxInput.max = String(MAX_RESULTS_LIMIT);
        maxInput.value = String(DEFAULT_MAX_RESULTS);
        maxInput.style.width = '4em';
        const maxLabel = el('label', chrome.i18n.getMessage('itemCategorySearcherMaxLabel') + ' ');
        maxLabel.htmlFor = maxInput.id;

        controls.append(searchLabel, searchInput, ' ', regexCheckbox, ' ', regexLabel, el('br'), maxLabel, maxInput);
        box.appendChild(controls);

        const status = el('p');
        box.appendChild(status);

        // The results table is created lazily on the first search: Searchable Tables
        // initialises DataTables on table.data only at page load, so it never wraps it.
        let table = null;
        let tbody = null;

        function getTbody() {
            if (tbody) return tbody;
            box.appendChild(el('p', chrome.i18n.getMessage('itemCategorySearcherSelectHint')));
            table = el('table');
            table.className = 'data';
            const thead = el('thead');
            const headRow = el('tr');
            headRow.appendChild(el('th', '#'));
            headRow.appendChild(el('th', chrome.i18n.getMessage('itemCategorySearcherColItem')));
            headRow.appendChild(el('th', chrome.i18n.getMessage('itemCategorySearcherColCategory')));
            thead.appendChild(headRow);
            tbody = el('tbody');
            table.append(thead, tbody);
            box.appendChild(table);
            return tbody;
        }

        function setTableVisible(visible) {
            if (table) table.style.display = visible ? '' : 'none';
        }

        function search() {
            const term = searchInput.value.trim();
            if (term.length < MIN_CHARS) {
                status.textContent = term.length ? chrome.i18n.getMessage('itemCategorySearcherMinChars', [String(MIN_CHARS)]) : '';
                setTableVisible(false);
                return;
            }

            let regex;
            try {
                const source = regexCheckbox.checked ? term : term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                regex = new RegExp(source, 'i');
            } catch (_) {
                status.textContent = chrome.i18n.getMessage('itemCategorySearcherInvalidRegex');
                setTableVisible(false);
                return;
            }

            let maxResults = parseInt(maxInput.value, 10);
            if (isNaN(maxResults) || maxResults < 1) maxResults = DEFAULT_MAX_RESULTS;
            maxResults = Math.min(maxResults, MAX_RESULTS_LIMIT);

            const matches = [];
            items.forEach(item => {
                const match = regex.exec(item.itemName);
                if (match && match[0].length) matches.push({ item, index: match.index, length: match[0].length });
            });

            if (!matches.length) {
                status.textContent = chrome.i18n.getMessage('itemCategorySearcherNoMatches');
                setTableVisible(false);
                return;
            }

            matches.sort((a, b) => a.index - b.index || a.item.itemName.localeCompare(b.item.itemName));
            const shown = matches.slice(0, maxResults);
            status.textContent = chrome.i18n.getMessage('itemCategorySearcherMatches',
                [String(shown.length), String(matches.length)]);

            const body = getTbody();
            body.replaceChildren();
            shown.forEach(({ item, index, length }, rowIndex) => {
                const row = el('tr');
                row.className = rowIndex % 2 === 0 ? 'odd' : 'even';

                const link = el('a');
                link.href = '#';
                appendHighlighted(link, item.itemName, index, length);
                link.addEventListener('click', event => {
                    event.preventDefault();
                    selectItem(categorySelect, item);
                });

                const nameCell = el('td');
                nameCell.appendChild(link);

                row.appendChild(el('td', String(rowIndex + 1)));
                row.appendChild(nameCell);
                row.appendChild(el('td', item.categoryName));
                body.appendChild(row);
            });
            setTableVisible(true);
        }

        let debounceTimer = null;
        const scheduleSearch = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(search, SEARCH_DEBOUNCE_MS);
        };
        searchInput.addEventListener('input', scheduleSearch);
        maxInput.addEventListener('input', scheduleSearch);
        regexCheckbox.addEventListener('change', search);
        // Enter would submit the game's ASP.NET form
        searchInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') event.preventDefault();
        });
        maxInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') event.preventDefault();
        });

        return box;
    }

    /**
     * Injects the searcher box right before the game's shop search box.
     */
    async function injectSearcher() {
        if (new CssSelectorHelper(`#${BOX_ID}`).getSingle()) return;

        const categorySelect = new CssSelectorHelper(CATEGORY_SELECT_SELECTOR).getSingle();
        if (!categorySelect) return;

        const searchBox = getContainingBox(categorySelect);
        if (!searchBox) return;

        const language = await resolveDbLanguage(categorySelect);
        // The box may have been injected by a concurrent call while we were waiting
        if (new CssSelectorHelper(`#${BOX_ID}`).getSingle()) return;

        searchBox.parentNode.insertBefore(buildBox(categorySelect, language), searchBox);
        resumePending(categorySelect);
    }

    chrome.storage.sync.get({ item_category_searcher_enable: false }, function (items) {
        if (!items.item_category_searcher_enable) return;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectSearcher);
        } else {
            injectSearcher();
        }
    });
})();
