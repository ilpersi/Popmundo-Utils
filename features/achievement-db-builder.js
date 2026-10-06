/**
 * Achievement Database Builder (developer mode only)
 *
 * On the Character Achievements page, adds a box that reads the achievements owned by the
 * character of the page (id, name and points) and builds the matching data of
 * features/achievement-tracker-data.js (ACHIEVEMENT_TRACKER_DB, with the names of the
 * achievements by game language):
 *   - for the current game language: the entry is printed in the debug log, ready to be
 *     pasted in features/achievement-tracker-data.js;
 *   - for several languages: the account language is switched for each selected language
 *     (and restored at the end), the entries are printed in the debug log and the whole
 *     data file can be downloaded as a stand-alone JavaScript file.
 *
 * A character only shows the achievements it owns, so the names of a language are partial.
 * When merging, the existing names of a language are kept and the newly read ones are added
 * to them (or override the same ids).
 *
 * The page has no category, but its "Other Achievements" table lists the achievements earned in
 * the other game, which are exclusive to it: TGH for a Popmundo character, PPM for a Great Heist
 * one (the game of the character comes from its character page, see Utils.parseCharacterGame()).
 * They set (or fix) the category in ACHIEVEMENT_TRACKER_INFO,
 * unless they contradict most of the known data, which means the game was detected wrong. Other
 * ids that are not in ACHIEVEMENT_TRACKER_INFO yet are added as GENERIC and reported.
 *
 * The language switching helpers are shared with the item category builder (DbBuilderHelper).
 */
(function () {
    'use strict';

    // The achievements of the game the character plays, and the "Other Achievements" of the other game
    const OWN_ROW_SELECTOR = '#tableach tbody tr';
    const OTHER_ROW_SELECTOR = '#tablesurp tbody tr';
    const ICON_SELECTOR = '.Achievement';
    const TABLE_WRAPPER_SELECTOR = '#tableach_wrapper';
    const TABLE_SELECTOR = '#tableach';
    const ACHIEVEMENT_CLASS_RE = /\bAchievement_(\d+)\b/;
    const CHARACTER_ID_RE = /\/Achievements\/(\d+)/;
    const BOX_ID = 'pm-achievement-db-builder';
    const ACHIEVEMENTS_PATH = '/World/Popmundo.aspx/Character/Achievements';
    const CHARACTER_PATH = '/World/Popmundo.aspx/Character';
    const ORIGINAL_LANGUAGE_KEY = DbBuilderHelper.ORIGINAL_LANGUAGE_KEY;
    const LANGUAGE_SETTINGS_PATH = DbBuilderHelper.LANGUAGE_SETTINGS_PATH;
    const DOWNLOAD_FILE_NAME = 'achievement-tracker-data.generated.js';
    // New achievements that cannot be classified get this category until it is fixed by hand
    const DEFAULT_CATEGORY = 'GENERIC';
    // US English: its names are used as the comment of the exclusion pairs
    const ENGLISH_LANGUAGE_ID = 2;
    const INFO_PER_LINE = 6;
    const NAMES_PER_LINE = 2;
    const DATA_FILE_HEADER = [
        '/**',
        ' * Achievement Tracker - master data',
        ' *',
        ' * Achievement list and mutually exclusive pairs used by features/achievement-tracker.js.',
        ' *',
        ' * Credits: data originally compiled by Ashly Fangorn [3438789] for the',
        ' * "Popmundo Missing Achievement Tracker" user script (v1.3, GPL-3.0-or-later).',
        ' * Ported to Popmundo Utils with the author\'s work acknowledged here.',
        ' *',
        ' * The data is split in two structures joined by the achievement id:',
        ' * - ACHIEVEMENT_TRACKER_INFO: language independent data, { <achievementId>: [<category>, <points>] }.',
        ' *   Category is one of: PPM (Popmundo), TGH (The Great Heist), GENERIC, PASSIVE.',
        ' * - ACHIEVEMENT_TRACKER_DB: achievement names, { <game language id>: { <achievementId>: <name> } }.',
        ' *   Language ids are the values of the game\'s language combo (see Utils.getGameLanguage()),',
        ' *   the same ones used by ITEM_CATEGORY_SEARCHER_DB. 2 is US English.',
        ' * Names are game data and are intentionally kept in the game language they belong to.',
        ' * Ids without a name in the user\'s language fall back to English (language 2).',
        ' */',
        '',
    ];

    const { el, createButton, fetchDocument, readLanguages, switchLanguage, restoreLanguage, downloadTextFile } = DbBuilderHelper;
    const runExclusive = (buttons, status, action) =>
        DbBuilderHelper.runExclusive(buttons, status, action, 'Achievement Database Builder');

    // ── Reading the achievements ───────────────────────────────────────────

    /**
     * Gets the id of the character whose achievements are shown: the one in the page address,
     * or your own character on the address without id.
     *
     * @return {number} The character id, or 0 when it cannot be determined
     */
    function getCharacterId() {
        const match = CHARACTER_ID_RE.exec(window.location.pathname);
        return match ? parseInt(match[1], 10) : Utils.getMyID();
    }

    /**
     * Reads the game played by a character from its character page (not from the logged-in account,
     * which is what Utils.isGreatHeist() describes). It does not change with the game language, so it
     * is asked once per run.
     *
     * @param {number} characterId
     * @return {Promise<string|null>} 'ppm' for Popmundo, 'tgh' for The Great Heist, null when it cannot be told
     */
    async function detectCharacterGame(characterId) {
        let game = null;
        try {
            game = Utils.parseCharacterGame(await fetchDocument(`${CHARACTER_PATH}/${characterId}`));
        } catch (error) {
            Logger.warn(`Achievement Database Builder: unable to read the game of character ${characterId}`, error);
        }
        Logger.debug(`Achievement Database Builder: the game of character ${characterId} is ${game || 'unknown'}`);
        return game;
    }

    /**
     * Gets the category of the achievements shown in the "Other Achievements" table: they belong to the
     * game the character does not play.
     *
     * @param {string|null} game The game of the character, as returned by detectCharacterGame()
     * @return {string|null} 'TGH' for a Popmundo character, 'PPM' for a Great Heist one, null when the game is unknown
     */
    function getOtherGameCategory(game) {
        if (game === 'ppm') return 'TGH';
        if (game === 'tgh') return 'PPM';
        return null;
    }

    /**
     * Gets the name of a game to show in the progress messages.
     *
     * @param {string|null} game The game of the character, as returned by detectCharacterGame()
     * @return {string}
     */
    function describeGame(game) {
        if (game === 'ppm') return chrome.i18n.getMessage('achievementDbBuilderGamePpm');
        if (game === 'tgh') return chrome.i18n.getMessage('achievementDbBuilderGameTgh');
        return chrome.i18n.getMessage('achievementDbBuilderGameNone');
    }

    /**
     * Reads the achievements of the rows matching a selector.
     *
     * @param {Document} doc The parsed achievements page
     * @param {string} rowSelector
     * @param {string|null} category The category the rows are known to have, or null
     * @return {Array<{id: number, name: string, points: number, category: string|null}>}
     */
    function readRows(doc, rowSelector, category) {
        const achievements = [];
        new CssSelectorHelper(rowSelector).getAll(doc).forEach(row => {
            const icon = new CssSelectorHelper(ICON_SELECTOR).getSingle(row);
            const match = icon && ACHIEVEMENT_CLASS_RE.exec(icon.className);
            // Cells: icon, name, points, date, people
            if (!match || row.cells.length < 3) return;

            // The name can carry stray whitespace around it
            const name = row.cells[1].textContent.trim();
            if (!name) return;

            const points = parseInt(row.cells[2].textContent, 10);
            achievements.push({ id: Number(match[1]), name, points: Number.isFinite(points) ? points : 0, category });
        });
        return achievements;
    }

    /**
     * Reads the owned achievements from the achievements tables of a page. The ones of the
     * "Other Achievements" table carry the category of the other game, the others have none.
     *
     * @param {Document} doc The parsed achievements page
     * @param {string} otherCategory The category of the "Other Achievements" table
     * @return {Array<{id: number, name: string, points: number, category: string|null}>}
     */
    function readAchievements(doc, otherCategory) {
        return [
            ...readRows(doc, OWN_ROW_SELECTOR, null),
            ...readRows(doc, OTHER_ROW_SELECTOR, otherCategory),
        ];
    }

    /**
     * Reads the achievements of a character in the current game language.
     *
     * @param {number} characterId
     * @param {string|null} game The game of the character, as returned by detectCharacterGame()
     * @param {function(string): void} onProgress Called with the progress message
     * @return {Promise<Array<{id: number, name: string, points: number, category: string|null}>>}
     * @throws {Error} When no achievement is found on the page
     */
    async function crawlLanguage(characterId, game, onProgress) {
        onProgress(chrome.i18n.getMessage('achievementDbBuilderProgress', [String(characterId), describeGame(game)]));
        const achievements = readAchievements(await fetchDocument(`${ACHIEVEMENTS_PATH}/${characterId}`), getOtherGameCategory(game));
        if (!achievements.length) throw new Error(chrome.i18n.getMessage('achievementDbBuilderNoRows'));
        return achievements;
    }

    // ── Known data ─────────────────────────────────────────────────────────

    /**
     * Ids of the languages already present in the achievement names database.
     *
     * @return {number[]}
     */
    function getKnownLanguageIds() {
        return typeof ACHIEVEMENT_TRACKER_DB === 'undefined'
            ? []
            : Object.keys(ACHIEVEMENT_TRACKER_DB).map(Number);
    }

    /**
     * Copy of the language independent data, as a map of id -> [category, points].
     *
     * @return {Map<number, [string, number]>}
     */
    function getKnownInfo() {
        const info = new Map();
        if (typeof ACHIEVEMENT_TRACKER_INFO !== 'undefined') {
            Object.entries(ACHIEVEMENT_TRACKER_INFO).forEach(([id, [category, points]]) => {
                info.set(Number(id), [category, points]);
            });
        }
        return info;
    }

    /**
     * Builds the language independent data: the known one, completed with the achievements read from
     * the pages. The category of the "Other Achievements" ones is applied (new ids are added with it,
     * known ids get it if they have another one), unless it contradicts most of the known data, which
     * means the game of the character was detected wrong: then no category is changed. The other new
     * ids get the placeholder category. Known points are never changed.
     *
     * @param {Array<{achievements: Array<{id: number, points: number, category: string|null}>}>} scraped The read languages
     * @return {{info: Map<number, [string, number]>, added: number[], changed: Array<{id: number, from: string, to: string}>, placeholders: number[], pointsMismatches: Array<{id: number, known: number, page: number}>, guarded: boolean}}
     */
    function buildInfo(scraped) {
        const info = getKnownInfo();
        const added = [];
        const changed = [];
        const placeholders = [];
        const pointsMismatches = [];

        const achievements = new Map();
        scraped.forEach(language => language.achievements.forEach(item => achievements.set(item.id, item)));
        const hinted = Array.from(achievements.values()).filter(item => item.category);

        const known = hinted.filter(item => info.has(item.id));
        const contradicting = known.filter(item => info.get(item.id)[0] !== item.category);
        const guarded = contradicting.length * 2 > known.length;

        Array.from(achievements.values()).sort((a, b) => a.id - b.id).forEach(({ id, points, category }) => {
            const current = info.get(id);
            if (!current) {
                if (category && !guarded) {
                    info.set(id, [category, points]);
                    added.push(id);
                } else {
                    info.set(id, [DEFAULT_CATEGORY, points]);
                    placeholders.push(id);
                }
                return;
            }

            if (category && !guarded && current[0] !== category) {
                changed.push({ id, from: current[0], to: category });
                current[0] = category;
            }
            if (current[1] !== points) pointsMismatches.push({ id, known: current[1], page: points });
        });

        return { info, added, changed, placeholders, pointsMismatches, guarded };
    }

    // ── Formatting ─────────────────────────────────────────────────────────

    /**
     * Splits a list in chunks of the given size.
     *
     * @param {Array} list
     * @param {number} size
     * @return {Array<Array>}
     */
    function chunk(list, size) {
        const chunks = [];
        for (let i = 0; i < list.length; i += size) chunks.push(list.slice(i, i + size));
        return chunks;
    }

    /**
     * Formats the names of a language as the entry of ACHIEVEMENT_TRACKER_DB, with the same
     * layout used in achievement-tracker-data.js (ids in ascending numeric order).
     *
     * @param {{id: number, name: string}} language
     * @param {Map<number, string>} names Achievement names by id
     * @return {string}
     */
    function formatNamesEntry(language, names) {
        const entries = Array.from(names)
            .sort((a, b) => a[0] - b[0])
            .map(([id, name]) => `${id}: ${JSON.stringify(name)}`);
        const lines = chunk(entries, NAMES_PER_LINE).map(items => `        ${items.join(', ')}`);
        return [`    // ${language.name}`, `    ${language.id}: {`, lines.join(',\n'), '    }'].join('\n');
    }

    /**
     * Formats the language independent data as ACHIEVEMENT_TRACKER_INFO rows.
     *
     * @param {Map<number, [string, number]>} info
     * @return {string}
     */
    function formatInfoRows(info) {
        const entries = Array.from(info)
            .sort((a, b) => a[0] - b[0])
            .map(([id, [category, points]]) => `${id}: [${JSON.stringify(category)}, ${points}]`);
        return chunk(entries, INFO_PER_LINE).map(items => `    ${items.join(', ')}`).join(',\n');
    }

    /**
     * Formats the mutually exclusive pairs as ACHIEVEMENT_TRACKER_EXCLUSIONS rows, commented with
     * the English names of the two achievements.
     *
     * @param {Object<string, number>} exclusions
     * @param {Map<number, string>} englishNames
     * @return {string}
     */
    function formatExclusionRows(exclusions, englishNames) {
        const nameOf = id => englishNames.get(id) || `#${id}`;
        const done = new Set();
        const rows = [];

        Object.keys(exclusions).map(Number).sort((a, b) => a - b).forEach(a => {
            if (done.has(a)) return;
            const b = Number(exclusions[a]);
            done.add(a);
            if (Number(exclusions[b]) === a) {
                done.add(b);
                rows.push({ text: `${a}: ${b}, ${b}: ${a}`, comment: `${nameOf(a)} & ${nameOf(b)}` });
            } else {
                rows.push({ text: `${a}: ${b}`, comment: nameOf(a) });
            }
        });

        // Same look as the hand written block: a comma after every pair but the last one
        return rows.map((row, index) => index < rows.length - 1
            ? `    ${row.text}, // ${row.comment}`
            : `    ${row.text}  // ${row.comment}`).join('\n');
    }

    /**
     * Builds the content of the data file.
     *
     * @param {Map<number, [string, number]>} info Language independent data
     * @param {Map<number, {name: string, names: Map<number, string>}>} languages Names by language id
     * @return {string}
     */
    function formatDataFile(info, languages) {
        const entries = Array.from(languages)
            .sort((a, b) => a[0] - b[0])
            .map(([id, language]) => formatNamesEntry({ id, name: language.name }, language.names));

        const english = languages.get(ENGLISH_LANGUAGE_ID);
        const exclusions = typeof ACHIEVEMENT_TRACKER_EXCLUSIONS === 'undefined' ? {} : ACHIEVEMENT_TRACKER_EXCLUSIONS;

        return [
            ...DATA_FILE_HEADER,
            '// eslint-disable-next-line no-unused-vars',
            'const ACHIEVEMENT_TRACKER_INFO = {',
            formatInfoRows(info),
            '};',
            '',
            '// eslint-disable-next-line no-unused-vars',
            'const ACHIEVEMENT_TRACKER_DB = {',
            entries.join(',\n'),
            '};',
            '',
            '/**',
            ' * Pairs of achievements that exclude each other: owning one makes the other unobtainable.',
            ' */',
            '// eslint-disable-next-line no-unused-vars',
            'const ACHIEVEMENT_TRACKER_EXCLUSIONS = {',
            formatExclusionRows(exclusions, english ? english.names : new Map()),
            '};',
            '',
        ].join('\n');
    }

    /**
     * Builds the content of the downloadable file. The language independent data comes from buildInfo():
     * it always keeps the existing achievements. When merging, the existing names are included and the
     * newly read ones are added to them, overriding the same ids; otherwise only the newly read
     * languages are written.
     *
     * @param {Array<{id: number, name: string, achievements: Array<{id: number, name: string, points: number, category: string|null}>}>} scraped
     * @param {boolean} merge Whether to include the existing names
     * @param {Map<number, string>} languageNames Language names by id, used for the comments of existing languages
     * @return {string}
     */
    function buildFileContent(scraped, merge, languageNames) {
        const { info } = buildInfo(scraped);
        const languages = new Map();

        if (merge && typeof ACHIEVEMENT_TRACKER_DB !== 'undefined') {
            Object.entries(ACHIEVEMENT_TRACKER_DB).forEach(([key, names]) => {
                const id = Number(key);
                languages.set(id, {
                    name: languageNames.get(id) || `Language ${id}`,
                    names: new Map(Object.entries(names).map(([achievementId, name]) => [Number(achievementId), name])),
                });
            });
        }

        scraped.forEach(language => {
            const target = languages.get(language.id) || { names: new Map() };
            target.name = language.name;
            languages.set(language.id, target);

            language.achievements.forEach(({ id, name }) => target.names.set(id, name));
        });

        // Languages not read in this run only matter when merging
        if (!merge) {
            Array.from(languages.keys())
                .filter(id => !scraped.some(language => language.id === id))
                .forEach(id => languages.delete(id));
        }

        return formatDataFile(info, languages);
    }

    // ── UI ─────────────────────────────────────────────────────────────────

    /**
     * Logs what the language independent data gets from the read achievements and returns the text to
     * add to the status line: the categories that were changed, the achievements that could not be
     * classified (added as GENERIC) and the guard warning.
     *
     * @param {Array<{achievements: Array}>} scraped The read languages
     * @param {string|null} otherCategory The category of the Other Achievements table, null when the game was not detected
     * @return {string} The text, or '' when there is nothing to report
     */
    function reportInfo(scraped, otherCategory) {
        const { info, added, changed, placeholders, pointsMismatches, guarded } = buildInfo(scraped);
        const messages = [];

        if (!otherCategory) {
            Logger.warn('Achievement Database Builder: the game of the character could not be detected, no category was set from the Other Achievements table');
            messages.push(chrome.i18n.getMessage('achievementDbBuilderGameUnknown'));
        }

        pointsMismatches.forEach(({ id, known, page }) => {
            Logger.warn(`Achievement Database Builder: points of achievement ${id} differ (known ${known}, page ${page}): the known value is kept`);
        });

        if (added.length || changed.length) {
            const rows = [...added, ...changed.map(item => item.id)]
                .sort((a, b) => a - b)
                .map(id => `${id}: ${JSON.stringify(info.get(id))}`);
            Logger.debug(`Achievement tracker info rows set from the Other Achievements table:\n${rows.join('\n')}`);
        }
        if (changed.length) {
            const list = changed.map(({ id, from, to }) => `${id}: ${from} -> ${to}`).join(', ');
            Logger.warn(`Achievement Database Builder: categories changed: ${list}`);
            messages.push(chrome.i18n.getMessage('achievementDbBuilderCategoriesChanged', [String(changed.length), list]));
        }
        if (placeholders.length) {
            Logger.warn(`Achievement Database Builder: achievements not in the tracker data yet: ${placeholders.join(', ')}`);
            messages.push(chrome.i18n.getMessage('achievementDbBuilderNewIds', [String(placeholders.length), placeholders.join(', ')]));
        }
        if (guarded) {
            Logger.warn('Achievement Database Builder: the Other Achievements table contradicts most of the known categories, no category was changed');
            messages.push(chrome.i18n.getMessage('achievementDbBuilderCategoryGuard'));
        }
        return messages.join(' ');
    }

    /**
     * Builds the entry for the current game language and prints it in the debug log.
     *
     * @param {HTMLElement} status
     */
    async function buildCurrentLanguage(status) {
        const characterId = getCharacterId();
        const language = await Utils.getGameLanguage();
        if (!language) {
            status.textContent = chrome.i18n.getMessage('achievementDbBuilderNoLanguage');
            return;
        }

        const game = await detectCharacterGame(characterId);
        const achievements = await crawlLanguage(characterId, game, message => { status.textContent = message; });
        const names = new Map(achievements.map(({ id, name }) => [id, name]));
        Logger.debug(`Achievement database for ${language.name} (id ${language.id}):\n${formatNamesEntry(language, names)}`);

        status.textContent = chrome.i18n.getMessage('achievementDbBuilderDone',
            [String(achievements.length), language.name, String(language.id)]);
        const infoReport = reportInfo([{ achievements }], getOtherGameCategory(game));
        if (infoReport) status.textContent += ' ' + infoReport;
    }

    /**
     * Reads the achievements in the selected languages, switching the account language for each one
     * and restoring it at the end, and prepares the stand-alone file for download.
     *
     * @param {Array<{id: number, name: string}>} selected
     * @param {boolean} skipKnown Whether to skip the languages already present in the database
     * @param {HTMLElement} status
     * @param {HTMLInputElement} downloadButton
     * @param {function(Array): void} setResults Receives the newly read languages
     */
    async function buildLanguages(selected, skipKnown, status, downloadButton, setResults) {
        if (!selected.length) {
            status.textContent = chrome.i18n.getMessage('achievementDbBuilderNoneSelected');
            return;
        }

        let skippedLanguages = [];
        if (skipKnown) {
            const knownIds = getKnownLanguageIds();
            skippedLanguages = selected.filter(language => knownIds.includes(language.id));
            selected = selected.filter(language => !knownIds.includes(language.id));
            if (!selected.length) {
                status.textContent = chrome.i18n.getMessage('achievementDbBuilderAllKnown');
                return;
            }
        }

        const characterId = getCharacterId();
        const original = await Utils.getGameLanguage();
        if (!original) {
            status.textContent = chrome.i18n.getMessage('achievementDbBuilderNoLanguage');
            return;
        }

        const game = await detectCharacterGame(characterId);

        downloadButton.style.display = 'none';
        const results = [];
        const failedLanguages = [];

        // Remembered so the language can be restored even if this run is interrupted
        await chrome.storage.local.set({ [ORIGINAL_LANGUAGE_KEY]: original.id });
        try {
            for (let i = 0; i < selected.length; i++) {
                const language = selected[i];
                const prefix = message => chrome.i18n.getMessage('achievementDbBuilderLanguageProgress',
                    [language.name, String(i + 1), String(selected.length), message]);
                try {
                    status.textContent = prefix('...');
                    await switchLanguage(language.id);
                    const achievements = await crawlLanguage(characterId, game, message => { status.textContent = prefix(message); });
                    Logger.debug(`Achievement database for ${language.name} (id ${language.id}):\n${formatNamesEntry(language, new Map(achievements.map(({ id, name }) => [id, name])))}`);
                    results.push({ id: language.id, name: language.name, achievements });
                } catch (error) {
                    Logger.warn(`Achievement Database Builder: language ${language.name} (${language.id}) skipped`, error);
                    failedLanguages.push(language.name);
                }
            }
        } finally {
            try {
                await restoreLanguage(original.id);
            } catch (error) {
                Logger.error('Achievement Database Builder: unable to restore the game language', error);
                status.textContent = chrome.i18n.getMessage('achievementDbBuilderRestoreFailed');
                // The marker is kept: the Restore button is shown at the next visit
                setResults(results);
                downloadButton.style.display = results.length ? '' : 'none';
                return;
            }
        }

        setResults(results);
        downloadButton.style.display = results.length ? '' : 'none';
        status.textContent = chrome.i18n.getMessage('achievementDbBuilderAllDone',
            [String(results.length), results.map(item => item.id).join(', ')]);
        if (skippedLanguages.length) {
            status.textContent += ' ' + chrome.i18n.getMessage('achievementDbBuilderLanguagesSkipped',
                [skippedLanguages.map(language => language.name).join(', ')]);
        }
        if (failedLanguages.length) {
            status.textContent += ' ' + chrome.i18n.getMessage('achievementDbBuilderLanguagesFailed',
                [failedLanguages.join(', ')]);
        }
        const infoReport = reportInfo(results, getOtherGameCategory(game));
        if (infoReport) status.textContent += ' ' + infoReport;
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
        status.textContent = chrome.i18n.getMessage('achievementDbBuilderLoadingLanguages');
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
        box.appendChild(el('h2', chrome.i18n.getMessage('achievementDbBuilderTitle')));

        // Current language
        box.appendChild(el('p', chrome.i18n.getMessage('achievementDbBuilderInfo')));
        const currentButton = createButton(chrome.i18n.getMessage('achievementDbBuilderButton'));
        const currentParagraph = el('p');
        currentParagraph.appendChild(currentButton);
        box.appendChild(currentParagraph);

        // Several languages
        box.appendChild(el('h3', chrome.i18n.getMessage('achievementDbBuilderAllTitle')));
        box.appendChild(el('p', chrome.i18n.getMessage('achievementDbBuilderAllInfo')));
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
        const skipKnownCheckbox = addOption(chrome.i18n.getMessage('achievementDbBuilderSkipKnown'), false);
        const mergeCheckbox = addOption(chrome.i18n.getMessage('achievementDbBuilderMerge'), true);

        const allButton = createButton(chrome.i18n.getMessage('achievementDbBuilderBuildAll'));
        const downloadButton = createButton(chrome.i18n.getMessage('achievementDbBuilderDownload'));
        downloadButton.style.display = 'none';
        const restoreButton = createButton(chrome.i18n.getMessage('achievementDbBuilderRestore'));
        const allParagraph = el('p');
        allParagraph.append(allButton, ' ', downloadButton);
        box.appendChild(allParagraph);

        const status = el('p');
        box.appendChild(status);

        if (needsRestore) {
            const restoreParagraph = el('p', chrome.i18n.getMessage('achievementDbBuilderRestoreInfo') + ' ');
            restoreParagraph.appendChild(restoreButton);
            box.insertBefore(restoreParagraph, box.children[1]);
        }

        const buttons = [currentButton, allButton, restoreButton, skipKnownCheckbox, mergeCheckbox];
        const languageNames = new Map();
        let readResults = [];

        currentButton.addEventListener('click', () => runExclusive(buttons, status, () => buildCurrentLanguage(status)));

        allButton.addEventListener('click', () => runExclusive(buttons, status, () => {
            const selected = Array.from(new CssSelectorHelper('input[type="checkbox"]').getAll(languageList))
                .filter(checkbox => checkbox.checked)
                .map(checkbox => ({ id: parseInt(checkbox.dataset.languageId), name: checkbox.dataset.languageName }));
            return buildLanguages(selected, skipKnownCheckbox.checked, status, downloadButton, results => { readResults = results; });
        }));

        // The merge option is read here, so it can be changed after a run
        downloadButton.addEventListener('click', () => {
            if (readResults.length) {
                downloadTextFile(DOWNLOAD_FILE_NAME, buildFileContent(readResults, mergeCheckbox.checked, languageNames));
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
     * Injects the builder box right before the achievements table.
     */
    async function injectBuilder() {
        if (new CssSelectorHelper(`#${BOX_ID}`).getSingle()) return;

        const anchor = new CssSelectorHelper(TABLE_WRAPPER_SELECTOR).getSingle()
            || new CssSelectorHelper(TABLE_SELECTOR).getSingle();
        if (!anchor) return;

        const stored = await chrome.storage.local.get({ [ORIGINAL_LANGUAGE_KEY]: null });
        // The box may have been injected by a concurrent call while we were waiting
        if (new CssSelectorHelper(`#${BOX_ID}`).getSingle()) return;

        anchor.parentNode.insertBefore(buildBox(stored[ORIGINAL_LANGUAGE_KEY] !== null), anchor);
    }

    chrome.storage.local.get({ install_type: '' }, function (items) {
        if (items.install_type !== 'development') return;

        chrome.storage.sync.get({ achievement_db_builder: false }, function (options) {
            if (!options.achievement_db_builder) return;

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', injectBuilder);
            } else {
                injectBuilder();
            }
        });
    });
})();
