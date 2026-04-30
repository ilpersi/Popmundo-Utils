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
// Sidebar per-tab counters. Counts checked switch toggles vs total. Tabs
// without checkbox toggles get an empty badge that the CSS hides via :empty.
// ─────────────────────────────────────────────────────────────────────────────

function recomputeTabCounts() {
    document.querySelectorAll('.tab-content-section').forEach(section => {
        const total = section.querySelectorAll('.form-check-input[type="checkbox"]').length;
        const checked = section.querySelectorAll('.form-check-input[type="checkbox"]:checked').length;
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
    document.addEventListener('pm:options-restored', recomputeTabCounts);

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
