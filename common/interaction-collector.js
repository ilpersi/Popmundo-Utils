/**
 * Passively collects the game's own wording of the interactions (and of their groups) from the Interact dropdown.
 *
 * The dropdown only lists what is valid for the pair of characters involved, so a single page never shows the whole
 * catalogue. Every page read is merged into chrome.storage.local, keyed by game language id. Only interaction ids,
 * their localized names and the localized group labels are kept: no character data.
 *
 * What is new compared to the data shipped with the extension (features/interaction-names-data.js, which must be loaded
 * before this file) and to what was already sent is kept as "pending", and background.js is told, so it can send it to the
 * community (see submitInteractionNames).
 *
 * It is used on the Interact page the user opens (features/interaction-collector.js) and by the features that fetch
 * Interact pages themselves (Mass Interact, Call All Friends), which only have to hand over the pages they already
 * downloaded: it makes no request.
 *
 * Usage for a feature that reads many pages:
 *   const collector = new InteractionCollector();
 *   collector.add(doc);          // for every parsed Interact page, synchronous and cheap
 *   await collector.flush();     // now and then, and at the end: one storage write for everything read so far
 *
 * The names are read from the text of the page, and some users have other extensions or scripts that add their own
 * text to the dropdown: the interaction id in front ("[1] Greet") or the effect after the name ("Kiss (❤️+5%)").
 * That text is not the game's name, so it is removed before anything is stored or sent, in two layers:
 *  1. The userscript "Social" (greasyfork.org/scripts/567869, and its mobile version 568918) writes the effect after
 *     the name, and keeps the original text in the attribute data-ih-base of the option (it also sets data-ih-sub).
 *     When the attribute is there we start from it: exact, nothing to guess, also for effects that have no "%".
 *  2. cleanName() then removes what is left, with or without the attribute: the id in front and the effect after.
 *     It covers other tools and the pages of older versions. The sync script (scripts/sync-interaction-names.mjs)
 *     applies the same rule to what older versions of the extension already sent: keep the two functions identical.
 *
 * Nothing here ever throws: the collector must never be able to break the feature that uses it.
 *
 * @class InteractionCollector
 */
class InteractionCollector {
    static STORAGE_KEY = 'interaction_names_collected';
    static PENDING_KEY = 'interaction_names_pending';
    static SENT_KEY = 'interaction_names_sent';
    static SCHEMA_VERSION = 1;
    static MAX_NAME_LENGTH = 60;
    static INTERACTION_SELECT = 'select[id$="ddlInteractionTypes"]';

    /**
     * The game's name of an interaction, without what other extensions or scripts add to the dropdown text:
     * a leading "[<id of this interaction>]" and a trailing bracket that contains a "%" (the effect on the relationship).
     * Nothing else is removed, and a name is never emptied. Cleaning a clean name changes nothing.
     * Keep it identical to cleanInteractionName() in scripts/sync-interaction-names.mjs.
     *
     * @static
     * @param {string} text The text of the option
     * @param {number|string} id The interaction id (the option value)
     * @return {string} The cleaned name, whitespace flattened and trimmed (not shortened)
     * @memberof InteractionCollector
     */
    static cleanName(text, id) {
        let name = String(text ?? '').replace(/\s+/g, ' ').trim();

        const prefix = `[${id}]`;
        if (name.startsWith(prefix)) {
            const rest = name.slice(prefix.length).trim();
            if (rest) name = rest;
        }

        for (let i = 0; i < 3; i++) {
            const rest = name.replace(/\s*\([^()]*%[^()]*\)\s*$/, '').trim();
            if (!rest || rest === name) break;
            name = rest;
        }

        return name;
    }

    /** What was read since the last successful flush: { options: {id: name}, groups: {label: {ids: []}} } */
    #read = InteractionCollector.#emptyRead();

    /**
     * Reads one Interact page and sends what is new to the community, in one go.
     *
     * @static
     * @param {Document|Element} [doc=document] The page, live or parsed by DOMParser
     * @memberof InteractionCollector
     */
    static async collect(doc = document) {
        const collector = new InteractionCollector();
        collector.add(doc);
        await collector.flush();
    }

    /**
     * Reads the interaction dropdown of a page and keeps it in memory until the next flush.
     *
     * @param {Document|Element} doc The page, live or parsed by DOMParser
     * @return {boolean} True when the page had a dropdown with interactions
     * @memberof InteractionCollector
     */
    add(doc) {
        try {
            const select = doc ? new CssSelectorHelper(InteractionCollector.INTERACTION_SELECT).getSingle(doc) : null;
            if (!select) return false;

            const read = InteractionCollector.#readSelect(select);
            if (Object.keys(read.options).length === 0) return false;

            InteractionCollector.#mergeInto(this.#read, read);
            return true;
        } catch (e) {
            Logger.warn('Interaction collector: unable to read a page', e);
            return false;
        }
    }

    /**
     * Stores what was read, works out what is new and tells the background to send it. When something goes wrong
     * what was read is kept for the next flush.
     *
     * @memberof InteractionCollector
     */
    async flush() {
        if (Object.keys(this.#read.options).length === 0) return;

        // We take what was read so far: pages added while we wait for the storage go in the next flush
        const read = this.#read;
        this.#read = InteractionCollector.#emptyRead();

        try {
            const language = await Utils.getGameLanguage();
            if (!language) throw new Error('The game language is not known');

            const items = await chrome.storage.local.get({
                [InteractionCollector.STORAGE_KEY]: { schema: InteractionCollector.SCHEMA_VERSION, languages: {} },
                [InteractionCollector.PENDING_KEY]: {},
                [InteractionCollector.SENT_KEY]: {}
            });
            const collected = items[InteractionCollector.STORAGE_KEY];
            const stored = collected.languages[language.id] || (collected.languages[language.id] = { options: {}, groups: {} });

            // Names stored by older versions may still carry text added by other extensions: the pending list is
            // computed from this data, so it is cleaned here and a name that was sent with the extra text is sent again clean
            const cleaned = InteractionCollector.#cleanStored(collected);

            if (InteractionCollector.#mergeInto(stored, read) || cleaned) {
                collected.schema = InteractionCollector.SCHEMA_VERSION;
                await chrome.storage.local.set({ [InteractionCollector.STORAGE_KEY]: collected });
                Logger.debug(`Interaction collector: stored ${Object.keys(stored.options).length} names for language ${language.id}`);
            }

            // Computed at every flush, not only when something changed, so that a failed submission is retried
            const pending = InteractionCollector.#computePending(collected, items[InteractionCollector.SENT_KEY]);
            if (JSON.stringify(pending) !== JSON.stringify(items[InteractionCollector.PENDING_KEY])) {
                await chrome.storage.local.set({ [InteractionCollector.PENDING_KEY]: pending });
            }
            if (Object.keys(pending).length > 0) {
                chrome.runtime.sendMessage({ type: 'interaction-names', payload: 'pending' }).catch(() => { });
            }
        } catch (e) {
            Logger.warn('Interaction collector failed', e);
            InteractionCollector.#mergeInto(this.#read, read);
        }
    }

    /**
     * Cleans the names that were stored by older versions.
     * @return {boolean} True when something changed.
     */
    static #cleanStored(collected) {
        let changed = false;

        for (const languageData of Object.values(collected.languages)) {
            for (const [id, name] of Object.entries(languageData.options)) {
                const cleaned = InteractionCollector.cleanName(name, id).slice(0, InteractionCollector.MAX_NAME_LENGTH);
                if (cleaned !== name) {
                    languageData.options[id] = cleaned;
                    changed = true;
                }
            }
        }

        return changed;
    }

    static #emptyRead() {
        return { options: {}, groups: {} };
    }

    static #cleanText(text) {
        return String(text || '').replace(/\s+/g, ' ').trim().slice(0, InteractionCollector.MAX_NAME_LENGTH);
    }

    /**
     * Reads the interaction dropdown into a language-independent structure.
     * @param {Element} select The interaction types select element
     * @return {{options: Object<string, string>, groups: Object<string, {ids: number[]}>}}
     */
    static #readSelect(select) {
        const options = {};
        const groups = {};
        let decoratedBySocial = false;

        for (const option of new CssSelectorHelper('option', select).getAllArray()) {
            const id = parseInt(option.value);

            // Layer 1: the "Social" userscript keeps the original text in data-ih-base (the same "||" it uses itself)
            if (option.getAttribute('data-ih-sub') !== null) decoratedBySocial = true;
            const text = option.getAttribute('data-ih-base') || option.textContent;

            // Layer 2: whatever else was added is removed, marker or not
            const name = InteractionCollector.cleanName(text, id).slice(0, InteractionCollector.MAX_NAME_LENGTH);
            // Value 0 is the "choose an interaction" placeholder.
            if (!Number.isFinite(id) || id <= 0 || !name) continue;

            options[id] = name;

            // The server sends flat options tagged with a localized data-group; the optgroup elements are built
            // later by a page script, so they may not exist yet (and never exist in a page we fetched ourselves).
            // The data-group is the group name.
            const label = InteractionCollector.#cleanText(option.getAttribute('data-group'));
            if (!label) continue;

            const group = groups[label] || (groups[label] = { ids: [] });
            if (!group.ids.includes(id)) group.ids.push(id);
        }

        if (decoratedBySocial) Logger.debug('Interaction collector: the page is decorated by the Social userscript, the original names are used');

        return { options, groups };
    }

    /**
     * Merges what has just been read into what we already collected for the same language.
     * @return {boolean} True when the stored data changed.
     */
    static #mergeInto(stored, read) {
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
    static #toEntries(languageData) {
        const groups = {};
        for (const [label, group] of Object.entries(languageData.groups)) {
            for (const id of group.ids) groups[id] = label;
        }
        return { names: { ...languageData.options }, groups };
    }

    // True when the value is already shipped with the extension
    static #isShipped(languageId, kind, id, value) {
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
    static #computePending(collected, sent) {
        // Without the shipped data everything would look new: better to fail than to send all of it
        if (typeof INTERACTION_NAMES_DB === 'undefined') throw new Error('features/interaction-names-data.js is not loaded');

        const pending = {};

        for (const [languageId, languageData] of Object.entries(collected.languages)) {
            const entries = InteractionCollector.#toEntries(languageData);
            const alreadySent = sent[languageId] || { names: {}, groups: {} };

            for (const kind of ['names', 'groups']) {
                for (const [id, value] of Object.entries(entries[kind])) {
                    if (InteractionCollector.#isShipped(languageId, kind, id, value) || alreadySent[kind][id] === value) continue;

                    const language = pending[languageId] || (pending[languageId] = { names: {}, groups: {} });
                    language[kind][id] = value;
                }
            }
        }

        return pending;
    }
}
