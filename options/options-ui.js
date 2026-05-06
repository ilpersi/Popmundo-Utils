/**
 * Renders a Bootstrap list-group for the exclusion list of the currently selected character.
 * Called by initCharSelect and by the Remove button click handler.
 *
 * @param {string} storageKey  The chrome.storage.sync key (also the hidden input id).
 * @param {Array}  data        Array of {id, name} objects for the currently selected character.
 */
function renderExcludeList(storageKey, data) {
    const container = document.getElementById(storageKey + '_list');
    if (!container) return;

    container.innerHTML = '';

    if (!data || data.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'text-muted small mb-0';
        empty.textContent = chrome.i18n.getMessage('optExcludeListEmpty') || 'No characters excluded.';
        container.appendChild(empty);
        return;
    }

    const row = document.createElement('div');
    row.className = 'row row-cols-3 g-1';

    const sorted = data.slice().sort((a, b) => a.name.localeCompare(b.name));

    sorted.forEach((entry) => {
        const col = document.createElement('div');
        col.className = 'col';

        const cell = document.createElement('div');
        cell.className = 'd-flex justify-content-between align-items-center border-bottom py-1';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'small text-truncate me-1';
        nameSpan.title = `${entry.name} \u2014 #${entry.id}`;
        nameSpan.textContent = `${entry.name} \u2014 #${entry.id}`;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-sm btn-outline-danger py-0 px-2 flex-shrink-0';
        removeBtn.textContent = chrome.i18n.getMessage('optExcludeListRemove') || 'Remove';
        removeBtn.addEventListener('click', () => {
            const hidden = document.getElementById(storageKey);
            let map = {};
            try { map = JSON.parse(hidden.value || '{}'); } catch (_) {}
            const select = document.getElementById(storageKey + '_char_select');
            const charId = select ? select.value : null;
            if (!charId) return;
            const currentList = Array.isArray(map[charId]) ? map[charId] : [];
            const updated = currentList.filter(e => e.id !== entry.id);
            map[charId] = updated;
            hidden.value = JSON.stringify(map);
            renderExcludeList(storageKey, updated);
            markDirty();
        });

        cell.appendChild(nameSpan);
        cell.appendChild(removeBtn);
        col.appendChild(cell);
        row.appendChild(col);
    });

    container.appendChild(row);
}

/**
 * Shows a "select a character" placeholder in the exclusion list container.
 *
 * @param {string} storageKey  The chrome.storage.sync key (also the hidden input id).
 */
function renderExcludeListNoChar(storageKey) {
    const container = document.getElementById(storageKey + '_list');
    if (!container) return;
    container.innerHTML = '';
    const msg = document.createElement('p');
    msg.className = 'text-muted small mb-0';
    msg.textContent = chrome.i18n.getMessage('optNoCharacterSelected') || 'Select a character above to view or manage exclusions.';
    container.appendChild(msg);
}

/**
 * Populates the character selector combo box from session storage and the exclusion map,
 * then renders the exclusion list for the currently active character.
 * Called from loadExcludeList (options.js) inside the chrome.storage.sync callback.
 *
 * @param {string} selectId    ID of the <select> element.
 * @param {string} storageKey  The chrome.storage.sync key (also the hidden input id).
 * @param {Object} map         The full per-character exclusion map { "charId": [{id, name}] }.
 */
async function initCharSelect(selectId, storageKey, map) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Get current character from session storage
    const sessionData = await chrome.storage.session.get(['current_char_details']);
    const currentChar = sessionData.current_char_details;

    // all_characters_details lives in local (not sync) storage to avoid the 8192 byte per-item
    // quota limit imposed by chrome.storage.sync.
    const localData = await chrome.storage.local.get({ all_characters_details: { 'id-name': {} } });
    const idNameMap = (localData.all_characters_details && localData.all_characters_details['id-name'])
        ? localData.all_characters_details['id-name']
        : {};

    // Build char map: id (string) -> name
    // Start with the full DB, then fall back to #id for any exclusion-map char not yet in the DB
    const charMap = {};
    Object.entries(idNameMap).forEach(([id, name]) => {
        charMap[id] = name;
    });
    Object.keys(map).forEach(id => {
        if (!charMap[id]) charMap[id] = `#${id}`;
    });
    // If the DB is empty (single-character player who hasn't visited ChooseCharacter yet),
    // fall back to the current character from session storage
    if (Object.keys(charMap).length === 0 && currentChar && currentChar.id && currentChar.id != 0) {
        charMap[String(currentChar.id)] = currentChar.name || `#${currentChar.id}`;
    }

    // Preserve previously selected value (if any)
    const previousValue = select.value;

    // Repopulate the select options
    const placeholderText = chrome.i18n.getMessage('optSelectCharPlaceholder') || '-- Select a character --';
    select.innerHTML = `<option value="">${placeholderText}</option>`;
    Object.entries(charMap)
        .sort((a, b) => a[1].localeCompare(b[1]))
        .forEach(([id, name]) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = name;
            select.appendChild(opt);
        });

    // Determine which char to select
    let selectedId = '';
    if (previousValue && charMap[previousValue]) {
        selectedId = previousValue;
    } else if (currentChar && currentChar.id && currentChar.id != 0 && charMap[String(currentChar.id)]) {
        selectedId = String(currentChar.id);
    } else if (Object.keys(charMap).length === 1) {
        selectedId = Object.keys(charMap)[0];
    }

    select.value = selectedId;

    // Render for the selected char
    if (selectedId) {
        renderExcludeList(storageKey, Array.isArray(map[selectedId]) ? map[selectedId] : []);
    } else {
        renderExcludeListNoChar(storageKey);
    }

    // Register change handler (only once — remove old listener by cloning)
    const freshSelect = select.cloneNode(true);
    select.parentNode.replaceChild(freshSelect, select);
    freshSelect.value = selectedId;
    freshSelect.addEventListener('change', () => {
        const charId = freshSelect.value;
        const hidden = document.getElementById(storageKey);
        let currentMap = {};
        try { currentMap = JSON.parse(hidden.value || '{}'); } catch (_) {}
        if (charId) {
            renderExcludeList(storageKey, Array.isArray(currentMap[charId]) ? currentMap[charId] : []);
        } else {
            renderExcludeListNoChar(storageKey);
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Save UX — dirty-state tracking, sticky savebar visibility, success toast
// ─────────────────────────────────────────────────────────────────────────────

let isDirty = false;

function markDirty() {
    if (isDirty) return;
    isDirty = true;
    document.getElementById('savebar')?.classList.add('is-visible');
}

function clearDirty() {
    isDirty = false;
    document.getElementById('savebar')?.classList.remove('is-visible');
}

function showSavedToast() {
    const toast = document.getElementById('saved-toast');
    if (!toast) return;
    toast.classList.add('is-visible');
    clearTimeout(showSavedToast._timer);
    showSavedToast._timer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme — `pm_theme` is persisted in chrome.storage.sync independently of the
// Save button so toggling takes effect immediately.
// ─────────────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
    const next = (theme === 'dark') ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;

    const btn = document.getElementById('theme-toggle');
    if (btn) {
        const titleKey = next === 'dark' ? 'optThemeToggleDark' : 'optThemeToggleLight';
        const title = chrome.i18n.getMessage(titleKey);
        if (title) btn.title = title;
    }
}

function initTheme() {
    chrome.storage.sync.get({ pm_theme: 'light' }, ({ pm_theme }) => {
        applyTheme(pm_theme);
    });
}

function toggleTheme() {
    const current = document.documentElement.dataset.theme || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    chrome.storage.sync.set({ pm_theme: next });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar per-tab counters. Counts both checkbox toggles and chip toggles.
// Elements marked [data-no-count] are excluded (e.g. settings checkboxes
// that aren't part of the tab's "X enabled" semantic — like Mass Interact's
// `ignore_acquaintance`, which is a behaviour flag, not an interaction).
// Tabs whose total is zero get an empty badge hidden by the CSS :empty rule.
// ─────────────────────────────────────────────────────────────────────────────

function recomputeTabCounts() {
    document.querySelectorAll('.tab-content-section').forEach(section => {
        const cbTotal = section.querySelectorAll('.form-check-input[type="checkbox"]:not([data-no-count])').length;
        const cbChecked = section.querySelectorAll('.form-check-input[type="checkbox"]:checked:not([data-no-count])').length;
        const chipTotal = section.querySelectorAll('.pm-chip[data-chip-id]').length;
        const chipOn = section.querySelectorAll('.pm-chip[data-chip-id].is-on').length;

        const total = cbTotal + chipTotal;
        const checked = cbChecked + chipOn;

        const badge = document.querySelector(`[data-tab-count="${section.id}"]`);
        if (!badge) return;
        if (total === 0) {
            badge.textContent = '';
            badge.classList.remove('is-zero');
            return;
        }
        badge.textContent = `${checked}/${total}`;
        badge.classList.toggle('is-zero', checked === 0);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mass Interact chips (Phase 2)
//
// 52 in-game interactions rendered as toggleable chips, organized into four
// thematic groups. Chip ids mirror the existing optionDetails keys
// (`mass_interact_*`) so saveCheckBox / loadCheckBox in options.js drive
// chip state and legacy form-switch toggles uniformly. Numeric `value` is
// the in-game interaction ID — sourced from features/mass-interact.js's
// optionsMap, which is the canonical mapping consumed at runtime.
// ─────────────────────────────────────────────────────────────────────────────

const MASS_INTERACT_GROUPS = [
    {
        key: 'verbal',
        titleKey: 'optMiGroupVerbal',
        titleFallback: 'Verbal & Social',
        chips: [
            { name: 'mass_interact_greet',                     value: 1,   i18n: 'optMiGreet',               fallback: 'Greet' },
            { name: 'mass_interact_talk_to',                   value: 3,   i18n: 'optMiTalkTo',              fallback: 'Talk to' },
            { name: 'mass_interact_tell_joke',                 value: 4,   i18n: 'optMiTellJoke',            fallback: 'Tell Joke' },
            { name: 'mass_interact_tease',                     value: 5,   i18n: 'optMiTease',               fallback: 'Tease' },
            { name: 'mass_interact_compliment',                value: 14,  i18n: 'optMiCompliment',          fallback: 'Compliment' },
            { name: 'mass_interact_insult',                    value: 15,  i18n: 'optMiInsult',              fallback: 'Insult' },
            { name: 'mass_interact_have_profound_discussion',  value: 34,  i18n: 'optMiProfoundDiscussion',  fallback: 'Profound Discussion' },
            { name: 'mass_interact_comfort',                   value: 51,  i18n: 'optMiComfort',             fallback: 'Comfort' },
            { name: 'mass_interact_smile',                     value: 54,  i18n: 'optMiSmile',               fallback: 'Smile' },
            { name: 'mass_interact_fraternize',                value: 57,  i18n: 'optMiFraternize',          fallback: 'Fraternize' },
            { name: 'mass_interact_share_opinions',            value: 62,  i18n: 'optMiShareOpinions',       fallback: 'Share Opinions' },
            { name: 'mass_interact_gossip',                    value: 65,  i18n: 'optMiGossip',              fallback: 'Gossip' },
            { name: 'mass_interact_offer_advice',              value: 68,  i18n: 'optMiOfferAdvice',         fallback: 'Offer Advice' },
            { name: 'mass_interact_share_secrets',             value: 69,  i18n: 'optMiShareSecrets',        fallback: 'Share Secrets' },
            { name: 'mass_interact_hang_out',                  value: 70,  i18n: 'optMiHangOut',             fallback: 'Hang Out' },
            { name: 'mass_interact_hey_sexy_how_you_doin',     value: 71,  i18n: 'optMiHexySexy',            fallback: 'Hey Sexy...' },
            { name: 'mass_interact_praise',                    value: 75,  i18n: 'optMiPraise',              fallback: 'Praise' },
            { name: 'mass_interact_tell_naughty_joke',         value: 76,  i18n: 'optMiTellNaughtyJoke',     fallback: 'Tell Naughty Joke' },
            { name: 'mass_interact_wink',                      value: 161, i18n: 'optMiWink',                fallback: 'Wink' }
        ]
    },
    {
        key: 'physical',
        titleKey: 'optMiGroupPhysical',
        titleFallback: 'Physical',
        chips: [
            { name: 'mass_interact_buy_a_drink',          value: 7,   i18n: 'optMiBuyADrink',         fallback: 'Buy a Drink' },
            { name: 'mass_interact_hug',                  value: 8,   i18n: 'optMiHug',               fallback: 'Hug' },
            { name: 'mass_interact_tickle',               value: 12,  i18n: 'optMiTickle',            fallback: 'Tickle' },
            { name: 'mass_interact_play_with',            value: 18,  i18n: 'optMiPlayWith',          fallback: 'Play With' },
            { name: 'mass_interact_caress',               value: 30,  i18n: 'optMiCaress',            fallback: 'Caress' },
            { name: 'mass_interact_ask_for_a_dance',      value: 35,  i18n: 'optMiAskForADance',      fallback: 'Ask for a Dance' },
            { name: 'mass_interact_give_massage',         value: 44,  i18n: 'optMiGiveMassage',       fallback: 'Give Massage' },
            { name: 'mass_interact_shake_hands',          value: 55,  i18n: 'optMiShakeHands',        fallback: 'Shake Hands' },
            { name: 'mass_interact_kiss_cheeks',          value: 56,  i18n: 'optMiKissCheeks',        fallback: 'Kiss Cheeks' },
            { name: 'mass_interact_rub_elbows',           value: 59,  i18n: 'optMiRubElbows',         fallback: 'Rub Elbows' },
            { name: 'mass_interact_high_five',            value: 60,  i18n: 'optMiHighFive',          fallback: 'High Five' },
            { name: 'mass_interact_pat_on_back',          value: 63,  i18n: 'optMiPatOnBack',         fallback: 'Pat on Back' },
            { name: 'mass_interact_embrace',              value: 64,  i18n: 'optMiEmbrace',           fallback: 'Embrace' },
            { name: 'mass_interact_braid_hair',           value: 66,  i18n: 'optMiBraidHair',         fallback: 'Braid Hair' },
            { name: 'mass_interact_arm_wrestle',          value: 67,  i18n: 'optMiArmWrestle',        fallback: 'Arm Wrestle' },
            { name: 'mass_interact_flex_biceps',          value: 89,  i18n: 'optMiFlexBiceps',        fallback: 'Flex Biceps' },
            { name: 'mass_interact_pick_up',              value: 93,  i18n: 'optMiPickUp',            fallback: 'Pick Up' },
            { name: 'mass_interact_change_diapers',       value: 95,  i18n: 'optMiChangeDiapers',     fallback: 'Change Diapers' },
            { name: 'mass_interact_kiss_on_forehead',     value: 103, i18n: 'optMiKissOnForehead',    fallback: 'Kiss on Forehead' },
            { name: 'mass_interact_stroll_hand_in_hand',  value: 129, i18n: 'optMiStrollHandInHand',  fallback: 'Stroll Hand in Hand' }
        ]
    },
    {
        key: 'romantic',
        titleKey: 'optMiGroupRomantic',
        titleFallback: 'Romantic',
        chips: [
            { name: 'mass_interact_kiss',               value: 9,   i18n: 'optMiKiss',              fallback: 'Kiss' },
            { name: 'mass_interact_kiss_passionately',  value: 10,  i18n: 'optMiKissPassionately',  fallback: 'Kiss Passionately' },
            { name: 'mass_interact_make_love',          value: 11,  i18n: 'optMiMakeLove',          fallback: 'Make Love' },
            { name: 'mass_interact_5_minute_quickie',   value: 13,  i18n: 'optMiFiveMinuteQuickie', fallback: '5 Minute Quickie' },
            { name: 'mass_interact_tantric_sex',        value: 19,  i18n: 'optMiTantricSex',        fallback: 'Tantric Sex' },
            { name: 'mass_interact_enjoy_kobe_sutra',   value: 164, i18n: 'optMiEnjoyKobeSutra',    fallback: 'Enjoy Kobe Sutra' }
        ]
    },
    {
        key: 'special',
        titleKey: 'optMiGroupSpecial',
        titleFallback: 'Special',
        chips: [
            { name: 'mass_interact_google',                value: 6,  i18n: 'optMiGoogleGoogle',        fallback: 'Google-Google' },
            { name: 'mass_interact_sing_to',               value: 21, i18n: 'optMiSingTo',              fallback: 'Sing To' },
            { name: 'mass_interact_seek_apprenticeship',   value: 29, i18n: 'optMiSeekApprenticeship',  fallback: 'Seek Apprenticeship' },
            { name: 'mass_interact_do_funny_magic',        value: 33, i18n: 'optMiDoFunnyMagic',        fallback: 'Do Funny Magic' },
            { name: 'mass_interact_bless',                 value: 39, i18n: 'optMiBless',               fallback: 'Bless' },
            { name: 'mass_interact_serenade',              value: 78, i18n: 'optMiSerenade',            fallback: 'Serenade' },
            { name: 'mass_interact_guide',                 value: 94, i18n: 'optMiGuide',               fallback: 'Guide' }
        ]
    }
];

function renderMassInteractChips() {
    const container = document.getElementById('mass-interact-chip-groups');
    if (!container) return;
    container.innerHTML = '';

    const allLabel  = chrome.i18n.getMessage('optMiSelectAll')  || 'All';
    const noneLabel = chrome.i18n.getMessage('optMiSelectNone') || 'None';

    MASS_INTERACT_GROUPS.forEach(group => {
        const section = document.createElement('div');
        section.className = 'pm-chip-section';
        section.dataset.groupKey = group.key;

        // Header row: "GROUP TITLE  X / Y  ─── [All] [None]"
        const head = document.createElement('div');
        head.className = 'pm-chip-section__head';

        const labelDiv = document.createElement('div');
        labelDiv.className = 'pm-chip-section__label';

        const title = document.createElement('span');
        title.className = 'pm-chip-section__title';
        title.textContent = chrome.i18n.getMessage(group.titleKey) || group.titleFallback;
        labelDiv.appendChild(title);

        const count = document.createElement('span');
        count.className = 'pm-chip-section__count';
        count.dataset.groupCount = group.key;
        labelDiv.appendChild(count);

        const rule = document.createElement('div');
        rule.className = 'pm-chip-section__rule';

        const actions = document.createElement('div');
        actions.className = 'pm-chip-section__actions';
        ['all', 'none'].forEach(action => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'pm-chip-section__action';
            btn.dataset.action = action;
            btn.dataset.group = group.key;
            btn.textContent = action === 'all' ? allLabel : noneLabel;
            actions.appendChild(btn);
        });

        head.appendChild(labelDiv);
        head.appendChild(rule);
        head.appendChild(actions);

        // Chip grid
        const grid = document.createElement('div');
        grid.className = 'pm-chip-section__grid';
        grid.dataset.groupGrid = group.key;

        group.chips.forEach(chip => {
            const button = document.createElement('button');
            button.type = 'button';
            button.id = chip.name;
            button.className = 'pm-chip';
            button.dataset.chipId = chip.name;
            button.dataset.groupKey = group.key;
            const labelText = chrome.i18n.getMessage(chip.i18n) || chip.fallback;
            button.dataset.search = labelText.toLowerCase();

            const dot = document.createElement('span');
            dot.className = 'pm-chip__dot';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'pm-chip__name';
            nameSpan.textContent = labelText;
            const idSpan = document.createElement('span');
            idSpan.className = 'pm-chip__id';
            idSpan.textContent = '#' + chip.value;

            button.appendChild(dot);
            button.appendChild(nameSpan);
            button.appendChild(idSpan);
            grid.appendChild(button);
        });

        section.appendChild(head);
        section.appendChild(grid);
        container.appendChild(section);
    });

    updateMassInteractGroupCounts();
}

function updateMassInteractGroupCounts() {
    MASS_INTERACT_GROUPS.forEach(group => {
        const countEl = document.querySelector(`[data-group-count="${group.key}"]`);
        const grid = document.querySelector(`[data-group-grid="${group.key}"]`);
        if (!countEl || !grid) return;
        const total = grid.querySelectorAll('.pm-chip').length;
        const on = grid.querySelectorAll('.pm-chip.is-on').length;
        countEl.textContent = `${on} / ${total}`;
    });
}

function setupMassInteractKbdHint() {
    const kbd = document.getElementById('mass-interact-search-kbd');
    if (!kbd) return;
    // Prefer the modern userAgentData API (Chrome/Edge); fall back to the
    // deprecated navigator.platform (Firefox still relies on it). Both work
    // inside the extension page since chrome-extension:// is a secure context.
    const uaPlatform = navigator.userAgentData?.platform;
    const platform = uaPlatform || navigator.platform || '';
    const isMac = /mac|iphone|ipad|ipod/i.test(platform);
    kbd.textContent = isMac ? '⌘K' : 'Ctrl+K';
}

function applyMassInteractSearch(query) {
    const container = document.getElementById('mass-interact-chip-groups');
    const empty = document.getElementById('mass-interact-empty');
    if (!container) return;

    const q = (query || '').trim().toLowerCase();
    let visibleCount = 0;

    container.querySelectorAll('.pm-chip').forEach(chip => {
        const matches = !q || chip.dataset.search.includes(q);
        chip.classList.toggle('pm-chip--hidden', !matches);
        if (matches) visibleCount++;
    });

    container.querySelectorAll('.pm-chip-section').forEach(section => {
        const anyVisible = section.querySelector('.pm-chip:not(.pm-chip--hidden)');
        section.style.display = anyVisible ? '' : 'none';
    });

    empty?.classList.toggle('d-none', visibleCount > 0);
}

// "All / None" buttons act on chips currently visible in the group, so a
// search-then-bulk-select ("kiss" → All) only enables the matching subset.
function applyChipGroupAction(groupKey, action) {
    const grid = document.querySelector(`[data-group-grid="${groupKey}"]`);
    if (!grid) return;
    const chips = grid.querySelectorAll('.pm-chip:not(.pm-chip--hidden)');
    if (chips.length === 0) return;

    const target = action === 'all';
    let anyChanged = false;
    chips.forEach(chip => {
        if (chip.classList.contains('is-on') !== target) {
            chip.classList.toggle('is-on', target);
            anyChanged = true;
        }
    });

    if (anyChanged) {
        // Single synthetic change event triggers markDirty + recomputeTabCounts.
        grid.dispatchEvent(new Event('change', { bubbles: true }));
        updateMassInteractGroupCounts();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Enhanced Links chip rows (Phase 3)
//
// Each link is a chip-shaped toggle paired with an inline icon-character
// input. Chip ids and icon-input ids both map to existing optionDetails
// keys, so saveCheckBox / loadCheckBox (chip toggle) and saveSelect /
// loadSelect (icon character) drive everything without any change to the
// save/restore plumbing.
// ─────────────────────────────────────────────────────────────────────────────

const ENHANCED_LINKS_GROUPS = [
    {
        key: 'band',
        titleKey: 'optElGroupBand',
        titleFallback: 'Band',
        chips: [
            { name: 'band_popularity_shortcut',   iconName: 'band_popularity_shortcut_icon',   i18n: 'optElPopularity',     fallback: 'Popularity link' },
            { name: 'band_upcoming_shows',        iconName: 'band_upcoming_shows_icon',        i18n: 'optElUpcomingShows',  fallback: 'Upcoming Shows link' }
        ]
    },
    {
        key: 'character',
        titleKey: 'optElGroupCharacter',
        titleFallback: 'Character',
        chips: [
            { name: 'character_send_message',     iconName: 'character_send_message_icon',     i18n: 'optElSendMessage',    fallback: 'Send Message link' },
            { name: 'character_call',             iconName: 'character_call_icon',             i18n: 'optElCall',           fallback: 'Call link' },
            { name: 'character_offer_an_item',    iconName: 'character_offer_an_item_icon',    i18n: 'optElOfferItem',      fallback: 'Offer an Item link' }
        ]
    },
    {
        key: 'city',
        titleKey: 'optElGroupCity',
        titleFallback: 'City',
        chips: [
            { name: 'city_book_regular_flight',   iconName: 'city_book_regular_flight_icon',   i18n: 'optElBookFlight',     fallback: 'Book Regular Flight link' },
            { name: 'city_charter_vip_jet',       iconName: 'city_charter_vip_jet_icon',       i18n: 'optElCharterJet',     fallback: 'Charter VIP Jet link' },
            { name: 'city_other_vehicles',        iconName: 'city_other_vehicles_icon',        i18n: 'optElOtherVehicles',  fallback: 'Other Vehicles link' },
            { name: 'city_find_locales',          iconName: 'city_find_locales_icon',          i18n: 'optElFindLocales',    fallback: 'Find Locales link' }
        ]
    },
    {
        key: 'locale',
        titleKey: 'optElGroupLocale',
        titleFallback: 'Locale',
        chips: [
            { name: 'locale_characters_present',  iconName: 'locale_characters_present_icon',  i18n: 'optElCharactersPresent', fallback: 'Characters Present link' },
            { name: 'move_to_shortcut',           iconName: 'move_to_shortcut_icon',           i18n: 'optElMoveToLocale',      fallback: 'Move to Locale link' },
            { name: 'locale_show_reconnaissance', iconName: 'locale_show_reconnaissance_icon', i18n: 'optElReconnaissance',    fallback: 'Reconnaissance link' }
        ]
    },
    {
        key: 'crew',
        titleKey: 'optElGroupCrew',
        titleFallback: 'Crew',
        chips: [
            { name: 'crew_top_heist_shortcut',    iconName: 'crew_top_heist_shortcut_icon',    i18n: 'optElTopHeists',      fallback: 'Top Heists link' }
        ]
    }
];

function renderEnhancedLinksChips() {
    const container = document.getElementById('enhanced-links-chip-groups');
    if (!container) return;
    container.innerHTML = '';

    const iconTitle = chrome.i18n.getMessage('optElIconTitle') || 'Custom icon character';

    ENHANCED_LINKS_GROUPS.forEach(group => {
        const section = document.createElement('div');
        section.className = 'pm-chip-section';
        section.dataset.groupKey = group.key;

        // Header (no per-group count or All/None — groups are too small to need them)
        const head = document.createElement('div');
        head.className = 'pm-chip-section__head';

        const labelDiv = document.createElement('div');
        labelDiv.className = 'pm-chip-section__label';

        const title = document.createElement('span');
        title.className = 'pm-chip-section__title';
        title.textContent = chrome.i18n.getMessage(group.titleKey) || group.titleFallback;
        labelDiv.appendChild(title);

        const rule = document.createElement('div');
        rule.className = 'pm-chip-section__rule';

        head.appendChild(labelDiv);
        head.appendChild(rule);
        section.appendChild(head);

        // Grid of chip-rows
        const grid = document.createElement('div');
        grid.className = 'pm-link-chip-grid';

        group.chips.forEach(chip => {
            const row = document.createElement('div');
            row.className = 'pm-link-chip-row';

            const button = document.createElement('button');
            button.type = 'button';
            button.id = chip.name;
            button.className = 'pm-chip';
            button.dataset.chipId = chip.name;
            const labelText = chrome.i18n.getMessage(chip.i18n) || chip.fallback;

            const dot = document.createElement('span');
            dot.className = 'pm-chip__dot';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'pm-chip__name';
            nameSpan.textContent = labelText;
            // Title attribute as fallback for ellipsized text
            button.title = labelText;

            button.appendChild(dot);
            button.appendChild(nameSpan);

            const iconInput = document.createElement('input');
            iconInput.type = 'text';
            iconInput.id = chip.iconName;
            iconInput.className = 'pm-link-icon-input';
            iconInput.maxLength = 10;
            iconInput.title = iconTitle;
            iconInput.setAttribute('aria-label', `${labelText} icon`);

            row.appendChild(button);
            row.appendChild(iconInput);
            grid.appendChild(row);
        });

        section.appendChild(grid);
        container.appendChild(section);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reminders UI
// ─────────────────────────────────────────────────────────────────────────────

/** ID of the reminder currently open in the modal (null when adding). */
let currentEditingReminderId = null;

/**
 * Render the reminder list cards inside #user_reminders_list.
 * Called by loadReminders in options.js after storage is read.
 *
 * @param {string} storageKey  The hidden input id (always 'user_reminders')
 * @param {Array}  reminders   Array of reminder objects
 */
function renderRemindersList(storageKey, reminders) {
    const container = document.getElementById(storageKey + '_list');
    if (!container) return;

    container.innerHTML = '';

    if (!reminders || reminders.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'text-muted small mb-0';
        empty.textContent = chrome.i18n.getMessage('optRemNoReminders') || "No reminders yet. Click 'Add Reminder' to create one.";
        container.appendChild(empty);
        return;
    }

    const row = document.createElement('div');
    row.className = 'row g-2';

    reminders.forEach(reminder => {
        const col = document.createElement('div');
        col.className = 'col-md-4';
        col.appendChild(buildReminderCard(reminder));
        row.appendChild(col);
    });

    container.appendChild(row);
}

/**
 * Build a single reminder card element.
 *
 * @param {Object} reminder
 * @return {HTMLElement}
 */
function buildReminderCard(reminder) {
    const wrapper = document.createElement('div');
    wrapper.className = 'border rounded p-2 h-100' + (reminder.active ? '' : ' opacity-50 bg-light');
    wrapper.dataset.reminderId = reminder.id;

    // ── Header row: badges + action buttons ──────────────────────────────────
    const header = document.createElement('div');
    header.className = 'd-flex justify-content-between align-items-start mb-1';

    const badges = document.createElement('div');
    badges.className = 'd-flex gap-1 flex-wrap';

    if (!reminder.active) {
        const b = document.createElement('span');
        b.className = 'badge bg-secondary';
        b.textContent = chrome.i18n.getMessage('optRemInactive') || 'Inactive';
        badges.appendChild(b);
    }

    // Type badge
    const typeBadge = document.createElement('span');
    typeBadge.className = 'badge bg-info text-dark';
    if (reminder.type === 'yearday') {
        typeBadge.textContent = (chrome.i18n.getMessage('optRemYeardayBadge') || 'Year Day') + ' ' + reminder.dayValue;
    } else {
        typeBadge.textContent = chrome.i18n.getMessage('optRemWeekday' + reminder.dayValue) || reminder.dayValue;
    }
    badges.appendChild(typeBadge);

    // Game badges
    if (reminder.forPopmundo) {
        const b = document.createElement('span');
        b.className = 'badge bg-primary';
        b.textContent = chrome.i18n.getMessage('optRemForPopmundo') || 'Popmundo';
        badges.appendChild(b);
    }
    if (reminder.forGreatHeist) {
        const b = document.createElement('span');
        b.className = 'badge bg-success';
        b.textContent = chrome.i18n.getMessage('optRemForGreatHeist') || 'The Great Heist';
        badges.appendChild(b);
    }

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'd-flex gap-1 flex-shrink-0 ms-2';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-sm btn-outline-primary py-0 px-2';
    editBtn.textContent = chrome.i18n.getMessage('optRemEditButton') || 'Edit';
    editBtn.addEventListener('click', () => openReminderModal(reminder));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-sm btn-outline-danger py-0 px-2';
    deleteBtn.textContent = chrome.i18n.getMessage('optRemDeleteButton') || 'Delete';
    deleteBtn.addEventListener('click', () => deleteReminder(reminder.id));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    header.appendChild(badges);
    header.appendChild(actions);
    wrapper.appendChild(header);

    // ── Optional description ──────────────────────────────────────────────────
    if (reminder.description) {
        const desc = document.createElement('div');
        desc.className = 'small text-muted mb-1';
        desc.textContent = reminder.description;
        wrapper.appendChild(desc);
    }

    // ── Text preview ──────────────────────────────────────────────────────────
    const textPreview = document.createElement('div');
    textPreview.className = 'small text-truncate font-monospace';
    textPreview.title = reminder.text;
    textPreview.textContent = reminder.text;
    wrapper.appendChild(textPreview);

    return wrapper;
}

/**
 * Open the add/edit modal, pre-populated with the given reminder (or blank for add).
 *
 * @param {Object|null} reminder  Existing reminder to edit, or null to add new.
 */
function openReminderModal(reminder = null) {
    currentEditingReminderId = reminder ? reminder.id : null;

    const isEdit = reminder !== null;
    const modalTitleEl = document.getElementById('reminderModalTitle');
    if (modalTitleEl) {
        modalTitleEl.textContent = chrome.i18n.getMessage(
            isEdit ? 'optRemEditModalTitle' : 'optRemAddModalTitle'
        ) || (isEdit ? 'Edit Reminder' : 'Add Reminder');
    }

    // Trigger type
    const typeYearday = document.getElementById('type_yearday');
    const typeWeekday = document.getElementById('type_weekday');
    if (typeYearday) typeYearday.checked = !isEdit || reminder.type === 'yearday';
    if (typeWeekday) typeWeekday.checked = isEdit && reminder.type === 'weekday';

    // Day value
    const yeardayInput = document.getElementById('reminder_yearday');
    if (yeardayInput) yeardayInput.value = (isEdit && reminder.type === 'yearday') ? reminder.dayValue : '';

    const weekdaySelect = document.getElementById('reminder_weekday');
    if (weekdaySelect) weekdaySelect.value = (isEdit && reminder.type === 'weekday') ? String(reminder.dayValue) : '1';

    // Game flags (both on by default for new reminders)
    const pmCb = document.getElementById('reminder_for_popmundo');
    if (pmCb) pmCb.checked = !isEdit || reminder.forPopmundo;
    const ghCb = document.getElementById('reminder_for_great_heist');
    if (ghCb) ghCb.checked = !isEdit || reminder.forGreatHeist;

    // Active
    const activeCb = document.getElementById('reminder_active');
    if (activeCb) activeCb.checked = !isEdit || reminder.active;

    // Text / description
    const textArea = document.getElementById('reminder_text');
    if (textArea) textArea.value = isEdit ? reminder.text : '';
    const descArea = document.getElementById('reminder_description');
    if (descArea) descArea.value = (isEdit && reminder.description) ? reminder.description : '';

    // Confirm button label: "Add" for new, "Update" for edit
    const confirmBtn = document.getElementById('save-reminder-btn');
    if (confirmBtn) {
        confirmBtn.textContent = chrome.i18n.getMessage(
            isEdit ? 'optRemUpdateButton' : 'optRemSaveButton'
        ) || (isEdit ? 'Update' : 'Add');
    }

    // Clear validation
    const validationEl = document.getElementById('reminder_validation');
    if (validationEl) validationEl.classList.add('d-none');

    updateTypeInputVisibility();

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('reminderModal'));
    modal.show();
}

/** Toggle yearday/weekday input groups based on selected radio. */
function updateTypeInputVisibility() {
    const isYearday = document.getElementById('type_yearday')?.checked ?? true;
    document.getElementById('yearday_input_group')?.classList.toggle('d-none', !isYearday);
    document.getElementById('weekday_input_group')?.classList.toggle('d-none', isYearday);
}

/** Show a validation error message inside the modal. */
function showReminderValidationError(message) {
    const el = document.getElementById('reminder_validation');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('d-none');
}

/**
 * Validate the modal form, build a reminder object, update the hidden input,
 * re-render the list, and close the modal.
 */
function validateAndSaveReminder() {
    const type = document.querySelector('input[name="reminder_type"]:checked')?.value;
    if (!type) {
        showReminderValidationError(chrome.i18n.getMessage('optRemTypeRequired') || 'Please select a trigger type.');
        return;
    }

    let dayValue;
    if (type === 'yearday') {
        dayValue = parseInt(document.getElementById('reminder_yearday')?.value ?? '', 10);
        if (isNaN(dayValue) || dayValue < 1 || dayValue > 56) {
            showReminderValidationError(chrome.i18n.getMessage('optRemDayInvalid') || 'Day value must be between 1 and 56.');
            return;
        }
    } else {
        dayValue = parseInt(document.getElementById('reminder_weekday')?.value ?? '1', 10);
    }

    const forPopmundo = document.getElementById('reminder_for_popmundo')?.checked ?? false;
    const forGreatHeist = document.getElementById('reminder_for_great_heist')?.checked ?? false;
    if (!forPopmundo && !forGreatHeist) {
        showReminderValidationError(chrome.i18n.getMessage('optRemGameRequired') || 'Please select at least one game.');
        return;
    }

    const text = (document.getElementById('reminder_text')?.value ?? '').trim();
    if (!text) {
        showReminderValidationError(chrome.i18n.getMessage('optRemTextRequired') || 'Please enter the reminder text.');
        return;
    }

    const active = document.getElementById('reminder_active')?.checked ?? true;
    const description = (document.getElementById('reminder_description')?.value ?? '').trim();

    const reminder = {
        id: currentEditingReminderId || crypto.randomUUID(),
        type,
        dayValue,
        forPopmundo,
        forGreatHeist,
        active,
        text,
        description,
    };

    // Update hidden input
    const hidden = document.getElementById('user_reminders');
    let reminders = [];
    try { reminders = JSON.parse(hidden?.value || '[]'); } catch (_) {}

    if (currentEditingReminderId) {
        const idx = reminders.findIndex(r => r.id === currentEditingReminderId);
        if (idx >= 0) reminders[idx] = reminder;
        else reminders.push(reminder);
    } else {
        reminders.push(reminder);
    }

    if (hidden) hidden.value = JSON.stringify(reminders);
    renderRemindersList('user_reminders', reminders);
    markDirty();

    bootstrap.Modal.getOrCreateInstance(document.getElementById('reminderModal')).hide();
}

/**
 * Remove a reminder by id from the hidden input and re-render the list.
 *
 * @param {string} reminderId
 */
function deleteReminder(reminderId) {
    const hidden = document.getElementById('user_reminders');
    let reminders = [];
    try { reminders = JSON.parse(hidden?.value || '[]'); } catch (_) {}
    reminders = reminders.filter(r => r.id !== reminderId);
    if (hidden) hidden.value = JSON.stringify(reminders);
    renderRemindersList('user_reminders', reminders);
    markDirty();
}

/**
 * Applies chrome.i18n translations to all elements with data-i18n* attributes.
 * Must be called before Bootstrap tooltip initialization.
 */
function localizeUI() {
    // data-i18n: set textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const msg = chrome.i18n.getMessage(el.dataset.i18n);
        if (msg) el.textContent = msg;
    });

    // data-i18n-title: set the title attribute (used by Bootstrap Tooltip)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const msg = chrome.i18n.getMessage(el.dataset.i18nTitle);
        if (msg) el.title = msg;
    });

    // data-i18n-placeholder: set the placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const msg = chrome.i18n.getMessage(el.dataset.i18nPlaceholder);
        if (msg) el.placeholder = msg;
    });

    // Page title lives in <title> which uses textContent too
    const titleEl = document.querySelector('title[data-i18n]');
    if (titleEl) {
        const msg = chrome.i18n.getMessage(titleEl.dataset.i18n);
        if (msg) document.title = msg;
    }
}

document.addEventListener('DOMContentLoaded', function () {

    // ── Localize UI before tooltip init so title attributes are already translated ──
    localizeUI();

    // ── Theme: load from storage and wire up the toggle button ──
    initTheme();
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

    // ── Sidebar version footer: read live from the manifest ──
    const versionEl = document.getElementById('pm-version');
    if (versionEl) versionEl.textContent = 'v' + chrome.runtime.getManifest().version;

    // ── Chip-based tabs (Mass Interact, Enhanced Links): render synchronously
    //    here so the chip DOM exists by the time restore_options' callback
    //    fires (loadCheckBox finds chips by id and applies saved is-on state).
    renderMassInteractChips();
    setupMassInteractKbdHint();
    renderEnhancedLinksChips();

    // Chip click + per-group "All / None" buttons (document-level so it
    // covers chips from any tab — currently Mass Interact and Enhanced Links).
    document.addEventListener('click', function (e) {
        const chip = e.target.closest('.pm-chip');
        if (chip && chip.dataset.chipId) {
            chip.classList.toggle('is-on');
            // Bubbling change event triggers markDirty + recomputeTabCounts.
            chip.dispatchEvent(new Event('change', { bubbles: true }));
            // Cheap no-op outside Mass Interact (querySelectors return nothing).
            updateMassInteractGroupCounts();
            return;
        }

        const action = e.target.closest('.pm-chip-section__action');
        if (action) {
            applyChipGroupAction(action.dataset.group, action.dataset.action);
        }
    });

    // Chip search filter
    document.getElementById('mass-interact-search')?.addEventListener('input', function (e) {
        applyMassInteractSearch(e.target.value);
    });

    // ⌘K / Ctrl+K to focus the chip search whenever the Mass Interact
    // tab is the visible one. Doesn't shadow the shortcut on other tabs.
    document.addEventListener('keydown', function (e) {
        if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
        const massTab = document.getElementById('tab-mass-interact');
        if (!massTab || massTab.classList.contains('d-none')) return;
        e.preventDefault();
        const search = document.getElementById('mass-interact-search');
        if (search) {
            search.focus();
            search.select();
        }
    });

    // Mark dirty on any form-element change outside the reminder modal.
    // Also recompute the per-tab counters so the sidebar badges stay in sync.
    // Elements marked [data-no-dirty] are view-only filters (e.g. the
    // exclusion-list character pickers) and must not trigger dirty state.
    document.addEventListener('change', function (e) {
        if (e.target.closest('#reminderModal')) return;
        if (e.target.closest('[data-no-dirty]')) return;
        markDirty();
        recomputeTabCounts();
    });
    document.addEventListener('input', function (e) {
        if (e.target.closest('#reminderModal')) return;
        if (e.target.closest('[data-no-dirty]')) return;
        if (e.target.matches('input[type="text"], input[type="number"], textarea, select')) {
            markDirty();
        }
    });

    // Warn before navigating away with unsaved changes
    window.addEventListener('beforeunload', function (e) {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // After the form is initially populated from storage, compute the counts.
    document.addEventListener('pm:options-restored', function () {
        recomputeTabCounts();
        updateMassInteractGroupCounts();
    });

    // After a successful save, clear dirty + show the toast. Fires from
    // chrome.storage.sync.set's callback, so timing is exact (no heuristic).
    document.addEventListener('pm:options-saved', function () {
        clearDirty();
        showSavedToast();
    });

    // ── Tab switching ──
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const sections = document.querySelectorAll('.tab-content-section');

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.dataset.tab;

            sections.forEach(s => s.classList.add('d-none'));
            document.getElementById(targetId).classList.remove('d-none');

            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // ── Bootstrap Tooltips ──
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(el => new bootstrap.Tooltip(el));

    // ── Remove All buttons for exclusion lists ──
    document.querySelectorAll('[data-exclude-clear]').forEach(btn => {
        btn.addEventListener('click', () => {
            const storageKey = btn.dataset.excludeClear;
            const hidden = document.getElementById(storageKey);
            const select = document.getElementById(storageKey + '_char_select');
            const charId = select ? select.value : null;
            let map = {};
            try { map = JSON.parse(hidden?.value || '{}'); } catch (_) {}
            if (charId) {
                map[charId] = [];
            } else {
                map = {};
            }
            if (hidden) hidden.value = JSON.stringify(map);
            renderExcludeList(storageKey, []);
            markDirty();
        });
    });

    // ── Reset icon chars to defaults ──
    document.getElementById('reset_icons').addEventListener('click', () => {
        optionDetails
            .filter(o => o.name.endsWith('_icon'))
            .forEach(o => loadSelect(o.name, o.default));
        markDirty();
    });

    // ── Show Developer tab in development builds or when ?debug=true is in the URL ──
    const debugParam = new URLSearchParams(window.location.search).get('debug') === 'true';
    chrome.storage.local.get('install_type', ({ install_type }) => {
        if (install_type === 'development' || debugParam) {
            document.getElementById('nav-developer').classList.remove('d-none');
        }
    });

    // ── Reminders ──
    document.getElementById('add-reminder-btn')?.addEventListener('click', () => openReminderModal());
    document.getElementById('save-reminder-btn')?.addEventListener('click', validateAndSaveReminder);
    document.getElementById('type_yearday')?.addEventListener('change', updateTypeInputVisibility);
    document.getElementById('type_weekday')?.addEventListener('change', updateTypeInputVisibility);

    // Move focus away before Bootstrap sets aria-hidden on the modal, which would
    // trigger an accessibility violation if a button inside the modal has focus.
    document.getElementById('reminderModal')?.addEventListener('hide.bs.modal', () => {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
    });
});
