// Passively collects the game's own wording of the interactions (and of their groups) from the Interact page.
//
// The interaction dropdown only lists what is valid for the pair of characters involved, so a single visit
// never shows the full catalogue. Each visit is merged into chrome.storage.local, keyed by game language id.
// Only interaction ids, their localized names and the localized optgroup labels are kept: no character data.
(async () => {
    const STORAGE_KEY = 'interaction_names_collected';
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

    try {
        await Logger.init();

        const select = new CssSelectorHelper(INTERACTION_SELECT).getSingle();
        if (!select) return;

        const language = await Utils.getGameLanguage();
        if (!language) return;

        const read = readInteractionSelect(select);
        if (Object.keys(read.options).length === 0) return;

        const items = await chrome.storage.local.get({ [STORAGE_KEY]: { schema: SCHEMA_VERSION, languages: {} } });
        const collected = items[STORAGE_KEY];
        const stored = collected.languages[language.id] || (collected.languages[language.id] = { options: {}, groups: {} });

        if (mergeInto(stored, read)) {
            collected.schema = SCHEMA_VERSION;
            await chrome.storage.local.set({ [STORAGE_KEY]: collected });
            Logger.debug(`Interaction collector: stored ${Object.keys(stored.options).length} names for language ${language.id}`);
        }
    } catch (e) {
        Logger.warn('Interaction collector failed', e);
    }
})();
