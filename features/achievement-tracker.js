/**
 * Achievement Tracker
 *
 * Adds a collapsible "Missing achievements" box on the Character Achievements page
 * (https://<server>.popmundo.com/World/Popmundo.aspx/Character/Achievements/<id>)
 * listing every achievement the character does not own yet, with category filters.
 * Achievements that can no longer be obtained because their mutually exclusive
 * counterpart is already owned are shown struck through.
 *
 * Credits: this feature is a port of the "Popmundo Missing Achievement Tracker"
 * user script (v1.3, GPL-3.0-or-later) by Ashly Fangorn [3438789]. The original
 * custom-styled panel has been rebuilt with standard Popmundo markup (div.box,
 * table.data, game achievement icons) so it follows the active game skin.
 *
 * The feature is disabled by default and enabled from Misc Options
 * (`achievement_tracker_enable` in chrome.storage.sync). Category filter state is
 * stored in `achievement_tracker_hidden_categories`.
 *
 * Data comes from features/achievement-tracker-data.js
 * (ACHIEVEMENT_TRACKER_INFO, ACHIEVEMENT_TRACKER_DB, ACHIEVEMENT_TRACKER_EXCLUSIONS).
 */
(function () {
    'use strict';

    const OWNED_ICON_SELECTOR = '#ppm-content .Achievement';
    const TABLE_WRAPPER_SELECTOR = '#tableach_wrapper';
    const TABLE_SELECTOR = '#tableach';
    const BOX_ID = 'pm-achievement-tracker';
    const ACHIEVEMENT_CLASS_RE = /\bAchievement_(\d+)\b/;

    const CATEGORIES = ['PPM', 'TGH', 'GENERIC', 'PASSIVE'];

    // US English: the only language with achievement names for now, and the fallback for the others.
    const FALLBACK_LANGUAGE_ID = 2;

    /**
     * Joins the language independent data and the names of the given language by achievement id.
     * Ids without a name in that language fall back to the English one.
     *
     * @param {number} languageId Game language id.
     * @return {Array<[number, string, string, number]>} Rows of [id, name, category, points].
     */
    function getAchievements(languageId) {
        const names = ACHIEVEMENT_TRACKER_DB[languageId] || {};
        const fallbackNames = ACHIEVEMENT_TRACKER_DB[FALLBACK_LANGUAGE_ID];
        return Object.entries(ACHIEVEMENT_TRACKER_INFO).map(([id, [category, points]]) =>
            [Number(id), names[id] ?? fallbackNames[id], category, points]);
    }

    /**
     * Reads the ids of the achievements displayed on the page.
     *
     * @return {Set<number>}
     */
    function getOwnedIds() {
        const owned = new Set();
        new CssSelectorHelper(OWNED_ICON_SELECTOR).getAll().forEach(el => {
            const match = ACHIEVEMENT_CLASS_RE.exec(el.className);
            if (match) owned.add(parseInt(match[1], 10));
        });
        return owned;
    }

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
     * Builds the tracker box and wires its behaviour.
     *
     * @param {Array<[number, string, string, number]>} missing Missing achievements.
     * @param {Set<number>} owned Owned achievement ids.
     * @param {Set<string>} hidden Hidden categories (mutated by the filters).
     * @return {HTMLElement}
     */
    function buildBox(missing, owned, hidden) {
        const box = el('div');
        box.className = 'box';
        box.id = BOX_ID;

        const title = el('h2');
        title.setAttribute('role', 'button');
        title.setAttribute('tabindex', '0');
        title.setAttribute('aria-expanded', 'false');
        title.style.cursor = 'pointer';
        box.appendChild(title);

        const body = el('div');
        body.style.display = 'none';
        box.appendChild(body);

        if (missing.length === 0) {
            title.textContent = '▸ ' + chrome.i18n.getMessage('achievementTrackerTitle', ['0']);
            body.appendChild(el('p', chrome.i18n.getMessage('achievementTrackerNoneMissing')));
        }

        const summary = el('p');
        const filters = el('p');
        const table = el('table');
        table.className = 'data';
        const tbody = el('tbody');

        function render() {
            const visible = missing.filter(item => !hidden.has(item[2]));
            const arrow = body.style.display === 'none' ? '▸ ' : '▾ ';
            title.textContent = arrow + chrome.i18n.getMessage('achievementTrackerTitle', [String(missing.length)]);
            summary.textContent = chrome.i18n.getMessage('achievementTrackerSummary',
                [String(visible.length), String(missing.length)]);

            tbody.replaceChildren();
            visible.forEach(([id, name, , points], index) => {
                const row = el('tr');
                row.className = index % 2 === 0 ? 'odd' : 'even';

                const iconCell = el('td');
                const icon = el('div');
                icon.className = `Achievement Achievement_${id}`;
                icon.title = name;
                iconCell.appendChild(icon);

                const nameCell = el('td');
                const rivalId = ACHIEVEMENT_TRACKER_EXCLUSIONS[id];
                if (rivalId && owned.has(rivalId)) {
                    const lockedMsg = chrome.i18n.getMessage('achievementTrackerLocked');
                    const struck = el('s', name);
                    struck.title = lockedMsg;
                    nameCell.appendChild(struck);
                    nameCell.appendChild(el('br'));
                    nameCell.appendChild(el('em', lockedMsg));
                } else {
                    nameCell.textContent = name;
                }

                row.appendChild(iconCell);
                row.appendChild(nameCell);
                row.appendChild(el('td', String(points)));
                tbody.appendChild(row);
            });
        }

        function toggle() {
            const expanded = body.style.display === 'none';
            body.style.display = expanded ? '' : 'none';
            title.setAttribute('aria-expanded', String(expanded));
            const text = title.textContent.slice(2);
            title.textContent = (expanded ? '▾ ' : '▸ ') + text;
        }

        title.addEventListener('click', toggle);
        title.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle();
            }
        });

        if (missing.length === 0) return box;

        // Category filters
        filters.appendChild(document.createTextNode(chrome.i18n.getMessage('achievementTrackerShow') + ' '));
        CATEGORIES.forEach(category => {
            const checkboxId = `${BOX_ID}-cat-${category}`;
            const checkbox = el('input');
            checkbox.type = 'checkbox';
            checkbox.id = checkboxId;
            checkbox.checked = !hidden.has(category);
            checkbox.addEventListener('change', function () {
                if (checkbox.checked) hidden.delete(category);
                else hidden.add(category);
                chrome.storage.sync.set({ achievement_tracker_hidden_categories: Array.from(hidden) });
                render();
            });

            const label = el('label', chrome.i18n.getMessage(`achievementTrackerCategory${category}`));
            label.htmlFor = checkboxId;

            filters.appendChild(checkbox);
            filters.appendChild(document.createTextNode(' '));
            filters.appendChild(label);
            filters.appendChild(document.createTextNode(' '));
        });

        // Table header
        const thead = el('thead');
        const headRow = el('tr');
        headRow.appendChild(el('th'));
        headRow.appendChild(el('th', chrome.i18n.getMessage('achievementTrackerColName')));
        headRow.appendChild(el('th', chrome.i18n.getMessage('achievementTrackerColPoints')));
        thead.appendChild(headRow);
        table.appendChild(thead);
        table.appendChild(tbody);

        body.appendChild(summary);
        body.appendChild(filters);
        body.appendChild(table);

        render();
        return box;
    }

    /**
     * Injects the tracker box right before the owned achievements table.
     *
     * @param {string[]} hiddenCategories
     */
    function injectTracker(hiddenCategories) {
        if (new CssSelectorHelper(`#${BOX_ID}`).getSingle()) return;

        const anchor = new CssSelectorHelper(TABLE_WRAPPER_SELECTOR).getSingle()
            || new CssSelectorHelper(TABLE_SELECTOR).getSingle();
        if (!anchor) return;

        const owned = getOwnedIds();
        const missing = getAchievements(FALLBACK_LANGUAGE_ID).filter(item => !owned.has(item[0]));
        const box = buildBox(missing, owned, new Set(hiddenCategories));

        anchor.parentNode.insertBefore(box, anchor);
    }

    chrome.storage.sync.get({
        achievement_tracker_enable: false,
        achievement_tracker_hidden_categories: ['PASSIVE'],
    }, function (items) {
        if (!items.achievement_tracker_enable) return;

        const run = () => injectTracker(items.achievement_tracker_hidden_categories);
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            run();
        }
    });
})();
