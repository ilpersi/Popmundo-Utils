(function () {
    'use strict';

    // =============================================================================
    // Module setup
    // =============================================================================

    const JQ = jQuery.noConflict();
    const fetcher = new TimedFetch(false);
    const notifications = new Notifications();

    /** Game / extension element ids for Character → Offer Item (ASP.NET WebForms). */
    const DOM_IDS = {
        ITEM_SELECT: 'ctl00_cphLeftColumn_ctl00_ddlItem',
        BTN_GIVE: 'ctl00_cphLeftColumn_ctl00_btnGive',
        ASPNET_FORM: 'aspnetForm',
        TXT_PRICE_TAG: 'ctl00_cphLeftColumn_ctl00_txtPriceTag',
        CHK_DELIVERY: 'ctl00_cphLeftColumn_ctl00_chkDelivery',
        PANEL: 'popmundo-utils-mis-multi-panel',
        DD_HEADER: 'popmundo-utils-mis-dd-header',
        DD_LIST: 'popmundo-utils-mis-dd-list',
        DD_PROGRESS: 'popmundo-utils-mis-send-progress',
        BTN_SUBMIT_MULTI: 'popmundo-utils-mis-submit-multi'
    };

    const DD_NS = 'click.popmundoMisDd';
    const KEY_NS = 'keydown.popmundoMisDd';

    /** Form `name` attributes (dollar notation) for Offer Item postback. */
    const FORM_NAMES = {
        DDL_ITEM: 'ctl00$cphLeftColumn$ctl00$ddlItem',
        BTN_GIVE: 'ctl00$cphLeftColumn$ctl00$btnGive'
    };

    /** `__EVENTTARGET` when simulating click on the native give button. */
    const EVENT_TARGET_BTN_GIVE = 'ctl00$cphLeftColumn$ctl00$btnGive';

    /** Delay before retrying init when the item select is not in the DOM yet. */
    const PROBE_RETRY_MS = 500;

    /** Prevents double-submit while the POST queue runs. */
    let offerQueueInProgress = false;

    // =============================================================================
    // Options: read from native `<select>` (one row per option value)
    // =============================================================================

    /**
     * @param {JQuery} $select
     * @returns {{ value: string, label: string }[]}
     */
    function readOptionsFromSelect($select) {
        /** @type {{ value: string, label: string }[]} */
        const out = [];
        $select.find('option').each(function () {
            const el = this;
            const rawVal = JQ(el).val();
            const v = rawVal == null ? '' : String(rawVal);
            if (v === '') {
                return;
            }
            out.push({
                value: v,
                label: (el.textContent || '').trim()
            });
        });
        return out;
    }

    /**
     * @param {JQuery} $list Container of item checkboxes.
     * @returns {number}
     */
    function getCheckedItemCount($list) {
        return $list.find('.popmundo-utils-mis-cb:checked').length;
    }

    /**
     * Checked instance ids in DOM list order.
     * @param {JQuery} $list
     * @returns {string[]}
     */
    function getCheckedInstanceIdsOrdered($list) {
        /** @type {string[]} */
        const ids = [];
        $list.find('.popmundo-utils-mis-cb:checked').each(function () {
            const v = JQ(this).attr('data-value');
            if (v != null && v !== '') {
                ids.push(String(v));
            }
        });
        return ids;
    }

    /**
     * @param {JQuery} $header
     * @param {JQuery} $list
     */
    function updateMultiSelectSummary($header, $list) {
        const n = getCheckedItemCount($list);
        if (n === 0) {
            $header.text(chrome.i18n.getMessage('misPickItemsPlaceholder'));
        } else if (n === 1) {
            $header.text(chrome.i18n.getMessage('misOneItemSelected'));
        } else {
            $header.text(chrome.i18n.getMessage('misNItemsSelected', [String(n)]));
        }
    }

    // =============================================================================
    // Multi-offer payload (explicit checkbox selection)
    // =============================================================================

    /**
     * @param {JQuery} $list Dropdown list root.
     * @returns {{ itemInstanceIds: string[] }}
     */
    function buildMultiOfferPayloadFromList($list) {
        return { itemInstanceIds: getCheckedInstanceIdsOrdered($list) };
    }

    // =============================================================================
    // HTTP: sequential Offer Item POSTs (viewstate from each response)
    // =============================================================================

    /**
     * Builds `application/x-www-form-urlencoded` body from `#aspnetForm` in `htmlDoc`.
     * @param {Document} htmlDoc Live `document` or parsed POST response.
     * @param {string} itemInstanceId `ddlItem` value for this offer.
     * @returns {{ ok: true, body: string } | { ok: false, messageKey: string }}
     */
    function buildOfferItemPostBodyFromDoc(htmlDoc, itemInstanceId) {
        const form = htmlDoc.getElementById(DOM_IDS.ASPNET_FORM);
        if (!form) {
            return { ok: false, messageKey: 'misOfferFormMissing' };
        }
        const btnGive = htmlDoc.getElementById(DOM_IDS.BTN_GIVE);
        if (!btnGive) {
            return { ok: false, messageKey: 'misOfferGiveButtonMissing' };
        }
        const formData = new FormData(form);
        formData.set(FORM_NAMES.DDL_ITEM, String(itemInstanceId));
        formData.set('__EVENTTARGET', EVENT_TARGET_BTN_GIVE);
        formData.set('__EVENTARGUMENT', '');
        formData.set(FORM_NAMES.BTN_GIVE, btnGive.value);
        const urlParams = new URLSearchParams();
        for (const [key, value] of formData.entries()) {
            urlParams.append(key, value);
        }
        return { ok: true, body: urlParams.toString() };
    }

    /**
     * One offer POST + notification poll; returns parsed HTML for the next iteration.
     * @param {TimedFetch} fetcherInst
     * @param {Notifications} notificationsInst
     * @param {string} postUrl `pathname` + `search` on the current origin.
     * @param {Document} htmlDoc
     * @param {string} itemInstanceId
     * @returns {Promise<{ ok: boolean, notification: { Status: string, Text: string }, nextDoc: Document|null }>}
     */
    async function postSingleOfferItem(fetcherInst, notificationsInst, postUrl, htmlDoc, itemInstanceId) {
        const built = buildOfferItemPostBodyFromDoc(htmlDoc, itemInstanceId);
        if (!built.ok) {
            return {
                ok: false,
                notification: { Status: 'error', Text: chrome.i18n.getMessage(built.messageKey) },
                nextDoc: null
            };
        }
        try {
            const responseText = await fetcherInst.fetch(postUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: built.body
            });
            const nextDoc = new DOMParser().parseFromString(responseText, 'text/html');
            const notification = await notificationsInst.getPageNotifications(fetcherInst);
            const ok = notification.Status !== 'error';
            return { ok, notification, nextDoc };
        } catch (err) {
            const text = err && err.message ? err.message : String(err);
            return {
                ok: false,
                notification: { Status: 'error', Text: text },
                nextDoc: null
            };
        }
    }

    /**
     * Runs one POST per `itemInstanceIds`, refreshing hidden fields from each HTML response.
     * @param {TimedFetch} fetcherInst
     * @param {Notifications} notificationsInst
     * @param {{ itemInstanceIds: string[] }} payload
     * @param {((current1Based: number, total: number) => void)|undefined} [onProgress] Fired before each POST (e.g. "Sending 1 of 3").
     * @returns {Promise<{ success: boolean, completed: number }>}
     */
    async function runQueuedOfferItems(fetcherInst, notificationsInst, payload, onProgress) {
        const postUrl = window.location.pathname + window.location.search;
        let htmlDoc = document;
        let completed = 0;
        const total = payload.itemInstanceIds.length;
        for (let i = 0; i < total; i++) {
            if (typeof onProgress === 'function') {
                onProgress(i + 1, total);
            }
            const itemInstanceId = payload.itemInstanceIds[i];
            const result = await postSingleOfferItem(fetcherInst, notificationsInst, postUrl, htmlDoc, itemInstanceId);
            if (!result.ok || result.notification.Status === 'error') {
                const detail = result.notification.Text || 'Unknown error';
                notificationsInst.notifyError('mis-error', chrome.i18n.getMessage('misOfferFailed', [detail]));
                return { success: false, completed };
            }
            htmlDoc = result.nextDoc;
            completed += 1;
        }
        notificationsInst.notifySuccess('mis-done', chrome.i18n.getMessage('misOfferQueueDone', [String(completed)]));
        return { success: true, completed };
    }

    /**
     * @param {JQuery.Event} e
     * @param {JQuery} $list
     * @param {JQuery} $header
     * @param {JQuery} $btnMulti
     * @param {JQuery} $progress Progress label beside the dropdown header (hidden when idle).
     */
    async function handleAlternateSubmitClick(e, $list, $header, $btnMulti, $progress) {
        e.preventDefault();
        e.stopPropagation();
        if (offerQueueInProgress) {
            return;
        }
        const payload = buildMultiOfferPayloadFromList($list);
        if (payload.itemInstanceIds.length === 0) {
            notifications.notifyError('mis-validation', chrome.i18n.getMessage('misOfferNoneSelected'));
            return;
        }
        offerQueueInProgress = true;
        $btnMulti.prop('disabled', true);
        $header.prop('disabled', true);
        $list.find('.popmundo-utils-mis-cb').prop('disabled', true);
        try {
            await runQueuedOfferItems(fetcher, notifications, payload, function (current, total) {
                $progress.text(chrome.i18n.getMessage('misOfferSendingProgress', [String(current), String(total)]));
                $progress.css('visibility', 'visible');
            });
        } catch (err) {
            console.error('[mass-item-sender]', err);
            window.alert(chrome.i18n.getMessage('misOfferFailed', [err.message || String(err)]));
        } finally {
            offerQueueInProgress = false;
            $btnMulti.prop('disabled', false);
            $header.prop('disabled', false);
            $list.find('.popmundo-utils-mis-cb').prop('disabled', false);
            $progress.empty();
            $progress.css('visibility', 'hidden');
            updateMultiSelectSummary($header, $list);
        }
    }

    // =============================================================================
    // DOM: multi-select dropdown (checkbox per option)
    // =============================================================================

    /**
     * Rebuilds checkbox rows from the current `<select>` options; restores checked state for values in `preservedValues`.
     * @param {JQuery} $select
     * @param {JQuery} $list
     * @param {Set<string>} [preservedValues]
     */
    function refreshMultiSelectFromSelect($select, $list, preservedValues) {
        const preserve = preservedValues instanceof Set ? preservedValues : new Set();
        $list.empty();
        const options = readOptionsFromSelect($select);
        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            const id = 'popmundo-utils-mis-cb-' + i;
            const $cb = JQ('<input>', {
                type: 'checkbox',
                class: 'popmundo-utils-mis-cb lmargin5',
                id: id,
                'data-value': opt.value
            });
            if (preserve.has(opt.value)) {
                $cb.prop('checked', true);
            }
            const $span = JQ('<span>').text(opt.label);
            const $lbl = JQ('<label>', {
                class: 'popmundo-utils-mis-dd-row',
                css: { display: 'flex', alignItems: 'center', padding: '4px 6px', cursor: 'pointer' }
            });
            $lbl.append($cb, $span);
            $list.append($lbl);
        }
    }

    /**
     * @returns {{ $panel: JQuery, $header: JQuery, $list: JQuery, $wrap: JQuery, $progress: JQuery }}
     */
    function buildMultiSelectDropdown() {
        const $panel = JQ('<p>', { id: DOM_IDS.PANEL, class: 'popmundo-utils-mis-multi-panel' });
        const $wrap = JQ('<div>', {
            class: 'popmundo-utils-mis-dd-wrap',
            css: { position: 'relative', maxWidth: '100%' }
        });
        const $headRow = JQ('<div>', {
            class: 'popmundo-utils-mis-dd-headrow',
            css: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                flexWrap: 'nowrap'
            }
        });
        const $header = JQ('<button>', {
            type: 'button',
            id: DOM_IDS.DD_HEADER,
            class: 'cns',
            text: chrome.i18n.getMessage('misPickItemsPlaceholder'),
            css: { flex: '1 1 auto', minWidth: 0, textAlign: 'left' },
            'aria-expanded': 'false',
            'aria-haspopup': 'listbox',
            'aria-controls': DOM_IDS.DD_LIST,
            'aria-label': chrome.i18n.getMessage('misDdHeaderAria')
        });
        $headRow.append($header);
        const $list = JQ('<div>', {
            id: DOM_IDS.DD_LIST,
            class: 'popmundo-utils-mis-dd-list',
            css: {
                display: 'none',
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: '100%',
                zIndex: 5000,
                maxHeight: '240px',
                overflowY: 'auto',
                marginBottom: '2px',
                border: '1px solid #999',
                background: '#fff',
                boxShadow: '0 -2px 8px rgba(0,0,0,0.15)'
            }
        });
        $list.attr({ role: 'listbox', 'aria-multiselectable': 'true' });
        $wrap.append($headRow, $list);
        $panel.append($wrap);
        return { $panel, $header, $list, $wrap };
    }

    /**
     * @param {JQuery} $header
     * @param {JQuery} $list
     * @param {boolean} open
     */
    function setDropdownOpen($header, $list, open) {
        $list.css('display', open ? 'block' : 'none');
        $header.attr('aria-expanded', open ? 'true' : 'false');
        JQ(document).off(DD_NS);
        JQ(document).off(KEY_NS);
        if (!open) {
            return;
        }
        JQ(document).on(DD_NS, function (ev) {
            const target = ev.target;
            if (!target) {
                return;
            }
            const $t = JQ(target);
            if (
                $t.closest('#' + DOM_IDS.DD_HEADER).length ||
                $t.closest('#' + DOM_IDS.DD_LIST).length
            ) {
                return;
            }
            setDropdownOpen($header, $list, false);
        });
        JQ(document).on(KEY_NS, function (ev) {
            if (ev.key === 'Escape') {
                setDropdownOpen($header, $list, false);
            }
        });
    }

    /**
     * @param {JQuery} $list
     * @param {JQuery} $btnGive
     * @param {JQuery} $btnMulti
     */
    function syncNativeVsAlternateSubmitMulti($list, $btnGive, $btnMulti) {
        const useMultiBtn = getCheckedItemCount($list) > 0;
        if ($btnGive.length) {
            if (useMultiBtn) {
                $btnGive.hide();
                $btnMulti.show();
            } else {
                $btnGive.show();
                $btnMulti.hide();
            }
            return;
        }
        if (useMultiBtn) {
            $btnMulti.show();
        } else {
            $btnMulti.hide();
        }
    }

    /**
     * Alternate submit: same `cnf` class as the game button; sits next to `#btnGive` in the DOM.
     * @returns {JQuery}
     */
    function createAlternateSubmitButton() {
        const $btn = JQ('<input>', {
            type: 'submit',
            id: DOM_IDS.BTN_SUBMIT_MULTI,
            class: 'cnf',
            value: chrome.i18n.getMessage('misOfferMultiSubmit')
        });
        $btn.hide();
        return $btn;
    }

    /**
     * Inserts the extension panel before the last `<p>` inside the nearest `.box`, or after the select.
     * @param {JQuery} $select
     * @param {JQuery} $panel
     */
    function mountPanelInOfferBox($select, $panel) {
        const $box = $select.closest('.box');
        const $lastP = $box.find('p').last();
        if ($lastP.length) {
            $panel.insertBefore($lastP);
        } else {
            $select.after($panel);
        }
    }

    /**
     * Places the alternate submit immediately before the native "Offer item" button (same slot when toggling visibility).
     * @param {JQuery} $btnGive Native submit (may be empty jQuery).
     * @param {JQuery} $btnMulti Extension submit.
     * @param {JQuery} $select Fallback anchor if `#btnGive` is missing.
     */
    function mountAlternateSubmitBesideGive($btnGive, $btnMulti, $select) {
        if ($btnGive.length) {
            $btnMulti.insertBefore($btnGive);
        } else {
            $btnMulti.insertAfter($select);
        }
    }

    // =============================================================================
    // Wiring: one-time attach + event bindings
    // =============================================================================

    /**
     * @returns {boolean} True if the feature was already mounted in this document.
     */
    function isMultiSendAlreadyMounted() {
        return JQ(`#${DOM_IDS.PANEL}`).length > 0;
    }

    /**
     * Mounts UI and registers listeners. Idempotent per page via `#PANEL` existence check.
     * @param {JQuery} $select
     */
    function attachMultiSendFeature($select) {
        if (isMultiSendAlreadyMounted()) {
            return;
        }

        const { $panel, $header, $list } = buildMultiSelectDropdown();
        const $btnMulti = createAlternateSubmitButton();
        const $progress = JQ('<span>', {
            id: DOM_IDS.DD_PROGRESS,
            class: 'popmundo-utils-mis-send-progress',
            attr: { 'aria-live': 'polite', role: 'status' },
            css: { visibility: 'hidden', whiteSpace: 'nowrap', fontSize: '0.95em', opacity: 0.92, marginLeft: '8px' }
        });
        refreshMultiSelectFromSelect($select, $list, new Set());
        updateMultiSelectSummary($header, $list);

        mountPanelInOfferBox($select, $panel);
        $panel.append(`<p><small>${chrome.i18n.getMessage('misDisableHint')}</small></p>`);

        const $btnGive = JQ(`#${DOM_IDS.BTN_GIVE}`);
        mountAlternateSubmitBesideGive($btnGive, $btnMulti, $select);
        $btnMulti.after($progress);

        const syncGiveButtons = () => syncNativeVsAlternateSubmitMulti($list, $btnGive, $btnMulti);

        $header.on('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = $list.css('display') !== 'none';
            setDropdownOpen($header, $list, !isOpen);
        });

        $list.on('change', '.popmundo-utils-mis-cb', function () {
            updateMultiSelectSummary($header, $list);
            syncGiveButtons();
        });

        $select.on('change', function () {
            const preserved = new Set(getCheckedInstanceIdsOrdered($list));
            refreshMultiSelectFromSelect($select, $list, preserved);
            updateMultiSelectSummary($header, $list);
            syncGiveButtons();
        });

        $btnMulti.on('click', function (e) {
            void handleAlternateSubmitClick(e, $list, $header, $btnMulti, $progress);
            return false;
        });

        syncGiveButtons();
    }

    // =============================================================================
    // Bootstrap: find select (optional delayed retry)
    // =============================================================================

    /**
     * @returns {boolean} True if the item select exists and the feature was attached.
     */
    function tryInitOfferItemMultiSend() {
        const $select = JQ(`#${DOM_IDS.ITEM_SELECT}`);
        if (!$select.length || !$select.is('select')) {
            return false;
        }
        attachMultiSendFeature($select);
        return true;
    }

    function scheduleOfferItemProbe() {
        if (tryInitOfferItemMultiSend()) {
            return;
        }
        setTimeout(tryInitOfferItemMultiSend, PROBE_RETRY_MS);
    }

    JQ(document).ready(async function () {
        const { mass_item_sender: isEnabled = true } = await new Promise(resolve =>
            chrome.storage.sync.get({ mass_item_sender: true }, resolve)
        );
        if (!isEnabled) return;
        scheduleOfferItemProbe();
    });
}());
