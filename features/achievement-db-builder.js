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
 *     data file can be downloaded as a stand-alone JavaScript file. The run can read just the
 *     character of the page, or all the characters of the "Most Achievement Points" chart:
 *     for each value of its filter (all achievements, all Great Heist ones, Great Heist core
 *     ones) the listed characters are collected once, their game is detected once, and then
 *     their achievements pages are read in every selected language. It can be stopped.
 *
 * A character only shows the achievements it owns, so the names of a language are partial: the
 * more characters are read, the more achievements get a name. When merging, the existing names of
 * a language are kept and the newly read ones are added to them (or override the same ids).
 *
 * The page has no category, but its "Other Achievements" table lists the achievements earned in
 * the other game, which are exclusive to it: TGH for a Popmundo character, PPM for a Great Heist
 * one (the game of the character comes from its character page, see Utils.parseCharacterGame()).
 * They set (or fix) the category in ACHIEVEMENT_TRACKER_INFO,
 * unless they contradict most of the known data, which means the game was detected wrong. Other
 * ids that are not in ACHIEVEMENT_TRACKER_INFO yet are added as GENERIC and reported. The points
 * of the known achievements are updated from the page, unless they differ for most of them, which
 * means that the page was misread.
 *
 * Every request goes through TimedFetch (DbBuilderHelper.fetchDocument), to avoid being logged out.
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
    const CHART_PATH = '/World/Popmundo.aspx/Charts/MostAchievementPoints';
    const CHART_SORT_SELECTOR = 'select[id$="ddlSortCriteria"]';
    const CHART_ROW_SELECTOR = '#tablechart tbody tr';
    const CHARACTER_LINK_SELECTOR = 'a[href*="/Character/"]';
    const CHARACTER_LINK_RE = /\/Character\/(\d+)\/?$/;
    // Values of the chart filter, in the order they are read: all the achievements, all the Great
    // Heist ones, the Great Heist core ones. A character found by a view is not collected again.
    const CHART_FILTER_VALUES = ['3', '2', '1'];
    const MAX_CHARACTERS_PER_CHART = 50;
    // A language is interrupted after this many characters in a row that cannot be read
    const MAX_CONSECUTIVE_FAILURES = 3;
    // Requests needed to switch the language: the form, the post and the check
    const SWITCH_LANGUAGE_REQUESTS = 3;
    const ORIGINAL_LANGUAGE_KEY = DbBuilderHelper.ORIGINAL_LANGUAGE_KEY;
    const LANGUAGE_SETTINGS_PATH = DbBuilderHelper.LANGUAGE_SETTINGS_PATH;
    const DOWNLOAD_FILE_NAME = 'achievement-tracker-data.generated.js';
    // New achievements that cannot be classified get this category until it is fixed by hand
    const DEFAULT_CATEGORY = 'GENERIC';
    // US English: its names are used as the comment of the exclusion pairs
    const ENGLISH_LANGUAGE_ID = 2;
    // The points guard only judges the page when at least this many known achievements were read
    const POINTS_GUARD_MIN_SAMPLE = 10;
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
     * Describes a character for the progress messages.
     *
     * @param {{id: number, name: string}} character
     * @return {string} The name, or the id when the name is not known
     */
    function describeCharacter(character) {
        return character.name || `#${character.id}`;
    }

    /**
     * Reads the achievements of the rows matching a selector.
     *
     * @param {Document} doc The parsed achievements page
     * @param {string} rowSelector
     * @param {string|null} game The game of the character, null when it is not known
     * @param {boolean} other Whether the rows are the "Other Achievements" ones
     * @return {Array<{id: number, name: string, points: number|null, game: string|null, other: boolean}>} Points are null when the cell cannot be read
     */
    function readRows(doc, rowSelector, game, other) {
        const achievements = [];
        new CssSelectorHelper(rowSelector).getAll(doc).forEach(row => {
            const icon = new CssSelectorHelper(ICON_SELECTOR).getSingle(row);
            const match = icon && ACHIEVEMENT_CLASS_RE.exec(icon.className);
            // Cells: icon, name, points, date, people
            if (!match || row.cells.length < 3) return;

            // The name can carry stray whitespace around it
            const name = row.cells[1].textContent.trim();
            if (!name) return;

            // An unreadable value is null, so that it can never replace a known one
            const points = parseInt(row.cells[2].textContent, 10);
            achievements.push({ id: Number(match[1]), name, points: Number.isFinite(points) ? points : null, game, other });
        });
        return achievements;
    }

    /**
     * Reads the owned achievements from the achievements tables of a page: the ones of the game the
     * character plays, and the "Other Achievements" ones, which belong to the other game.
     *
     * @param {Document} doc The parsed achievements page
     * @param {string|null} game The game of the character, null when it is not known
     * @return {Array<{id: number, name: string, points: number|null, game: string|null, other: boolean}>}
     */
    function readAchievements(doc, game) {
        return [
            ...readRows(doc, OWN_ROW_SELECTOR, game, false),
            ...readRows(doc, OTHER_ROW_SELECTOR, game, true),
        ];
    }

    /**
     * Reads the achievements of a character in the current game language.
     *
     * @param {number} characterId
     * @param {string|null} game The game of the character, as returned by detectCharacterGame()
     * @return {Promise<Array<{id: number, name: string, points: number|null, game: string|null, other: boolean}>>}
     * @throws {Error} When no achievement is found on the page
     */
    async function crawlCharacter(characterId, game) {
        const achievements = readAchievements(await fetchDocument(`${ACHIEVEMENTS_PATH}/${characterId}`), game);
        if (!achievements.length) throw new Error(chrome.i18n.getMessage('achievementDbBuilderNoRows'));
        return achievements;
    }

    /**
     * Reads the achievements of several characters in the current game language. The result is
     * compacted: a read that tells nothing new (same id, points, game and table) is kept once.
     * A character that cannot be read is skipped; after MAX_CONSECUTIVE_FAILURES in a row the
     * language is interrupted (the session may be logged out or throttled).
     *
     * @param {Array<{id: number, name: string}>} characters
     * @param {Map<number, string|null>} games The game of every character
     * @param {function(string): void} onProgress Called with the progress message of every character
     * @param {function(): boolean} isStopRequested
     * @return {Promise<{achievements: Array, failed: number[], aborted: boolean, stopped: boolean}>}
     * @throws {Error} The last error, when not a single character could be read
     */
    async function crawlCharacters(characters, games, onProgress, isStopRequested) {
        const achievements = new Map();
        const failed = [];
        let consecutiveFailures = 0;
        let aborted = false;
        let stopped = false;
        let lastError = null;

        for (let i = 0; i < characters.length; i++) {
            if (isStopRequested()) {
                stopped = true;
                break;
            }

            const character = characters[i];
            const game = games.get(character.id) ?? null;
            onProgress(chrome.i18n.getMessage('achievementDbBuilderCharacterProgress',
                [String(i + 1), String(characters.length), describeCharacter(character), String(character.id), describeGame(game)]));

            try {
                (await crawlCharacter(character.id, game)).forEach(item => {
                    const key = `${item.id}|${item.game}|${item.other}|${item.points}`;
                    const known = achievements.get(key);
                    if (!known) achievements.set(key, item);
                    else if (known.name !== item.name) Logger.warn(`Achievement Database Builder: achievement ${item.id} has two names: ${JSON.stringify(known.name)} and ${JSON.stringify(item.name)}`);
                });
                consecutiveFailures = 0;
            } catch (error) {
                lastError = error;
                failed.push(character.id);
                Logger.warn(`Achievement Database Builder: unable to read the achievements of character ${character.id}`, error);
                if (++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                    aborted = true;
                    break;
                }
            }
        }

        if (!achievements.size && lastError) throw lastError;
        return { achievements: Array.from(achievements.values()), failed, aborted, stopped };
    }

    // ── The chart of the characters ────────────────────────────────────────

    /**
     * Tells if an option of a select is the selected one. A document built by DOMParser has no live
     * selection state, so the selected attribute is looked at first.
     *
     * @param {HTMLSelectElement} select
     * @param {string} value
     * @return {boolean}
     */
    function isOptionSelected(select, value) {
        const selected = new CssSelectorHelper('option[selected]').getSingle(select)
            || new CssSelectorHelper('option:checked').getSingle(select);
        return !!selected && selected.value === value;
    }

    /**
     * Reads the characters listed by a chart page.
     *
     * @param {Document} doc The parsed chart page
     * @return {Array<{id: number, name: string}>}
     */
    function readChartCharacters(doc) {
        const characters = [];
        new CssSelectorHelper(CHART_ROW_SELECTOR).getAll(doc).forEach(row => {
            const link = new CssSelectorHelper(CHARACTER_LINK_SELECTOR).getSingle(row);
            const match = link && CHARACTER_LINK_RE.exec(link.getAttribute('href') || '');
            if (match) characters.push({ id: Number(match[1]), name: link.textContent.trim() });
        });
        return characters;
    }

    /**
     * Reads the characters of the chart with one value of its filter. Choosing a value in the game
     * is an ASP.NET postback, which is replayed with the form of the page.
     *
     * @param {string} value A value of the filter combo
     * @return {Promise<Array<{id: number, name: string}>>}
     * @throws {Error} When the page has no such filter value
     */
    async function readChartView(value) {
        const doc = await fetchDocument(CHART_PATH);
        const select = new CssSelectorHelper(CHART_SORT_SELECTOR).getSingle(doc);
        const form = new CssSelectorHelper(DbBuilderHelper.FORM_SELECTOR).getSingle(doc);
        if (!select || !form) throw new Error('Chart filter not found');
        if (!new CssSelectorHelper(`option[value="${value}"]`).getSingle(select)) throw new Error(`Chart filter value ${value} not available`);
        if (isOptionSelected(select, value)) return readChartCharacters(doc);

        const body = new URLSearchParams(new FormData(form));
        body.set('__EVENTTARGET', select.name);
        body.set('__EVENTARGUMENT', '');
        body.set(select.name, value);
        const viewDoc = await fetchDocument(CHART_PATH, { method: 'POST', body });

        const viewSelect = new CssSelectorHelper(CHART_SORT_SELECTOR).getSingle(viewDoc);
        if (!viewSelect || !isOptionSelected(viewSelect, value)) throw new Error(`Chart filter value ${value} not applied`);
        return readChartCharacters(viewDoc);
    }

    /**
     * Collects the characters of the chart with every value of its filter. A character that an earlier
     * value already listed is not collected again. A value that cannot be read is skipped.
     *
     * @param {number} limitPerChart How many characters to take from every value
     * @param {HTMLElement} status
     * @param {function(): boolean} isStopRequested
     * @return {Promise<Array<{id: number, name: string}>>}
     * @throws {Error} When no character could be collected
     */
    async function loadChartCharacters(limitPerChart, status, isStopRequested) {
        const characters = new Map();

        for (let i = 0; i < CHART_FILTER_VALUES.length; i++) {
            if (isStopRequested()) break;
            const value = CHART_FILTER_VALUES[i];
            status.textContent = chrome.i18n.getMessage('achievementDbBuilderLoadingChart',
                [String(i + 1), String(CHART_FILTER_VALUES.length)]);
            try {
                (await readChartView(value)).slice(0, limitPerChart).forEach(character => {
                    if (!characters.has(character.id)) characters.set(character.id, character);
                });
            } catch (error) {
                Logger.warn(`Achievement Database Builder: unable to read the chart with the filter value ${value}`, error);
            }
        }

        if (!characters.size && !isStopRequested()) throw new Error(chrome.i18n.getMessage('achievementDbBuilderChartEmpty'));
        return Array.from(characters.values());
    }

    /**
     * Detects the game of every character, once: it does not change with the game language.
     *
     * @param {Array<{id: number, name: string}>} characters
     * @param {HTMLElement} status
     * @param {function(): boolean} isStopRequested
     * @return {Promise<Map<number, string|null>>}
     */
    async function detectGames(characters, status, isStopRequested) {
        const games = new Map();
        for (let i = 0; i < characters.length; i++) {
            if (isStopRequested()) break;
            status.textContent = chrome.i18n.getMessage('achievementDbBuilderDetectingGame',
                [String(i + 1), String(characters.length), describeCharacter(characters[i])]);
            games.set(characters[i].id, await detectCharacterGame(characters[i].id));
        }
        return games;
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
     * Collects, for every achievement id, what the read pages tell about it: the points, the categories
     * suggested by the "Other Achievements" tables (a Popmundo character lists Great Heist achievements
     * there and the other way round) and the games of the characters that own it in their own table.
     *
     * @param {Array<{achievements: Array<{id: number, points: number|null, game: string|null, other: boolean}>}>} scraped The read languages
     * @return {Map<number, {points: Set<number>, categories: Set<string>, mainGames: Set<string>}>}
     */
    function collectAchievementFacts(scraped) {
        const facts = new Map();
        scraped.forEach(language => language.achievements.forEach(({ id, points, game, other }) => {
            if (!facts.has(id)) facts.set(id, { points: new Set(), categories: new Set(), mainGames: new Set() });
            const fact = facts.get(id);
            if (points !== null) fact.points.add(points);
            if (other) {
                const category = getOtherGameCategory(game);
                if (category) fact.categories.add(category);
            } else if (game) {
                fact.mainGames.add(game);
            }
        }));
        return facts;
    }

    /**
     * Builds the language independent data: the known one, completed with the achievements read from
     * the pages, which can come from many characters (see collectAchievementFacts()).
     *
     * The category suggested by the "Other Achievements" tables is applied (new ids are added with it,
     * known ids get it if they have another one), unless it contradicts most of the known data, which
     * means the game of the characters was detected wrong: then no category is changed. The other new
     * ids get the placeholder category. The points of the known achievements are replaced by the ones
     * of the pages, unless they differ for most of them (at least POINTS_GUARD_MIN_SAMPLE were read),
     * which means that the pages were misread: then no points are changed. Points that could not be
     * read never replace a known value, and are 0 for a new id.
     *
     * When the characters disagree about the category or the points of an id, nothing is changed for it
     * and it is reported. A category that is contradicted by the own table of the characters (a
     * Popmundo-only achievement owned by a Great Heist character, or the opposite) is only reported.
     *
     * @param {Array<{achievements: Array<{id: number, points: number|null, game: string|null, other: boolean}>}>} scraped The read languages
     * @return {{info: Map<number, [string, number]>, added: number[], changed: Array<{id: number, from: string, to: string}>, placeholders: number[], pointsChanged: Array<{id: number, from: number, to: number}>, categoryConflicts: Array<{id: number, values: string[]}>, pointsConflicts: Array<{id: number, values: number[]}>, contradictions: Array<{id: number, category: string}>, guarded: boolean, pointsGuarded: boolean}}
     */
    function buildInfo(scraped) {
        const info = getKnownInfo();
        const added = [];
        const changed = [];
        const placeholders = [];
        const pointsChanged = [];
        const categoryConflicts = [];
        const pointsConflicts = [];
        const contradictions = [];

        // The value the pages agree on, null when there is none or when they disagree
        const facts = collectAchievementFacts(scraped);
        const ids = Array.from(facts.keys()).sort((a, b) => a - b);
        const resolved = new Map();
        ids.forEach(id => {
            const { points, categories } = facts.get(id);
            if (categories.size > 1) categoryConflicts.push({ id, values: Array.from(categories) });
            if (points.size > 1) pointsConflicts.push({ id, values: Array.from(points) });
            resolved.set(id, {
                category: categories.size === 1 ? Array.from(categories)[0] : null,
                points: points.size === 1 ? Array.from(points)[0] : null,
            });
        });

        const withCategory = ids.filter(id => resolved.get(id).category && info.has(id));
        const contradicting = withCategory.filter(id => info.get(id)[0] !== resolved.get(id).category);
        const guarded = contradicting.length * 2 > withCategory.length;

        const withPoints = ids.filter(id => resolved.get(id).points !== null && info.has(id));
        const differing = withPoints.filter(id => info.get(id)[1] !== resolved.get(id).points);
        const pointsGuarded = withPoints.length >= POINTS_GUARD_MIN_SAMPLE && differing.length * 2 > withPoints.length;

        ids.forEach(id => {
            const { category, points } = resolved.get(id);
            const current = info.get(id);
            if (!current) {
                if (category && !guarded) {
                    info.set(id, [category, points ?? 0]);
                    added.push(id);
                } else {
                    info.set(id, [DEFAULT_CATEGORY, points ?? 0]);
                    placeholders.push(id);
                }
                return;
            }

            if (category && !guarded && current[0] !== category) {
                changed.push({ id, from: current[0], to: category });
                current[0] = category;
            }
            if (points !== null && !pointsGuarded && current[1] !== points) {
                pointsChanged.push({ id, from: current[1], to: points });
                current[1] = points;
            }
        });

        // Whatever the category is now, a game-only achievement cannot be in the own table of the other game
        ids.forEach(id => {
            const { mainGames } = facts.get(id);
            const category = info.get(id)[0];
            if ((category === 'PPM' && mainGames.has('tgh')) || (category === 'TGH' && mainGames.has('ppm'))) {
                contradictions.push({ id, category });
            }
        });

        return { info, added, changed, placeholders, pointsChanged, categoryConflicts, pointsConflicts, contradictions, guarded, pointsGuarded };
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
     * @param {Array<{id: number, name: string, achievements: Array<{id: number, name: string, points: number|null, game: string|null, other: boolean}>}>} scraped
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
     * add to the status line: the categories and points that were changed, the achievements that could
     * not be classified (added as GENERIC), the disagreements, the categories to check and the guard
     * warnings.
     *
     * @param {Array<{achievements: Array}>} scraped The read languages
     * @param {number} [undetected=0] How many characters had a game that could not be detected
     * @return {string} The text, or '' when there is nothing to report
     */
    function reportInfo(scraped, undetected = 0) {
        const { info, added, changed, placeholders, pointsChanged, categoryConflicts, pointsConflicts, contradictions, guarded, pointsGuarded } = buildInfo(scraped);
        const messages = [];

        if (undetected) {
            Logger.warn(`Achievement Database Builder: the game of ${undetected} characters could not be detected, their Other Achievements were not used for the categories`);
            messages.push(chrome.i18n.getMessage('achievementDbBuilderGameUnknown', [String(undetected)]));
        }

        if (added.length || changed.length || pointsChanged.length) {
            const ids = new Set([...added, ...changed.map(item => item.id), ...pointsChanged.map(item => item.id)]);
            const rows = Array.from(ids)
                .sort((a, b) => a - b)
                .map(id => `${id}: ${JSON.stringify(info.get(id))}`);
            Logger.debug(`Achievement tracker info rows set from the pages:\n${rows.join('\n')}`);
        }
        if (changed.length) {
            const list = changed.map(({ id, from, to }) => `${id}: ${from} -> ${to}`).join(', ');
            Logger.warn(`Achievement Database Builder: categories changed: ${list}`);
            messages.push(chrome.i18n.getMessage('achievementDbBuilderCategoriesChanged', [String(changed.length), list]));
        }
        if (pointsChanged.length) {
            const list = pointsChanged.map(({ id, from, to }) => `${id}: ${from} -> ${to}`).join(', ');
            Logger.warn(`Achievement Database Builder: points changed: ${list}`);
            messages.push(chrome.i18n.getMessage('achievementDbBuilderPointsChanged', [String(pointsChanged.length), list]));
        }
        if (placeholders.length) {
            Logger.warn(`Achievement Database Builder: achievements not in the tracker data yet: ${placeholders.join(', ')}`);
            messages.push(chrome.i18n.getMessage('achievementDbBuilderNewIds', [String(placeholders.length), placeholders.join(', ')]));
        }
        if (categoryConflicts.length) {
            const list = categoryConflicts.map(({ id, values }) => `${id}: ${values.join(' / ')}`).join(', ');
            Logger.warn(`Achievement Database Builder: the characters disagree about the category of: ${list}`);
            messages.push(chrome.i18n.getMessage('achievementDbBuilderCategoryConflicts', [String(categoryConflicts.length), list]));
        }
        if (pointsConflicts.length) {
            const list = pointsConflicts.map(({ id, values }) => `${id}: ${values.join(' / ')}`).join(', ');
            Logger.warn(`Achievement Database Builder: the characters disagree about the points of: ${list}`);
            messages.push(chrome.i18n.getMessage('achievementDbBuilderPointsConflicts', [String(pointsConflicts.length), list]));
        }
        if (contradictions.length) {
            const list = contradictions.map(({ id, category }) => `${id}: ${category}`).join(', ');
            Logger.warn(`Achievement Database Builder: categories contradicted by the achievements of the characters: ${list}`);
            messages.push(chrome.i18n.getMessage('achievementDbBuilderContradictions', [String(contradictions.length), list]));
        }
        if (guarded) {
            Logger.warn('Achievement Database Builder: the Other Achievements table contradicts most of the known categories, no category was changed');
            messages.push(chrome.i18n.getMessage('achievementDbBuilderCategoryGuard'));
        }
        if (pointsGuarded) {
            Logger.warn('Achievement Database Builder: the points of the page differ from the known ones for most achievements, no points were changed');
            messages.push(chrome.i18n.getMessage('achievementDbBuilderPointsGuard'));
        }
        return messages.join(' ');
    }

    /**
     * Gets the known achievements that none of the read characters owns, so that no language got their name.
     *
     * @param {Array<{achievements: Array<{id: number}>}>} scraped The read languages
     * @return {number[]} Sorted
     */
    function findUncoveredIds(scraped) {
        const seen = new Set();
        scraped.forEach(language => language.achievements.forEach(({ id }) => seen.add(id)));
        return Array.from(buildInfo(scraped).info.keys()).filter(id => !seen.has(id)).sort((a, b) => a - b);
    }

    /**
     * Builds the entry for the current game language, from the character of the page, and prints it in
     * the debug log.
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

        const characters = [{ id: characterId, name: '' }];
        const games = await detectGames(characters, status, () => false);
        const { achievements } = await crawlCharacters(characters, games, message => { status.textContent = message; }, () => false);
        const names = new Map(achievements.map(({ id, name }) => [id, name]));
        Logger.debug(`Achievement database for ${language.name} (id ${language.id}):\n${formatNamesEntry(language, names)}`);

        status.textContent = chrome.i18n.getMessage('achievementDbBuilderDone',
            [String(names.size), language.name, String(language.id)]);
        const infoReport = reportInfo([{ achievements }], games.get(characterId) ? 0 : 1);
        if (infoReport) status.textContent += ' ' + infoReport;
    }

    /**
     * Reads the achievements in the selected languages, switching the account language for each one
     * and restoring it at the end, and prepares the stand-alone file for download. The characters are
     * the one of the page or, in bulk mode, the ones of the chart; they and their game are read once,
     * before the account language is touched, and then their pages are read in every language.
     *
     * @param {Array<{id: number, name: string}>} selected
     * @param {{skipKnown: boolean, bulk: boolean, limitPerChart: number}} options Whether to skip the languages already present in the database, to read the characters of the chart, and how many to take from each view of it
     * @param {{status: HTMLElement, estimate: HTMLElement, downloadButton: HTMLInputElement, setResults: function(Array): void, isStopRequested: function(): boolean}} ui
     */
    async function buildLanguages(selected, options, ui) {
        const { status, estimate, downloadButton, isStopRequested } = ui;
        if (!selected.length) {
            status.textContent = chrome.i18n.getMessage('achievementDbBuilderNoneSelected');
            return;
        }

        let skippedLanguages = [];
        if (options.skipKnown) {
            const knownIds = getKnownLanguageIds();
            skippedLanguages = selected.filter(language => knownIds.includes(language.id));
            selected = selected.filter(language => !knownIds.includes(language.id));
            if (!selected.length) {
                status.textContent = chrome.i18n.getMessage('achievementDbBuilderAllKnown');
                return;
            }
        }

        const original = await Utils.getGameLanguage();
        if (!original) {
            status.textContent = chrome.i18n.getMessage('achievementDbBuilderNoLanguage');
            return;
        }

        const characters = options.bulk
            ? await loadChartCharacters(options.limitPerChart, status, isStopRequested)
            : [{ id: getCharacterId(), name: '' }];
        const games = await detectGames(characters, status, isStopRequested);
        if (isStopRequested()) {
            status.textContent = chrome.i18n.getMessage('achievementDbBuilderStopped');
            return;
        }

        const requests = characters.length + selected.length * (SWITCH_LANGUAGE_REQUESTS + characters.length);
        const minutes = Math.ceil(requests * new TimedFetch().delay / 60000);
        estimate.textContent = chrome.i18n.getMessage('achievementDbBuilderEstimate',
            [String(characters.length), String(selected.length), String(requests), String(minutes)]);
        Logger.debug(estimate.textContent);

        downloadButton.style.display = 'none';
        const results = [];
        const failedLanguages = [];
        const interruptedLanguages = [];
        let failedReads = 0;
        let stopped = false;

        // Remembered so the language can be restored even if this run is interrupted
        await chrome.storage.local.set({ [ORIGINAL_LANGUAGE_KEY]: original.id });
        try {
            for (let i = 0; i < selected.length; i++) {
                if (isStopRequested()) {
                    stopped = true;
                    break;
                }

                const language = selected[i];
                const prefix = message => chrome.i18n.getMessage('achievementDbBuilderLanguageProgress',
                    [language.name, String(i + 1), String(selected.length), message]);
                try {
                    status.textContent = prefix('...');
                    await switchLanguage(language.id);
                    const read = await crawlCharacters(characters, games, message => { status.textContent = prefix(message); }, isStopRequested);

                    failedReads += read.failed.length;
                    if (read.aborted) interruptedLanguages.push(language.name);
                    if (read.achievements.length) {
                        const names = new Map(read.achievements.map(({ id, name }) => [id, name]));
                        Logger.debug(`Achievement database for ${language.name} (id ${language.id}), ${names.size} achievements from ${characters.length - read.failed.length} characters:\n${formatNamesEntry(language, names)}`);
                        results.push({ id: language.id, name: language.name, achievements: read.achievements });
                    }
                    if (read.stopped) {
                        stopped = true;
                        break;
                    }
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
                ui.setResults(results);
                downloadButton.style.display = results.length ? '' : 'none';
                return;
            }
        }

        ui.setResults(results);
        downloadButton.style.display = results.length ? '' : 'none';
        status.textContent = chrome.i18n.getMessage('achievementDbBuilderAllDone',
            [String(results.length), results.map(item => item.id).join(', ')]);
        if (stopped) status.textContent += ' ' + chrome.i18n.getMessage('achievementDbBuilderStopped');
        if (skippedLanguages.length) {
            status.textContent += ' ' + chrome.i18n.getMessage('achievementDbBuilderLanguagesSkipped',
                [skippedLanguages.map(language => language.name).join(', ')]);
        }
        if (failedLanguages.length) {
            status.textContent += ' ' + chrome.i18n.getMessage('achievementDbBuilderLanguagesFailed',
                [failedLanguages.join(', ')]);
        }
        if (interruptedLanguages.length) {
            status.textContent += ' ' + chrome.i18n.getMessage('achievementDbBuilderLanguagesInterrupted',
                [interruptedLanguages.join(', ')]);
        }
        if (failedReads) {
            status.textContent += ' ' + chrome.i18n.getMessage('achievementDbBuilderCharactersFailed', [String(failedReads)]);
        }

        const infoReport = reportInfo(results, characters.filter(character => !games.get(character.id)).length);
        if (infoReport) status.textContent += ' ' + infoReport;

        // Only interesting when many characters were read: with one, most of the achievements are not owned
        const uncovered = options.bulk && results.length ? findUncoveredIds(results) : [];
        if (uncovered.length) {
            Logger.debug(`Achievement Database Builder: no character owns ${uncovered.length} known achievements: ${uncovered.join(', ')}`);
            status.textContent += ' ' + chrome.i18n.getMessage('achievementDbBuilderUncovered',
                [String(uncovered.length), uncovered.join(', ')]);
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
        const bulkCheckbox = addOption(chrome.i18n.getMessage('achievementDbBuilderBulk'), false);

        const limitInput = el('input');
        limitInput.type = 'number';
        limitInput.id = `${BOX_ID}-limit`;
        limitInput.className = 'round';
        limitInput.min = '1';
        limitInput.max = String(MAX_CHARACTERS_PER_CHART);
        limitInput.value = String(MAX_CHARACTERS_PER_CHART);
        limitInput.style.width = '4em';
        const limitLabel = el('label', chrome.i18n.getMessage('achievementDbBuilderCharactersPerChart') + ' ');
        limitLabel.htmlFor = limitInput.id;
        const limitParagraph = el('p');
        limitParagraph.append(limitLabel, limitInput);
        box.appendChild(limitParagraph);

        const allButton = createButton(chrome.i18n.getMessage('achievementDbBuilderBuildAll'));
        const stopButton = createButton(chrome.i18n.getMessage('achievementDbBuilderStop'));
        stopButton.disabled = true;
        const downloadButton = createButton(chrome.i18n.getMessage('achievementDbBuilderDownload'));
        downloadButton.style.display = 'none';
        const restoreButton = createButton(chrome.i18n.getMessage('achievementDbBuilderRestore'));
        const allParagraph = el('p');
        allParagraph.append(allButton, ' ', stopButton, ' ', downloadButton);
        box.appendChild(allParagraph);

        const estimate = el('p');
        box.appendChild(estimate);
        const status = el('p');
        box.appendChild(status);

        if (needsRestore) {
            const restoreParagraph = el('p', chrome.i18n.getMessage('achievementDbBuilderRestoreInfo') + ' ');
            restoreParagraph.appendChild(restoreButton);
            box.insertBefore(restoreParagraph, box.children[1]);
        }

        // The stop button is not here: it is the only one that works while a run is going
        const buttons = [currentButton, allButton, restoreButton, skipKnownCheckbox, mergeCheckbox, bulkCheckbox, limitInput];
        const languageNames = new Map();
        let readResults = [];
        let stopRequested = false;

        currentButton.addEventListener('click', () => runExclusive(buttons, status, () => buildCurrentLanguage(status)));

        allButton.addEventListener('click', () => runExclusive(buttons, status, async () => {
            const selected = Array.from(new CssSelectorHelper('input[type="checkbox"]').getAll(languageList))
                .filter(checkbox => checkbox.checked)
                .map(checkbox => ({ id: parseInt(checkbox.dataset.languageId), name: checkbox.dataset.languageName }));

            let limitPerChart = parseInt(limitInput.value, 10);
            if (isNaN(limitPerChart) || limitPerChart < 1) limitPerChart = MAX_CHARACTERS_PER_CHART;
            limitPerChart = Math.min(limitPerChart, MAX_CHARACTERS_PER_CHART);

            stopRequested = false;
            stopButton.disabled = false;
            estimate.textContent = '';
            try {
                await buildLanguages(selected,
                    { skipKnown: skipKnownCheckbox.checked, bulk: bulkCheckbox.checked, limitPerChart },
                    { status, estimate, downloadButton, setResults: results => { readResults = results; }, isStopRequested: () => stopRequested });
            } finally {
                stopButton.disabled = true;
            }
        }));

        stopButton.addEventListener('click', () => {
            stopRequested = true;
            stopButton.disabled = true;
            status.textContent = chrome.i18n.getMessage('achievementDbBuilderStopping');
        });

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
