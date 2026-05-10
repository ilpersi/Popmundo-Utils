const optionDetails = [
    // enhanced links options
    { 'name': 'enhanced_links_font_size', 'default': 16, 'save_cb': saveInteger, 'load_cb': loadInteger },
    // band
    { 'name': 'band_popularity_shortcut', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'band_popularity_shortcut_icon', 'default': '⭐', 'save_cb': saveSelect, 'load_cb': loadSelect },
    { 'name': 'band_upcoming_shows', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'band_upcoming_shows_icon', 'default': '📅', 'save_cb': saveSelect, 'load_cb': loadSelect },
    // character
    { 'name': 'character_send_message', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'character_send_message_icon', 'default': '✉️', 'save_cb': saveSelect, 'load_cb': loadSelect },
    { 'name': 'character_offer_an_item', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'character_offer_an_item_icon', 'default': '📦', 'save_cb': saveSelect, 'load_cb': loadSelect },
    { 'name': 'character_call', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'character_call_icon', 'default': '📱', 'save_cb': saveSelect, 'load_cb': loadSelect },
    // city
    { 'name': 'city_book_regular_flight', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'city_book_regular_flight_icon', 'default': '✈️', 'save_cb': saveSelect, 'load_cb': loadSelect },
    { 'name': 'city_charter_vip_jet', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'city_charter_vip_jet_icon', 'default': '🛩️', 'save_cb': saveSelect, 'load_cb': loadSelect },
    { 'name': 'city_other_vehicles', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'city_other_vehicles_icon', 'default': '🚗', 'save_cb': saveSelect, 'load_cb': loadSelect },
    { 'name': 'city_find_locales', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'city_find_locales_icon', 'default': '🔍', 'save_cb': saveSelect, 'load_cb': loadSelect },
    // locale
    { 'name': 'locale_characters_present', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'locale_characters_present_icon', 'default': '🧑‍🤝‍🧑', 'save_cb': saveSelect, 'load_cb': loadSelect },
    { 'name': 'move_to_shortcut', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'move_to_shortcut_icon', 'default': '🚶', 'save_cb': saveSelect, 'load_cb': loadSelect },
    { 'name': 'locale_show_reconnaissance', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'locale_show_reconnaissance_icon', 'default': '👀', 'save_cb': saveSelect, 'load_cb': loadSelect },
    // crew
    { 'name': 'crew_top_heist_shortcut', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'crew_top_heist_shortcut_icon', 'default': '⭐', 'save_cb': saveSelect, 'load_cb': loadSelect },

    // misc options
    { 'name': 'searchable_selects', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'searchable_tables', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'progress_bar_percent', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'score_highlight', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'redirect_to_login', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'fast_character_switch', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'show_msg_helper', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'strip_percent_txt', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'score_scale', 'default': '0_26', 'save_cb': saveSelect, 'load_cb': loadSelect },
    { 'name': 'collect_autograph', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'collect_autograph_scroll', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'autograph_book_name', 'default': 'Autograph book', 'save_cb': saveSelect, 'load_cb': loadSelect },
    { 'name': 'autograph_log_max_rows', 'default': 0, 'save_cb': saveInteger, 'load_cb': loadInteger },
    { 'name': 'autograph_keep_alive', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'autograph_keep_alive_interval', 'default': 5, 'save_cb': saveInteger, 'load_cb': loadInteger },
    { 'name': 'mass_item_sender', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },

    // pop up options
    { 'name': 'character_popup', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'song_popup', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'recent_progress_popup', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'show_club_popup', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'show_details_popup', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    
    // tour bus helper options
    { 'name': 'tb_enable', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'tb_book_after', 'default': 'previous_event', 'save_cb': saveSelect, 'load_cb': loadSelect },
    { 'name': 'tb_hour_range', 'default': 2, 'save_cb': saveInteger, 'load_cb': loadInteger },

    // call all options
    { 'name': 'call_all_friends_enable', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_all_hide_notifications', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_all_wazzup', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_all_prank', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_all_sms_pic', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_all_sms_txt', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_all_gossip', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'call_exclude_id', 'default': {}, 'save_cb': saveExcludeList, 'load_cb': loadExcludeList },

    // mass interact options
    { 'name': 'mass_interact_enable', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_hide_notifications', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_greet', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_smile', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_wink', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_insult', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_share_opinions', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_gossip', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_have_profound_discussion', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_comfort', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_talk_to', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_tease', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_fraternize', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_offer_advice', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_please_stop_flirting_with_me', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_say_im_sorry', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_compliment', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_hey_sexy_how_you_doin', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_praise', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_tell_naughty_joke', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_say_i_love_you', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_i_dont_want_to_be_friends', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_share_secrets', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_hang_out', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_play_with', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_pat_on_back', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_braid_hair', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_shake_hands', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_rub_elbows', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_hug', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_tickle', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_buy_a_drink', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_stroll_hand_in_hand', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_flex_biceps', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_caress', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_ask_for_a_dance', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_high_five', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_arm_wrestle', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_kiss_cheeks', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_embrace', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_kiss', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_kiss_passionately', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_make_love', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_5_minute_quickie', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_tantric_sex', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_enjoy_kobe_sutra', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_give_massage', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_bless', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_do_funny_magic', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_tell_joke', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_seek_apprenticeship', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_sing_to', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_serenade', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_exclude_id', 'default': {}, 'save_cb': saveExcludeList, 'load_cb': loadExcludeList },
    { 'name': 'mass_interact_max_chars', 'default': 99, 'save_cb': saveInteger, 'load_cb': loadInteger },
    { 'name': 'mass_interact_ignore_acquaintance', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_guide', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_google', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_change_diapers', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_pick_up', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'mass_interact_kiss_on_forehead', 'default': false, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },

    // reminders options
    { 'name': 'reminders_show_timers', 'default': true, 'save_cb': saveCheckBox, 'load_cb': loadCheckBox },
    { 'name': 'user_reminders', 'default': [], 'save_cb': saveReminders, 'load_cb': loadReminders },
    { 'name': 'dismissed_reminders', 'default': [], 'save_cb': saveReminderPassthrough, 'load_cb': loadReminderPassthrough },

    // developer options (only shown in development builds)
    { 'name': 'log_level', 'default': 3, 'save_cb': saveInteger, 'load_cb': loadInteger },
]

/**
 * Persists the per-character exclusion shards for the named feature directly to
 * sync storage. Returns undefined so save_options skips writing optionName as a
 * single key (the legacy shape) — storage is sharded per-char now.
 */
async function saveExcludeList(optionName, defaultValue) {
    const hidden = document.getElementById(optionName);
    if (!hidden) return undefined;
    let parsed;
    try {
        parsed = JSON.parse(hidden.value || '{}');
    } catch (_) {
        return undefined;
    }

    const map = Utils.normalizeExcludeMap(parsed);
    const writeBack = {};
    const removeKeys = [];
    const namesPerBucket = new Array(Utils.EXCLUDE_NAME_BUCKETS).fill(null).map(() => ({}));

    // Snapshot existing shards so we can drop any that aren't represented in the
    // saved map — that's how Remove All (which empties the hidden input) reaches us.
    const all = await chrome.storage.sync.get(null);
    const prefix = `${optionName}_`;
    const existingShardKeys = Object.keys(all).filter(k => k.startsWith(prefix));
    const seenShardKeys = new Set();

    for (const [charKey, list] of Object.entries(map)) {
        const shardKey = `${optionName}_${charKey}`;
        seenShardKeys.add(shardKey);
        if (!Array.isArray(list) || list.length === 0) {
            removeKeys.push(shardKey);
            continue;
        }
        const ids = [];
        for (const entry of list) {
            const id = Utils.excludeEntryId(entry);
            if (id === null) continue;
            ids.push(id);
            if (typeof entry === 'object' && entry !== null && entry.name) {
                const bucket = id % Utils.EXCLUDE_NAME_BUCKETS;
                namesPerBucket[bucket][String(id)] = String(entry.name);
            }
        }
        if (ids.length === 0) removeKeys.push(shardKey);
        else writeBack[shardKey] = ids;
    }

    // Drop any existing shard the saved map didn't account for (Remove All path).
    for (const shardKey of existingShardKeys) {
        if (!seenShardKeys.has(shardKey)) removeKeys.push(shardKey);
    }

    // Merge new names with whatever's already in each bucket. `all` already has
    // every sync key from the snapshot above, so reuse it instead of a second get.
    for (let i = 0; i < Utils.EXCLUDE_NAME_BUCKETS; i++) {
        const bucketKey = `synced_char_names_${i}`;
        const existing = (typeof all[bucketKey] === 'object' && all[bucketKey] !== null && !Array.isArray(all[bucketKey]))
            ? all[bucketKey]
            : {};
        const merged = { ...existing, ...namesPerBucket[i] };
        if (Object.keys(merged).length > Object.keys(existing).length) {
            writeBack[bucketKey] = merged;
        }
    }

    if (Object.keys(writeBack).length > 0) await chrome.storage.sync.set(writeBack);
    if (removeKeys.length > 0) await chrome.storage.sync.remove(removeKeys);

    return undefined; // tells save_options to skip writing optionName itself
}

/**
 * Reads the per-character exclusion shards for the named feature, resolves names
 * via the bucketed sync cache + local DB, and populates the renderer's expected
 * `{charKey: [{id, name}, ...]}` shape into the hidden input.
 */
async function loadExcludeList(optionName, optionValue) {
    await Utils.ensureExcludeListsMigrated();

    // Find every per-char shard for this feature in a single sync.get(null).
    // The options page is not a hot path, so the full read is acceptable.
    const all = await chrome.storage.sync.get(null);
    const prefix = `${optionName}_`;
    const rawMap = {};
    for (const [key, value] of Object.entries(all)) {
        if (!key.startsWith(prefix)) continue;
        if (Array.isArray(value)) rawMap[key.slice(prefix.length)] = value;
    }

    // Resolve names once for all entries.
    const syncedNames = await Utils.loadSyncedCharNames();
    const local = await chrome.storage.local.get({ all_characters_details: { 'id-name': {} } });
    const idNameMap = (local.all_characters_details && local.all_characters_details['id-name']) || {};

    const expanded = {};
    for (const [charKey, list] of Object.entries(rawMap)) {
        expanded[charKey] = list
            .map((entry) => {
                const id = Utils.excludeEntryId(entry);
                if (id === null) return null;
                return { id, name: Utils.resolveCharName(id, syncedNames, idNameMap, null) };
            })
            .filter((e) => e !== null);
    }

    const hidden = document.getElementById(optionName);
    if (hidden) hidden.value = JSON.stringify(expanded);
    initCharSelect(optionName + '_char_select', optionName, expanded);
}

function saveCSVString(optionName, defaultVaule) {
    let result = defaultVaule;

    let txtElem = document.getElementById(optionName);
    if (txtElem != null) {
        let value = txtElem.value;

        // Characters sanitization. We only accept numbers and commas
        value = value.replace(/[^0-9,]/g, '');

        // Initial split
        let splitStr = value.split(',');
        if (splitStr.length > 0) {
            result = [];

            splitStr.forEach(element => {
                // We make sure to save integers in preferences
                if (element.length > 0)
                    result.push(parseInt(element));
            });
        }

        if (Array.isArray(result))
            txtElem.value = result.join(',');
    }

    return result;
}

function loadCSVstring(optionName, optionValue) {
    let txtElem = document.getElementById(optionName);

    if (txtElem != null) {
        txtElem.value = optionValue.join(',');
    }
}

// Polymorphic across two element shapes:
//   - <input type="checkbox">  → reads/writes .checked
//   - <button class="pm-chip">  → reads/writes the .is-on CSS class
// This lets the chip-style toggles introduced in Phase 2 use the same
// optionDetails entries the legacy checkbox toggles always used.
function saveCheckBox(optionName, defaultVaule) {
    let result = defaultVaule;

    let elem = document.getElementById(optionName);
    if (elem != null) {
        if (elem instanceof HTMLInputElement && elem.type === 'checkbox') {
            result = elem.checked;
        } else if (elem.classList.contains('pm-chip')) {
            result = elem.classList.contains('is-on');
        }
    }

    return result;
}

function loadCheckBox(optionName, optionValue) {
    let elem = document.getElementById(optionName);

    if (elem != null) {
        if (elem instanceof HTMLInputElement && elem.type === 'checkbox') {
            elem.checked = optionValue;
        } else if (elem.classList.contains('pm-chip')) {
            elem.classList.toggle('is-on', !!optionValue);
        }
    }
}

function loadInteger(optionName, optionValue) {
    let formElem = document.getElementById(optionName);

    if (formElem != null) {
        formElem.value = parseInt(optionValue);
    }
}

function saveInteger(optionName, defaultVaule) {
    let result = parseInt(defaultVaule);

    let intElem = document.getElementById(optionName);
    if (intElem != null) {
        result = parseInt(intElem.value);
    }

    return result;
}

function saveSelect(optionName, optionValue) {
    let result = String(optionValue);

    let formElem = document.getElementById(optionName);
    if (formElem != null) {
        result = String(formElem.value)
    }

    return result;

}

function loadSelect(optionName, optionValue) {
    let formElem = document.getElementById(optionName);

    if (formElem != null) {
        formElem.value = String(optionValue);
    }

}

function saveReminders(optionName, defaultValue) {
    const hidden = document.getElementById(optionName);
    if (!hidden) return defaultValue;
    try {
        const parsed = JSON.parse(hidden.value || '[]');
        return Array.isArray(parsed) ? parsed : defaultValue;
    } catch (_) {
        return defaultValue;
    }
}

function loadReminders(optionName, optionValue) {
    const reminders = Array.isArray(optionValue) ? optionValue : [];
    const hidden = document.getElementById(optionName);
    if (hidden) hidden.value = JSON.stringify(reminders);
    renderRemindersList(optionName, reminders);
}

// dismissed_reminders is managed by the content script; the options page just
// round-trips the stored value so Save does not wipe it.
function saveReminderPassthrough(optionName, defaultValue) {
    const hidden = document.getElementById(optionName);
    if (!hidden) return defaultValue;
    try {
        const parsed = JSON.parse(hidden.value || '[]');
        return Array.isArray(parsed) ? parsed : defaultValue;
    } catch (_) {
        return defaultValue;
    }
}

function loadReminderPassthrough(optionName, optionValue) {
    const hidden = document.getElementById(optionName);
    if (hidden) hidden.value = JSON.stringify(Array.isArray(optionValue) ? optionValue : []);
}

// Saves options to chrome.storage
async function save_options() {
    let optionsToSave = {};

    for (const option of optionDetails) {
        if (option.hasOwnProperty('save_cb')) {
            // save_cb may be async (e.g. saveExcludeList writes its own sharded keys
            // and returns undefined to opt out of the orchestrator's set call).
            const optionValue = await option.save_cb(option.name, option.default);
            if (optionValue !== undefined) {
                optionsToSave[option.name] = optionValue;
            }
        }
    }

    chrome.storage.sync.set(optionsToSave, function () {
        // Legacy #status span (still required so feature scripts that look it
        // up don't break) — invisible in the new save bar; the toast handles
        // the visible confirmation.
        var status = document.getElementById('status');
        if (status) {
            status.textContent = chrome.i18n.getMessage('optSaved') || 'Options saved.';
            setTimeout(function () { status.textContent = ''; }, 1000);
        }
        document.dispatchEvent(new CustomEvent('pm:options-saved'));
    });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
    let defaultOptions = {};
    let optionsLoadCB = {};
    optionDetails.forEach(option => {
        defaultOptions[option.name] = option.default;

        if (option.load_cb != null)
            optionsLoadCB[option.name] = option.load_cb;
    });

    chrome.storage.sync.get(defaultOptions, items => {
        for (let option in items) {
            // by default options match the ids of form elements
            if (optionsLoadCB.hasOwnProperty(option))
                optionsLoadCB[option](option, items[option]);
        }
        document.dispatchEvent(new CustomEvent('pm:options-restored'));
    });
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
