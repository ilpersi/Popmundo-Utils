/**
 * A generic class containing misc utilities methods to be used in different content scripts
 *
 * @class Utils
 */
class Utils {

    /**
     * Regular expression to find the javascript code used to draw stars in the game
     *
     * @readonly
     * @static
     * @memberof Utils
     */
    static get starsJSRE() {
        const returnRE = /<script type="text\/javascript">drawStarCount\((?<goldStars>[0-5]),\s*(?<whiteStars>[0-5]),\s*(?<greyStars>[0-5]),\s*"(?<starTXT>[^"]+?)",\s*"(?<starClass>[^"]*?)",\s*"(?<imgPath>[^"]*?)",\s*(?<txtOnly>false|true)\s*\);*<\/script>/gm;
        return returnRE;
    }

    /**
     * Regular expression to find the javascript code used to draw progress bars in the game
     *
     * @readonly
     * @static
     * @memberof Utils
     */
    static get progressBarJSRE() {
        // <script type="text/javascript">drawProgressBar(0, false, "0%", "progressBar", false, "0%");</script>
        const returnRE = /<script type="text\/javascript">drawProgressBar\((?<progressInt>[0-9]{1,3}),\s*(?<bool1>false|true),\s*"(?<progressStr>[^"]+?)",\s*"(?<style>[^"]+?)",\s*(?<bool2>false|true),\s*"(?<progressStr2>[^"]+?)"\s*\);<\/script>/gm;
        return returnRE;
    }

    /**
     * Regular expression to find the javascript code used to draw plus-minus bars in the game
     *
     * @readonly
     * @static
     * @memberof Utils
     */
    static get plusMinusBarJSRE() {
        // <script type="text/javascript">drawPlusMinusBar(0, "0%", "plusMinusBar", false, "0%");</script>
        const returnRE = /<script type="text\/javascript">drawPlusMinusBar\((?<progressInt>-{0,1}[0-9]{1,3}),\s*"(?<progressStr>[^"]+?)",\s*"(?<style>[^"]+?)",\s*(?<bool1>false|true),\s*"(?<progressStr2>[^"]+?)"\s*\);<\/script>/gm;
        return returnRE;
    }

    /**
     * Get the id of your own character.
     *
     * @static
     * @return {int} The id of your character if found, otherwise 0
     * @memberof Utils
     */
    static getMyID() {
        let idHolderElem = new CssSelectorHelper('div.idHolder').getSingle();

        return idHolderElem ? parseInt(idHolderElem.textContent) : 0;
    }

    /**
     * Get the name of your own character by scraping the character header.
     * Only present on certain pages (e.g. character profile / characters present);
     * returns an empty string elsewhere.
     *
     * @static
     * @return {string} The name of your character if found, otherwise ''
     * @memberof Utils
     */
    static getMyName() {
        const nameNode = new CssSelectorHelper("#ppm-content > div.box.ofauto.charPresBox > h2").getSingle();
        return nameNode ? nameNode.textContent : '';
    }

    /**
     * Resolve the current character's {id, name} with a resilient fallback chain:
     *   1. session storage via background SW (canonical, populated by global-content-script)
     *   2. DOM scrape via Utils.getMyID() + Utils.getMyName()
     *
     * Returns {id: 0, name: ''} only if both layers fail. Used by features that need
     * the current character ID even after the MV3 service worker has been reaped and
     * cleared session storage (issue #15).
     *
     * @static
     * @return {Promise<{id: number, name: string}>}
     * @memberof Utils
     */
    static async getMyCharDetails() {
        try {
            const items = await chrome.runtime.sendMessage({
                'type': 'storage.session',
                'payload': 'get',
                'param': ['current_char_details'],
            });
            const details = items && items['current_char_details'];
            if (details && details.id) return details;
        } catch (_) {
            // sendMessage rejected (SW reaped, port closed, etc.) — fall through to DOM scrape.
        }

        const id = Utils.getMyID();
        if (id) return { id, name: Utils.getMyName() };
        return { id: 0, name: '' };
    }

    /**
     * Returns the input as a plain (non-array, non-null) object, otherwise {}.
     * Defensive normalizer for the per-character exclude-list maps stored in sync.
     *
     * @static
     * @memberof Utils
     */
    static normalizeExcludeMap(raw) {
        return (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) ? raw : {};
    }

    /**
     * Extracts the numeric character ID from an exclude-list entry, accepting both
     * the legacy `{id, name}` object shape and the v2 plain-id shape.
     * Returns null if the entry can't be parsed.
     *
     * @static
     * @memberof Utils
     */
    static excludeEntryId(entry) {
        const raw = (typeof entry === 'object' && entry !== null) ? entry.id : entry;
        const id = Number(raw);
        return (Number.isFinite(id) && id > 0) ? id : null;
    }

    /**
     * Number of buckets used to shard the synced character-name cache. Sized so the
     * theoretical worst case (10 of your chars × 100 entries × 2 features = 2000
     * unique excluded characters × ~25 bytes each ≈ 50 KB) stays well under the 8 KB
     * per-item sync quota in every bucket. 8 keeps each bucket ≤ ~6.25 KB at worst.
     *
     * @readonly
     * @static
     * @memberof Utils
     */
    static EXCLUDE_NAME_BUCKETS = 8;

    /**
     * @private
     * Memoized promise so concurrent callers within a single content-script context
     * share one migration run instead of racing.
     */
    static _excludeMigrationPromise = null;

    /**
     * Returns the array of numeric IDs excluded by the given player character for
     * the named feature, reading from the per-character sharded sync key
     * `<featureKey>_<myCharID>`. Falls back to the legacy single-key map if the
     * shard hasn't been written yet (i.e. before migration completes).
     *
     * @static
     * @memberof Utils
     */
    static async getExcludedIds(featureKey, myCharID) {
        await Utils.ensureExcludeListsMigrated();
        const shardKey = `${featureKey}_${myCharID}`;
        const data = await chrome.storage.sync.get({ [shardKey]: null, [featureKey]: null });

        if (Array.isArray(data[shardKey])) {
            return data[shardKey].map(e => Utils.excludeEntryId(e)).filter(id => id !== null);
        }
        // Legacy fallback (pre-migration data)
        if (data[featureKey] && typeof data[featureKey] === 'object' && !Array.isArray(data[featureKey])) {
            const list = data[featureKey][String(myCharID)];
            if (Array.isArray(list)) {
                return list.map(e => Utils.excludeEntryId(e)).filter(id => id !== null);
            }
        }
        return [];
    }

    /**
     * Idempotently records a {id → name} mapping in the bucketed name cache
     * (`synced_char_names_<bucket>` keys). No-op if the name is already up to date.
     *
     * @static
     * @memberof Utils
     */
    static async cacheCharName(charID, charName) {
        if (!charID || !charName) return;
        const id = Number(charID);
        if (!Number.isFinite(id) || id <= 0) return;
        const bucketKey = `synced_char_names_${id % Utils.EXCLUDE_NAME_BUCKETS}`;
        const key = String(id);
        const stored = await chrome.storage.sync.get({ [bucketKey]: {} });
        const bucket = (typeof stored[bucketKey] === 'object' && stored[bucketKey] !== null && !Array.isArray(stored[bucketKey])) ? stored[bucketKey] : {};
        if (bucket[key] === charName) return;
        bucket[key] = String(charName);
        await chrome.storage.sync.set({ [bucketKey]: bucket });
    }

    /**
     * Loads and returns the merged synced_char_names map across all buckets.
     * Single round-trip (one storage.get with all bucket keys).
     *
     * @return {Promise<Object<string, string>>}
     * @static
     * @memberof Utils
     */
    static async loadSyncedCharNames() {
        const defaults = {};
        for (let i = 0; i < Utils.EXCLUDE_NAME_BUCKETS; i++) defaults[`synced_char_names_${i}`] = {};
        const stored = await chrome.storage.sync.get(defaults);
        const merged = {};
        for (let i = 0; i < Utils.EXCLUDE_NAME_BUCKETS; i++) {
            const bucket = stored[`synced_char_names_${i}`];
            if (typeof bucket === 'object' && bucket !== null && !Array.isArray(bucket)) {
                Object.assign(merged, bucket);
            }
        }
        return merged;
    }

    /**
     * Toggles the given character's presence in the named feature's per-char
     * exclusion shard. Updates the bucketed name cache when adding. Falls back to
     * the legacy single-key map for the read if the shard doesn't exist yet, so
     * pre-migration data isn't dropped on a toggle. Returns true if now excluded.
     *
     * @param {string} featureKey 'mass_interact_exclude_id' or 'call_exclude_id'
     * @param {string} myCharKey  Active player character ID as a string
     * @param {number} charID     Numeric ID of the character to toggle
     * @param {string} charName   Display name (used only when adding)
     * @return {Promise<boolean>}
     * @static
     * @memberof Utils
     */
    static async toggleExclusion(featureKey, myCharKey, charID, charName) {
        await Utils.ensureExcludeListsMigrated();
        const shardKey = `${featureKey}_${myCharKey}`;
        const data = await chrome.storage.sync.get({ [shardKey]: null, [featureKey]: null });

        let ids;
        if (Array.isArray(data[shardKey])) {
            ids = data[shardKey].map(e => Utils.excludeEntryId(e)).filter(id => id !== null);
        } else if (data[featureKey] && typeof data[featureKey] === 'object' && !Array.isArray(data[featureKey])) {
            const list = data[featureKey][myCharKey];
            ids = Array.isArray(list) ? list.map(e => Utils.excludeEntryId(e)).filter(id => id !== null) : [];
        } else {
            ids = [];
        }

        const idx = ids.indexOf(charID);
        const nowExcluded = idx === -1;
        if (nowExcluded) ids.push(charID);
        else ids.splice(idx, 1);

        await chrome.storage.sync.set({ [shardKey]: ids });
        if (nowExcluded) await Utils.cacheCharName(charID, charName);
        return nowExcluded;
    }

    /**
     * Resolves a character ID to a display name with a graceful fallback chain:
     *   1. synced_char_names (merged buckets, populated by Utils.cacheCharName)
     *   2. all_characters_details["id-name"] (local, populated by global-content-script)
     *   3. legacyName carried inside the entry, if any
     *   4. "#<id>" placeholder
     *
     * Pure helper — pass in pre-loaded lookup tables so callers can resolve many IDs
     * without hammering storage.
     *
     * @static
     * @memberof Utils
     */
    static resolveCharName(charID, syncedNames, idNameMap, legacyName) {
        const key = String(charID);
        if (syncedNames && syncedNames[key]) return syncedNames[key];
        if (idNameMap && idNameMap[key]) return idNameMap[key];
        if (legacyName) return legacyName;
        return `#${key}`;
    }

    /**
     * Idempotent guard so any read/write entry point can `await Utils.ensureExcludeListsMigrated()`
     * before touching exclusion data. Memoized within a content-script context so concurrent
     * callers share one in-flight migration.
     *
     * @static
     * @memberof Utils
     */
    static ensureExcludeListsMigrated() {
        if (!Utils._excludeMigrationPromise) {
            Utils._excludeMigrationPromise = Utils.migrateExcludeListsSharded();
        }
        return Utils._excludeMigrationPromise;
    }

    /**
     * Builds a single JSON-serializable snapshot useful for bug reports:
     *   - extension version + collection timestamp + current URL + userAgent
     *   - sync storage usage (total + per-key sizes) and the 102 KB cap
     *   - local storage usage and the 5 MB cap
     *   - current character {id, name} (via the resilient resolver)
     *   - exclusion-shard counts (number of mass-interact / call-all-friends shards, name buckets)
     *   - the persisted diagnostic ring buffer (last ~200 warn/error entries)
     *
     * Designed to be one paste in a GitHub issue — replaces the "open the
     * service-worker console, run these four commands, screenshot the result"
     * dance from the troubleshooting template (issue #15).
     *
     * @static
     * @return {Promise<Object>}
     * @memberof Utils
     */
    static async collectDiagnostics() {
        const out = {
            ts: new Date().toISOString(),
            version: 'unknown',
            url: (typeof window !== 'undefined' && window.location) ? window.location.href : '',
            userAgent: (typeof navigator !== 'undefined') ? navigator.userAgent : '',
            storage: {},
            charInfo: null,
            exclusionStats: {},
            log: [],
            collectionErrors: [],
        };

        try { out.version = chrome.runtime.getManifest().version; }
        catch (e) { out.collectionErrors.push(`manifest: ${e && e.message || e}`); }

        try {
            const syncBytes = await chrome.storage.sync.getBytesInUse(null);
            const syncAll = await chrome.storage.sync.get(null);
            const perKey = {};
            for (const [k, v] of Object.entries(syncAll)) {
                try { perKey[k] = JSON.stringify(v).length; } catch (_) { perKey[k] = -1; }
            }
            out.storage.sync = { bytesUsed: syncBytes, bytesCap: 102400, perItemCap: 8192, perKey };
        } catch (e) { out.collectionErrors.push(`sync: ${e && e.message || e}`); }

        try {
            const localBytes = await chrome.storage.local.getBytesInUse(null);
            out.storage.local = { bytesUsed: localBytes, bytesCap: 5242880 };
        } catch (e) { out.collectionErrors.push(`local: ${e && e.message || e}`); }

        try { out.charInfo = await Utils.getMyCharDetails(); }
        catch (e) { out.collectionErrors.push(`char: ${e && e.message || e}`); }

        try {
            const keys = (out.storage.sync && out.storage.sync.perKey) ? Object.keys(out.storage.sync.perKey) : [];
            out.exclusionStats = {
                mass_interact_shards: keys.filter(k => k.startsWith('mass_interact_exclude_id_')).length,
                call_exclude_shards: keys.filter(k => k.startsWith('call_exclude_id_')).length,
                name_buckets: keys.filter(k => k.startsWith('synced_char_names_')).length,
                migration_done: !!(out.storage.sync && out.storage.sync.perKey && out.storage.sync.perKey.exclude_format_sharded_migrated !== undefined),
            };
        } catch (e) { out.collectionErrors.push(`exclusion-stats: ${e && e.message || e}`); }

        try { out.log = await Logger.getDiagnosticBuffer(); }
        catch (e) { out.collectionErrors.push(`log: ${e && e.message || e}`); }

        return out;
    }

    /**
     * One-shot migration of legacy single-key exclusion lists
     *   `mass_interact_exclude_id = {charKey: [{id,name},…]}` (original shape)
     *   `call_exclude_id          = {charKey: [{id,name},…]}`
     *   `synced_char_names        = {id: name, …}` (only present in unpublished v2 dev builds)
     * into per-character sharded keys plus a bucketed name cache:
     *   `mass_interact_exclude_id_<charKey> = [id, …]`
     *   `call_exclude_id_<charKey>          = [id, …]`
     *   `synced_char_names_0…7              = {id: name, …}`
     *
     * Gated by `exclude_format_sharded_migrated` so it runs at most once per account.
     * Cleans up the legacy keys (and the unpublished v2 single-key cache + flag) after
     * a successful write.
     *
     * @static
     * @memberof Utils
     */
    static async migrateExcludeListsSharded() {
        const FLAG = 'exclude_format_sharded_migrated';
        const data = await chrome.storage.sync.get({
            [FLAG]: false,
            mass_interact_exclude_id: null,
            call_exclude_id: null,
            synced_char_names: null,
        });
        if (data[FLAG]) return;

        const writeBack = {};
        const removeKeys = [];

        // Bucketed accumulator for any names lifted out of legacy entries or the v2 cache.
        const namesPerBucket = new Array(Utils.EXCLUDE_NAME_BUCKETS).fill(null).map(() => ({}));

        const processFeature = (featureKey) => {
            const map = Utils.normalizeExcludeMap(data[featureKey]);
            for (const [charKey, list] of Object.entries(map)) {
                if (!Array.isArray(list)) continue;
                const ids = [];
                for (const entry of list) {
                    const id = Utils.excludeEntryId(entry);
                    if (id === null) continue;
                    ids.push(id);
                    if (typeof entry === 'object' && entry !== null && entry.name) {
                        const bucket = id % Utils.EXCLUDE_NAME_BUCKETS;
                        const k = String(id);
                        if (!namesPerBucket[bucket][k]) namesPerBucket[bucket][k] = String(entry.name);
                    }
                }
                if (ids.length > 0) writeBack[`${featureKey}_${charKey}`] = ids;
            }
            if (data[featureKey] !== null) removeKeys.push(featureKey);
        };

        processFeature('mass_interact_exclude_id');
        processFeature('call_exclude_id');

        // Fold the unpublished v2 single-key name cache (if present in dev profiles) into buckets.
        if (data.synced_char_names && typeof data.synced_char_names === 'object' && !Array.isArray(data.synced_char_names)) {
            for (const [k, name] of Object.entries(data.synced_char_names)) {
                const id = Number(k);
                if (!Number.isFinite(id) || id <= 0 || !name) continue;
                const bucket = id % Utils.EXCLUDE_NAME_BUCKETS;
                if (!namesPerBucket[bucket][String(id)]) namesPerBucket[bucket][String(id)] = String(name);
            }
            removeKeys.push('synced_char_names');
        }

        // Merge into existing bucket keys (don't clobber names already cached).
        const bucketDefaults = {};
        for (let i = 0; i < Utils.EXCLUDE_NAME_BUCKETS; i++) bucketDefaults[`synced_char_names_${i}`] = {};
        const existingBuckets = await chrome.storage.sync.get(bucketDefaults);
        for (let i = 0; i < Utils.EXCLUDE_NAME_BUCKETS; i++) {
            const bucketKey = `synced_char_names_${i}`;
            const existing = (typeof existingBuckets[bucketKey] === 'object' && existingBuckets[bucketKey] !== null && !Array.isArray(existingBuckets[bucketKey]))
                ? existingBuckets[bucketKey]
                : {};
            const merged = { ...existing, ...namesPerBucket[i] };
            if (Object.keys(merged).length > 0) writeBack[bucketKey] = merged;
        }

        // Sweep the unpublished v2 flag if it lingers from a dev profile.
        removeKeys.push('exclude_format_v2_migrated');

        writeBack[FLAG] = true;

        await chrome.storage.sync.set(writeBack);
        if (removeKeys.length > 0) await chrome.storage.sync.remove(removeKeys);
    }

    /**
     * Get theme properties to coorectly dispay pop-ups in pages.
     *
     * @static
     * @param {*} [contextNode=document] The context node for the XPATH query
     * @return {object} An object containing the required properties to render the pop-up correctly 
     * @memberof Utils
     */
    static getPopupTheme(contextNode = document) {
        const SKIN_XPATH = '//link[@rel="stylesheet" and contains(@href,"Theme") and contains(@href,"css") and @type="text/css" and not(contains(@href,"jquery"))]';

        let skinCSSResult = document.evaluate(SKIN_XPATH, contextNode, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);

        // We initialize default values for all the properties
        var result = {
            DATA_THEME: 'transparent',
            NO_DATA_THEME: 'transparent',
            LOADING_THEME: 'transparent',
            COLOR: 'black',
            FONT_SIZE: '11px',
        }

        if (skinCSSResult.singleNodeValue) {
            let skinCSSNode = skinCSSResult.singleNodeValue;

            let cssHref = skinCSSNode.getAttribute('href').toLowerCase();

            // Based on the used skin, we correctly set the properties
            if (cssHref.includes('dark')) { // Dark Theme
                result.DATA_THEME = 'dark';
                result.NO_DATA_THEME = 'dark';
                result.LOADING_THEME = 'dark';
                result.COLOR = '#fff';
                result.FONT_SIZE = '11px';
            } else if (cssHref.includes('default')) { // Default Theme
                result.DATA_THEME = 'default';
                result.NO_DATA_THEME = 'retro';
                result.LOADING_THEME = 'retro';
                result.COLOR = '#000';
                result.FONT_SIZE = '11px';
            } else if (cssHref.includes('retro')) { // Default Theme
                result.DATA_THEME = 'retro';
                result.NO_DATA_THEME = 'retro';
                result.LOADING_THEME = 'retro';
                result.COLOR = '#000';
                result.FONT_SIZE = '11px';
            }
        }

        return result;

    }

    /**
     * Will take care of rendering the correct stars from a regex match.
     * This is to be used a call back for a regex replace. The original logic is inspired
     * by the standard popmundo function createStarCount (hope they don't sue me :D)
     *
     * @param {string} match The full regex matched. Mostly unused
     * @param {number} goldStars How many gold stars should we draw?
     * @param {number} whiteStars How many white stars should we draw? This should always be equal to 1
     * @param {number} greyStars How many grey stars should we draw?
     * @param {string} starTXT The title that will be given to returned div string
     * @param {string} starClass The CSS class to apply to the generated dive string
     * @param {string} imgPath Where to find the images for the stars
     * @param {boolean} txtOnly If set to true, only text is contained in returned div element (no star images)
     * @return {string} The HTML for a div element to include in your DOM model
     */
    static createStarCount(match, goldStars, whiteStars, greyStars, starTXT, starClass, imgPath, txtOnly) {

        // We make sure to cast string in boolean
        txtOnly = (txtOnly === 'true');

        // Result div tag
        let result = "<div";

        if (starClass && "" != starClass)
            result += ' class="' + starClass + '"';

        result += ' title="' + starTXT + '">';

        if (txtOnly) {
            result += starTXT;
        }
        else {
            let s;
            for (s = 0; s < goldStars; s++)
                result += '<img src="' + imgPath + 'TinyStar_Gold.png" />';
            for (s = 0; s < whiteStars; s++)
                result += '<img src="' + imgPath + 'TinyStar_White.png" />';
            for (s = 0; s < greyStars; s++)
                result += '<img src="' + imgPath + 'TinyStar_Grey.png" />'
        }

        result += "</div>"

        return result;
    }

    /**
     * Will take care of rendering progress bars from a regex match.
     * This is to be used a call back for a regex replace. The original logic is inspired
     * by the standard popmundo function createStarCount (yes, this is one more reason to sue me)
     *
     * @static
     * @param {string} match The full regex matched, unused and only present as this is the explected signature
     * @param {number} progressInt The numeric value of the progress bar
     * @param {boolean} bool1 When true, the class of the bar is reverted
     * @param {string} progressStr The string value of the bar progression 
     * @param {string} style Additional styles for the outer dive element
     * @param {boolean} bool2 If true an additional inner div is present
     * @param {string} progressStr2 Only used whe bool2 is true
     * @return {string} The correct HTML to render the progress bar 
     * @memberof Utils
     */
    static createProgressBar(match, progressInt, bool1, progressStr, style, bool2, progressStr2) {

        // We make sure that boolean values are correctly casted
        bool1 = (bool1 === 'true');
        bool2 = (bool2 === 'true');

        let result = "<div";

        if (style && "" != style)
            result += ' class="' + style + '"';

        result += ' title="' + progressStr + '">';

        if (progressInt > 0) {
            result += '<div class="';

            if (bool1) {
                if (progressInt < 31) {
                    result += "full";
                } else if (progressInt < 71) {
                    result += "high";
                } else if (progressInt < 100) {
                    result += "med";
                } else {
                    result += "low";
                }
            } else {
                if (progressInt < 31) {
                    result += "low";
                } else if (progressInt < 71) {
                    result += "med";
                } else if (progressInt < 100) {
                    result += "high";
                } else {
                    result += "full";
                }
            }

            result += '" style="width: ' + progressInt + '%;">';

            if (bool2)
                result += "<div>" + progressStr2 + "</div>";

            result += "</div>";

        }

        result += "</div>";

        return result;
    }

    /**
     * Will take care of rendering plus-minus bar starting from a regex match
     *
     * @static
     * @param {string} match The full regex matched, unused and only present as this is the explected signature
     * @param {number} progressInt The integer value of the plus-minus bar percentage
     * @param {string} progressStr The string representation of the plus-minus bar percentage
     * @param {string} style Additional class details for the outer div element
     * @param {boolean} bool1 If true and additional inner DIV element is created
     * @param {string} progressStr2 Only used whe bool1 is true
     * @return {string} The exepcted HTML to render the plus-minus bar
     * @memberof Utils
     */
    static createPlusMinusBar(match, progressInt, progressStr, style, bool1, progressStr2) {

        // We make sure that boolean values are correctly casted
        bool1 = (bool1 === 'true');
        // We make sure that integers are correctly casted
        progressInt = parseInt(progressInt)

        let result = "<div";

        if (style && "" != style)
            result += ' class="' + style + '"';

        result += ' title="' + progressStr + '">';

        result += '<div class="negholder">';
        if (progressInt < 0) {
            result += '<div class="neg" style="width: ' + -progressInt + '%">';

            if (bool1)
                result += "<div>" + progressStr2 + "</div>";

            result += "</div>";
        }
        result += "</div>";

        result += '<div class="posholder">';
        if (progressInt > 0) {
            result += '<div class="pos" style="width: ' + progressInt + '%">';

            if (bool1)
                result += "<div>" + progressStr2 + "</div>";

            result += "</div>"

        } else if (0 == progressInt) {
            result += '<div class="zero">';

            if (bool1)
                result += "<div>" + progressStr2 + "</div>";

            result += "</div>"
        }

        result += "</div></div>";

        return result;
    }

    /**
     * Get a link path with the correct server number.
     *
     * @static
     * @param {String} urlPath The link path
     * @return {String} The string with the correct url according to the current server 
     * @memberof Utils
     */
    static getServerLink(urlPath) {
        // We make sure to have the leading slash
        if (!urlPath.startsWith('/')) urlPath = '/' + urlPath;

        // We make sure to have the trailing slash
        if (!urlPath.endsWith('/')) urlPath += '/';

        return `https://${window.location.hostname}${urlPath}`
    }

    /**
     * The old ever-green sleep method implemente using promises
     *
     * @static
     * @param {number} delay
     * @memberof Utils
     */
    static async sleep(delay) {
        await new Promise(r => setTimeout(r, delay));
    }

    /**
     * Make an iterator returning elements from the iterable
     * cycle('ABCD') --> A B C D A B C D A B C D ...
     *
     * @static
     * @param {Iterable} iterable Any iterable items that can be looped using the iteration protocol
     * @memberof Utils
     */
    static * cycle(iterable) {
        while (true) {
            for (let element of iterable)
                yield element
        }
    }

    /**
     * Randomly sort the elements of an input array. 
     * Original code frome https://stackoverflow.com/a/2450976/1280443
     *
     * @static
     * @param {Array} inputArray The input array to shuffle
     * @param {boolean} [deepCopy=true] If set to false, the array will be sorted in place, otherwise a deep copy will be crated
     * @return {Array} 
     * @memberof Utils
     */
    static shuffle(inputArray, deepCopy = true) {
        // We copy the original array either shallow or deep
        let result = deepCopy ? JSON.parse(JSON.stringify(inputArray)) : inputArray;

        let currentIndex = result.length, randomIndex;

        // While there remain elements to shuffle.
        while (currentIndex != 0) {

            // Pick a remaining element.
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            [result[currentIndex], result[randomIndex]] = [
                result[randomIndex], result[currentIndex]];
        }

        return result;
    }

    /**
     * Return true if the current character is playing the Great Heist
     *
     * @static
     * @return {Boolean} 
     * @memberof Utils
     */
    static isGreatHeist() {
        let ghImg = new CssSelectorHelper('img[src*="Crime"]').getSingle();
        return ghImg != null;
    }
}

/**
 * This class is a wrapper around the standard fetch method. Popmundo servers are throttling the requests and if you
 * perform too many requests, you get disconnected. Unders some circumstances (e.g. when showing pop-ups), this can
 * lead to unexpected log-outs. To avoid this, this class is able to delay the fetch calls and it also has a built-in
 * cache logic to minimize the impact on the popmundo servers.
 *
 * @class TimedFetch
 */
class TimedFetch {
    #delay = 750;
    #lastCall = Date.now() - this.#delay;
    #cache = {};
    #pending = false;

    /**
     * Singleton constructor. On first call the instance is stored on `window._timedFetchInstance`
     * and returned normally. On every subsequent call the existing instance is returned directly,
     * so all content scripts on the same page share one queue and one cache.
     *
     * The instance is kept on `window` rather than a static field because `utils.js` can be
     * executed more than once per page (e.g. the OfferItem entry in manifest.json re-lists it),
     * which would reset a static field and break the singleton guarantee.
     */
    constructor() {
        if (!window._timedFetchInstance) {
            window._timedFetchInstance = this;
        }
        return window._timedFetchInstance;
    }

    /**
     * @param {number} delay The desired value for the fetch call delay
     */
    set delay(delay) {
        this.#delay = delay;
    }

    /**
     * The getter method for the fetch delay
     *
     * @memberof TimedFetch
     */
    get delay() {
        return this.#delay;
    }

    /**
     * The main logic around the standard fetch method. This method is also centralizing the logic to manage
     * the status checks and it will either resolve with the html content or reject with an error message.
     *
     * Callers are serialised: if a request is already in-flight, subsequent callers wait until it completes
     * before starting their own delay countdown, preventing overlapping network requests.
     *
     * For more details on the parameters, check the offical fetch documentation: https://developer.mozilla.org/en-US/docs/Web/API/fetch
     *
     * @param {string} resource The resource to fetch
     * @param {Object} [options={}] An object containing any custom settings that you want to apply to the request.
     * @param {boolean} [useCache=true] Whether to read from and write to the in-memory cache.
     *   The cache is keyed by HTTP method + URL, so GET and POST to the same resource are
     *   stored independently. Pass false for operations that must always hit the network
     *   (mass actions, form submissions, notification polling, etc.).
     * @return {string} The HTML content of the desired page
     * @memberof TimedFetch
     */
    async fetch(resource, options = {}, useCache = true) {
        const method = (options.method || 'GET').toUpperCase();
        const cacheKey = `${method}:${resource}`;

        // We can use a cached response, let's go for it!
        if (useCache && this.#cache.hasOwnProperty(cacheKey)) {
            return this.#cache[cacheKey];
        }

        // Wait until no other request is in-flight AND the cooldown has elapsed.
        // Sleep for the exact remaining time rather than a fixed 250 ms to minimise busy-polling.
        while (this.#pending || (Date.now() - this.#lastCall) < this.#delay) {
            const remaining = this.#delay - (Date.now() - this.#lastCall);
            await Utils.sleep(this.#pending ? this.#delay : Math.max(remaining, 50));
        }

        this.#pending = true;

        try {
            const response = await fetch(resource, options);
            if (!response.ok || response.status < 200 || response.status >= 300) {
                throw new Error('Bad response status: ' + response.status);
            }
            const html = await response.text();
            if (useCache) {
                this.#cache[cacheKey] = html;
            }
            return html;
        } finally {
            this.#pending = false;
            this.#lastCall = Date.now();
        }

    }
}

/**
 * Use this class to manage score highlighing and percentages on bars
 *
 * @class Scoring
 */
class Scoring {

    // Used by scoring system
    #scoreScale = '0_26'
    #rainbowBgColors = [];
    #textColors = [];
    #scoringOptionsValues = { 'score_highlight': true, 'score_scale': '0_26' };

    // Used by the progress bar logic
    #progressBarOptions = { 'progress_bar_percent': true, 'strip_percent_txt': false };

    /**
     * Get the rainbow color based on the score id. This is lousely based on chromemungo code by Tommi Rautava
     *
     * @param {number} scoreId The value of the score for which we want a color
     * @return {pm_TextColor} A pm_TextColor object that can be used to generate style definitions
     */
    getRainbowColor(scoreId) {
        var bgColor;
        var textColor;

        // Return previously calculated color.
        if (this.#rainbowBgColors[scoreId]) {
            bgColor = this.#rainbowBgColors[scoreId];
            textColor = this.#textColors[bgColor];

            return new pm_TextColor(textColor, bgColor);
        }

        // Calculate background color.
        var maxScore = this.#scoreScale == '0_26' ? 26 : 27;
        var hue = 360 - 330 * (scoreId / maxScore);

        var rgbObj = pm_Color.convertHsvToRgb(hue, 1, 1);
        bgColor = rgbObj.toHex();

        // Calculate foreground color.
        textColor = pm_Color.idealTextColor(rgbObj.R, rgbObj.G, rgbObj.B);

        // Store colors.
        this.#rainbowBgColors[scoreId] = bgColor;
        this.#textColors[bgColor] = textColor;

        return new pm_TextColor(textColor, bgColor);

    }

    /**
     * The main logic to manage the scoring highlight. It will search for scoring nodes and
     * apply the proper formatting on place.
     *
     * @param {*} [domTree=document] The dom tree used to apply the score highliting logic
     * @memberof Scoring
     */
    async applyScoringNumbers(domTree = document) {
        let items = await chrome.storage.sync.get(this.#scoringOptionsValues);
        this.#scoreScale = items.score_scale;

        if (items.score_highlight) {

            // Regex used to get the score value from the a element title
            const TITLE_RE = /(\d{1,2})\/26/gm;

            // CSS Selector to get scores from
            const SCORE_LINK_SELECTOR = 'a[href*="Scoring"]';

            // Let's get the scoring nodes
            let scoreNodes = new CssSelectorHelper(SCORE_LINK_SELECTOR, domTree).getAll();

            for (let i = 0; i < scoreNodes.length; i++) {
                let scoreNode = scoreNodes[i];

                // Using the regex, we get the score value
                var titleMatch = TITLE_RE.exec(scoreNode.getAttribute('title'));
                if (titleMatch) {
                    let scoreInt = parseInt(titleMatch[1]);
                    
                    if (this.#scoreScale == '1_27')
                        scoreInt += 1;

                    let textColor = this.getRainbowColor(scoreInt);

                    // Empty span element to make sure we have some space between the name of the score and the numeric value
                    let spaceElem = domTree.createElement('span');
                    spaceElem.textContent = ' ';

                    // The span with the numbering value
                    let scoreElem = domTree.createElement('span');
                    scoreElem.innerHTML = '&nbsp;' + scoreInt + '&nbsp;';
                    scoreElem.setAttribute('style', textColor.toString());
                    scoreElem.setAttribute('style', scoreElem.getAttribute('style') + ' font-weight: bold;');

                    // We append the created span elements
                    scoreNode.parentNode.insertBefore(scoreElem, scoreNode.nextSibling);
                    scoreNode.parentNode.insertBefore(spaceElem, scoreNode.nextSibling);
                }

                // We make sure the regex is working in the next iteration
                TITLE_RE.lastIndex = 0;
            }
        }

    }

    /**
     * The main logic to write the percentage value on progress bars.
     *
     * @param {*} [domTree=document] The dom tree used to apply the score highliting logic
     * @memberof Scoring
     */
    async applyBarPercentage(domTree = document) {

        let items = await chrome.storage.sync.get(this.#progressBarOptions);

        if (items.progress_bar_percent) {

            // The Selector for the bars mostly used on char and artis pages
            const PROGRESS_BAR_SELECTOR = 'div[class*="rogressBar"]';

            let barNodes = new CssSelectorHelper(PROGRESS_BAR_SELECTOR, domTree).getAll();

            for (let i = 0; i < barNodes.length; i++) {
                let node = barNodes[i];

                let barClass = node.getAttribute('class');
                let percentage = node.getAttribute('title');

                // We only apply the percentage logic to bar with percentage. Some bars (e.g. pregnacy ones, have a different logic based on levels)
                if (!barClass.includes('levelBar')) {

                    // When the bar is at 0% there are no child nodes
                    if (node.childNodes.length > 0) {

                        if (percentage.includes('%') && items.strip_percent_txt) {
                            let percentageArr = percentage.split('%');
                            percentage = percentageArr[0].replaceAll(/[^0-9\-%]/g, "");
                            percentage = String(parseInt(percentage)) + '%';
                        }

                        node.setAttribute('style', 'position: relative;');

                        let spanElement = domTree.createElement('span');
                        spanElement.setAttribute('style', 'position: absolute; left: 0; right: 0; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center; color: black; font-size: 10px;');
                        spanElement.textContent = percentage;

                        node.appendChild(spanElement);
                    }
                } else {
                    // When a level bar is there, to simplify the logic we write the status on the last colored bar of the level bar
                    let highFullDivs = Array.from(node.children).filter(child => child.classList.contains('high') || child.classList.contains('full'));
                    let lastHighFullDiv = highFullDivs.pop();

                    if (lastHighFullDiv) {
                        let innerDiv = new CssSelectorHelper('div', lastHighFullDiv).getSingle();
                        if (innerDiv) {
                            let spanElement = domTree.createElement('span');
                            spanElement.setAttribute('style', 'color: black; font-size: 10px;');
                            spanElement.textContent = percentage;

                            innerDiv.appendChild(spanElement);
                        }
                    }
                }

            }

            const PLUS_NEG_HOLDER_SELECTOR = 'div.plusMinusBar';
            barNodes = new CssSelectorHelper(PLUS_NEG_HOLDER_SELECTOR, domTree).getAll();

            for (let i = 0; i < barNodes.length; i++) {
                let node = barNodes[i];
                let percentage = node.getAttribute('title');

                // When percentage is zero, we do not write the value
                if (percentage.startsWith('0')) continue;

                if (percentage.includes('%') && items.strip_percent_txt) {
                    let percentageArr = percentage.split('%');
                    percentage = percentageArr[0].replaceAll(/[^0-9\-%]/g, "");
                    percentage = String(parseInt(percentage)) + '%';
                }

                // The parent TD element
                let tdElem = node.parentNode;
                tdElem.setAttribute('style', 'position: relative;');

                // The new SPAN element with the bar value
                let spanElement = domTree.createElement('span');
                spanElement.setAttribute('style', 'position: absolute; left: 0; right: 0; top: 0; bottom: 0; display: flex; align-items: center; justify-content: center; color: black; z-index: 1; font-size: 10px;');
                spanElement.textContent = percentage;
                // We append the new SPAN to the TD element
                tdElem.appendChild(spanElement);
            }
        }

    }
}