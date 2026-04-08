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

    // Get all known characters from the DB in sync storage (id -> name)
    const syncData = await chrome.storage.sync.get({ all_characters_details: { 'id-name': {} } });
    const idNameMap = (syncData.all_characters_details && syncData.all_characters_details['id-name'])
        ? syncData.all_characters_details['id-name']
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
        });
    });

    // ── Reset icon chars to defaults ──
    document.getElementById('reset_icons').addEventListener('click', () => {
        optionDetails
            .filter(o => o.name.endsWith('_icon'))
            .forEach(o => loadSelect(o.name, o.default));
    });

    // ── Show Developer tab in development builds or when ?debug=true is in the URL ──
    const debugParam = new URLSearchParams(window.location.search).get('debug') === 'true';
    chrome.storage.local.get('install_type', ({ install_type }) => {
        if (install_type === 'development' || debugParam) {
            document.getElementById('nav-developer').classList.remove('d-none');
        }
    });
});
