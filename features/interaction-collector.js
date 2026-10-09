// Passively collects the game's own wording of the interactions (and of their groups) from the Interact page.
//
// The interaction dropdown only lists what is valid for the pair of characters involved, so a single visit
// never shows the full catalogue. Each visit is merged into chrome.storage.local, keyed by game language id.
// Only interaction ids, their localized names and the localized group labels are kept: no character data.
//
// What is new compared to the data shipped with the extension (interaction-names-data.js) and to what was already
// sent is kept as "pending", and background.js is told, so it can send it to the community (see submitInteractionNames).
(async () => {
    const STORAGE_KEY = 'interaction_names_collected';
    const PENDING_KEY = 'interaction_names_pending';
    const SENT_KEY = 'interaction_names_sent';
    const SCHEMA_VERSION = 1;
    const MAX_NAME_LENGTH = 60;
    const INTERACTION_SELECT = 'select[id$="ddlInteractionTypes"]';

    const cleanText = (text) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);

    /**
     * Reads the interaction dropdown into a language-independent structure.
     * @param {Element} select The interaction types select element
     * @return {{options: Object<string, string>, groups: Object<string, {ids: number[]}>}}
     */
    function readInteractionSelect(select) {
        const options = {};
        const groups = {};

        for (const option of new CssSelectorHelper('option', select).getAllArray()) {
            const id = parseInt(option.value);
            const name = cleanText(option.textContent);
            // Value 0 is the "choose an interaction" placeholder.
            if (!Number.isFinite(id) || id <= 0 || !name) continue;

            options[id] = name;

            // The server sends flat options tagged with a localized data-group; the optgroup elements are built
            // later by a page script, so they may not exist yet when we run. The data-group is the group name.
            const label = cleanText(option.getAttribute('data-group'));
            if (!label) continue;

            const group = groups[label] || (groups[label] = { ids: [] });
            if (!group.ids.includes(id)) group.ids.push(id);
        }

        return { options, groups };
    }

    /**
     * Merges what has just been read into what we already collected for the same language.
     * @return {boolean} True when the stored data changed.
     */
    function mergeInto(stored, read) {
        let changed = false;

        for (const [id, name] of Object.entries(read.options)) {
            if (stored.options[id] !== name) {
                stored.options[id] = name;
                changed = true;
            }
        }

        for (const [label, group] of Object.entries(read.groups)) {
            const known = stored.groups[label] || (stored.groups[label] = { ids: [] });
            for (const id of group.ids) {
                if (!known.ids.includes(id)) {
                    known.ids.push(id);
                    changed = true;
                }
            }
        }

        return changed;
    }

    /**
     * Flattens what was collected for a language into { names: {id: name}, groups: {id: groupLabel} }.
     * A group is sent as the label of every interaction in it: the label is matched across languages by id later.
     */
    function toEntries(languageData) {
        const groups = {};
        for (const [label, group] of Object.entries(languageData.groups)) {
            for (const id of group.ids) groups[id] = label;
        }
        return { names: { ...languageData.options }, groups };
    }

    // True when the value is already shipped with the extension
    function isShipped(languageId, kind, id, value) {
        if (kind === 'names') {
            const language = INTERACTION_NAMES_DB[languageId];
            return !!language && language.options[id] === value;
        }
        const groupNames = INTERACTION_GROUP_NAMES[INTERACTION_GROUP_BY_ID[id]];
        return !!groupNames && groupNames[languageId] === value;
    }

    /**
     * Collected entries that are neither shipped nor already sent.
     * @return {Object<string, {names: Object<string, string>, groups: Object<string, string>}>} By language id
     */
    function computePending(collected, sent) {
        const pending = {};

        for (const [languageId, languageData] of Object.entries(collected.languages)) {
            const entries = toEntries(languageData);
            const alreadySent = sent[languageId] || { names: {}, groups: {} };

            for (const kind of ['names', 'groups']) {
                for (const [id, value] of Object.entries(entries[kind])) {
                    if (isShipped(languageId, kind, id, value) || alreadySent[kind][id] === value) continue;

                    const language = pending[languageId] || (pending[languageId] = { names: {}, groups: {} });
                    language[kind][id] = value;
                }
            }
        }

        return pending;
    }

    try {
        await Logger.init();

        const select = new CssSelectorHelper(INTERACTION_SELECT).getSingle();
        if (!select) return;

        const language = await Utils.getGameLanguage();
        if (!language) return;

        const read = readInteractionSelect(select);
        if (Object.keys(read.options).length === 0) return;

        const items = await chrome.storage.local.get({
            [STORAGE_KEY]: { schema: SCHEMA_VERSION, languages: {} },
            [PENDING_KEY]: {},
            [SENT_KEY]: {}
        });
        const collected = items[STORAGE_KEY];
        const stored = collected.languages[language.id] || (collected.languages[language.id] = { options: {}, groups: {} });

        if (mergeInto(stored, read)) {
            collected.schema = SCHEMA_VERSION;
            await chrome.storage.local.set({ [STORAGE_KEY]: collected });
            Logger.debug(`Interaction collector: stored ${Object.keys(stored.options).length} names for language ${language.id}`);
        }

        // Computed at every visit, not only when something changed, so that a failed submission is retried
        const pending = computePending(collected, items[SENT_KEY]);
        if (JSON.stringify(pending) !== JSON.stringify(items[PENDING_KEY])) {
            await chrome.storage.local.set({ [PENDING_KEY]: pending });
        }
        if (Object.keys(pending).length > 0) {
            chrome.runtime.sendMessage({ type: 'interaction-names', payload: 'pending' }).catch(() => { });
        }
    } catch (e) {
        Logger.warn('Interaction collector failed', e);
    }
})();
