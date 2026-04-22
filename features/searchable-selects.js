'use strict';

// ─── Enhancer Interface ───────────────────────────────────────────────────────
//
// SelectEnhancerManager is agnostic about how a select is enhanced. Pass any
// object that satisfies this interface:
//
// interface ISelectEnhancer {
//   enhance(selectEl: HTMLSelectElement): any   // returns opaque state
//   destroy(selectEl: HTMLSelectElement, state: any): void
//   reset(selectEl: HTMLSelectElement, state: any): void   // called on cascade option refresh
// }

// ─── DatalistEnhancer ────────────────────────────────────────────────────────
//
// Hides the native <select> and replaces it visually with an <input> linked to
// a <datalist> cloned from the select's options. The native select stays in the
// DOM (hidden) so form submission and ASP.NET postbacks work unchanged.
// Selecting from the datalist sets the native select's value and fires its
// change event, preserving any cascading logic on the page.

class DatalistEnhancer {
    enhance(selectEl) {
        const listId = 'pu-dl-' + Math.random().toString(36).slice(2);

        const datalist = document.createElement('datalist');
        datalist.id = listId;
        this._fill(datalist, selectEl);

        // Read the native select's computed styles before hiding it so the input
        // can mirror its appearance regardless of which Popmundo skin is active.
        const cs = window.getComputedStyle(selectEl);

        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('list', listId);
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('data-pu-select-filter', '1');
        input.placeholder = chrome.i18n.getMessage('searchableSelectsPlaceholder') || 'Filter...';

        let newWidth = "100%"
        const widthIncrease = 20;
        if (typeof cs.width === "string") {
            let widthInt = parseInt(cs.width);
            newWidth = cs.width.replace(widthInt, widthInt + widthIncrease);
        } else if (typeof cs.width === "number") {
            newWidth = cs.width + widthIncrease;
        }

        Object.assign(input.style, {
            display: 'block',
            boxSizing: 'border-box',
            // Mirror the native select's visual style (theme-aware)
            width:           newWidth,
            borderWidth:     cs.borderWidth,
            borderStyle:     cs.borderStyle,
            borderColor:     cs.borderColor,
            borderRadius:    cs.borderRadius,
            backgroundColor: cs.backgroundColor,
            color:           cs.color,
            fontSize:        cs.fontSize,
            fontFamily:      cs.fontFamily,
            fontWeight:      cs.fontWeight,
            lineHeight:      cs.lineHeight,
            paddingTop:      cs.paddingTop,
            paddingBottom:   cs.paddingBottom,
            paddingLeft:     cs.paddingLeft,
            paddingRight:    '26px', // reserve room for the search icon
            marginBottom:    cs.marginBottom,
            // Search icon on the right to signal the field is filterable
            backgroundImage:    'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'14\' height=\'14\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888\' stroke-width=\'2.5\' stroke-linecap=\'round\'%3E%3Ccircle cx=\'11\' cy=\'11\' r=\'8\'/%3E%3Cline x1=\'21\' y1=\'21\' x2=\'16.65\' y2=\'16.65\'/%3E%3C/svg%3E")',
            backgroundRepeat:   'no-repeat',
            backgroundPosition: 'right 6px center',
            backgroundSize:     '14px 14px',
        });

        // Show a pre-selected real value (e.g. after a cascade page reload), but
        // leave empty if only a blank placeholder option is currently selected
        const preSelected = selectEl.options[selectEl.selectedIndex];
        if (preSelected && preSelected.value) input.value = preSelected.text;

        // Hide the native select — it remains in the DOM for form submission
        selectEl.style.display = 'none';

        selectEl.parentNode.insertBefore(input, selectEl);
        selectEl.parentNode.insertBefore(datalist, selectEl);

        // On pointerdown: clear before focus so the value is empty when the browser
        // evaluates which datalist suggestions to display.
        // On click: explicitly open the picker — Firefox does not auto-open the
        // datalist dropdown on first click the way Chrome does; showPicker() fixes that.
        // On focus: clear for keyboard navigation (Tab), which has no pointerdown/click.
        const onPointerDown = () => { input.value = ''; };
        const onClick = () => { try { input.showPicker(); } catch (_) {} };
        const onFocus = () => { input.value = ''; };
        input.addEventListener('pointerdown', onPointerDown);
        input.addEventListener('click', onClick);
        input.addEventListener('focus', onFocus);

        // Fires on every keystroke and on datalist selection in all browsers.
        // Only acts on an exact option match, so partial typing has no side-effects.
        const onInput = () => {
            const match = Array.from(selectEl.options).find(o => o.text === input.value);
            if (match && selectEl.value !== match.value) {
                selectEl.value = match.value;
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        };
        // Restore the displayed value if the user blurs without a valid selection.
        const onBlur = () => {
            const match = Array.from(selectEl.options).find(o => o.text === input.value);
            if (!match) this._syncInputFromSelect(input, selectEl);
        };
        input.addEventListener('input', onInput);
        input.addEventListener('blur', onBlur);

        return { input, datalist, onPointerDown, onClick, onFocus, onInput, onBlur };
    }

    destroy(selectEl, state) {
        state.input.removeEventListener('pointerdown', state.onPointerDown);
        state.input.removeEventListener('click', state.onClick);
        state.input.removeEventListener('focus', state.onFocus);
        state.input.removeEventListener('input', state.onInput);
        state.input.removeEventListener('blur', state.onBlur);
        state.input.parentNode?.removeChild(state.input);
        state.datalist.parentNode?.removeChild(state.datalist);
        selectEl.style.display = '';
    }

    reset(selectEl, state) {
        // Cascade updated the select's options — rebuild datalist and reflect new value
        this._fill(state.datalist, selectEl);
        this._syncInputFromSelect(state.input, selectEl);
    }

    _fill(datalist, selectEl) {
        datalist.innerHTML = '';
        for (const opt of selectEl.options) {
            if (!opt.value) continue; // skip blank / placeholder options
            const item = document.createElement('option');
            item.value = opt.text;
            datalist.appendChild(item);
        }
    }

    _syncInputFromSelect(input, selectEl) {
        const sel = selectEl.options[selectEl.selectedIndex];
        input.value = sel ? sel.text : '';
    }
}

// ─── FilterInputEnhancer ─────────────────────────────────────────────────────
//
// Kept as a reference / fallback. Injects a plain text <input> above the
// <select> and filters its visible options as the user types. Does not hide or
// move the native select element.

class FilterInputEnhancer {
    enhance(selectEl) {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = chrome.i18n.getMessage('searchableSelectsPlaceholder') || 'Filter...';
        input.setAttribute('data-pu-select-filter', '1');

        Object.assign(input.style, {
            display: 'block',
            width: '100%',
            marginBottom: '2px',
            padding: '1px 4px',
            fontSize: 'inherit',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
        });

        input.addEventListener('input', () => this._applyFilter(selectEl, input.value));
        selectEl.parentNode.insertBefore(input, selectEl);
        return { input };
    }

    destroy(selectEl, state) {
        state.input.parentNode?.removeChild(state.input);
        if (selectEl.isConnected) {
            for (const opt of selectEl.options) opt.hidden = false;
        }
    }

    reset(selectEl, state) {
        state.input.value = '';
        for (const opt of selectEl.options) opt.hidden = false;
    }

    _applyFilter(selectEl, term) {
        const lower = term.toLowerCase();
        for (const opt of selectEl.options) {
            opt.hidden = term.length > 0 && !opt.text.toLowerCase().includes(lower);
        }
    }
}

// ─── SelectEnhancerManager ───────────────────────────────────────────────────
//
// Handles the full lifecycle: initial scan, MutationObserver for all three DOM
// change patterns Popmundo uses (page reload, innerHTML replacement, options
// replacement), threshold filtering, and exclusion selectors.

class SelectEnhancerManager {
    /**
     * @param {ISelectEnhancer} enhancer
     * @param {object}   opts
     * @param {number}   opts.minOptions        Minimum option count to qualify (default 1)
     * @param {string[]} opts.excludeSelectors  CSS selectors for selects to skip
     */
    constructor(enhancer, { minOptions = 1, excludeSelectors = [] } = {}) {
        this._enhancer = enhancer;
        this._minOptions = minOptions;
        this._excludeSelectors = excludeSelectors;
        this._enhanced = new Map(); // HTMLSelectElement → opaque state
        this._observer = null;
        this._pendingMutations = [];
        this._flushScheduled = false;
    }

    start() {
        document.querySelectorAll('select').forEach(s => this._maybeEnhance(s));

        // Mutations are batched and processed in a deferred task so the observer
        // callback never runs synchronously inside a click handler.
        this._observer = new MutationObserver(mutations => {
            for (const m of mutations) this._pendingMutations.push(m);
            if (!this._flushScheduled) {
                this._flushScheduled = true;
                setTimeout(() => {
                    this._flushScheduled = false;
                    this._onMutations(this._pendingMutations.splice(0));
                }, 0);
            }
        });
        this._observer.observe(document.body, { childList: true, subtree: true });
    }

    stop() {
        this._observer?.disconnect();
        this._observer = null;
        this._pendingMutations = [];
        this._flushScheduled = false;
        for (const [selectEl, state] of this._enhanced) {
            this._enhancer.destroy(selectEl, state);
        }
        this._enhanced.clear();
    }

    _maybeEnhance(selectEl) {
        if (this._enhanced.has(selectEl)) return;
        if (!this._qualifies(selectEl)) return;
        const state = this._enhancer.enhance(selectEl);
        if (state !== null) this._enhanced.set(selectEl, state);
    }

    _qualifies(selectEl) {
        if (selectEl.options.length < this._minOptions) return false;
        if (selectEl.hasAttribute('data-pu-no-filter')) return false;
        return !this._excludeSelectors.some(sel => selectEl.matches(sel));
    }

    _onMutations(mutations) {
        for (const mutation of mutations) {

            // ── Case: options replaced on an existing <select> (cascade update) ──
            if (mutation.type === 'childList' && mutation.target.tagName === 'SELECT') {
                const sel = mutation.target;
                if (this._enhanced.has(sel)) {
                    const state = this._enhanced.get(sel);
                    this._enhancer.reset(sel, state);
                    if (!this._qualifies(sel)) {
                        this._enhancer.destroy(sel, state);
                        this._enhanced.delete(sel);
                    }
                } else {
                    this._maybeEnhance(sel);
                }
                continue;
            }

            // ── Case: new nodes added (page section replaced or loaded) ──
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                if (node.tagName === 'SELECT') {
                    this._maybeEnhance(node);
                } else {
                    node.querySelectorAll?.('select').forEach(s => this._maybeEnhance(s));
                }
            }

            // ── Case: nodes removed — clean up detached enhanced selects ──
            for (const node of mutation.removedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                if (node.tagName === 'SELECT') {
                    this._cleanupRemoved(node);
                } else {
                    node.querySelectorAll?.('select').forEach(s => this._cleanupRemoved(s));
                }
            }
        }
    }

    _cleanupRemoved(selectEl) {
        if (!this._enhanced.has(selectEl)) return;
        if (selectEl.isConnected) return; // moved within DOM, not truly removed
        this._enhancer.destroy(selectEl, this._enhanced.get(selectEl));
        this._enhanced.delete(selectEl);
    }
}

// ─── Feature entry point ──────────────────────────────────────────────────────

(function searchableSelectsFeature() {
    const EXCLUDE_SELECTORS = [
        'select[name*="CurrentCharacter"]',  // managed by fast character switcher
    ];

    chrome.storage.sync.get({ searchable_selects: false }, items => {
        if (!items.searchable_selects) return;

        const manager = new SelectEnhancerManager(new DatalistEnhancer(), {
            minOptions: 1,
            excludeSelectors: EXCLUDE_SELECTORS,
        });

        manager.start();
    });
})();
