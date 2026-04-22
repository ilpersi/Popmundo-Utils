(function () {
    'use strict';

    // --- Module state and constants ---
    let keepCollecting = false;
    let collectionInProgress = false;
    let scrollIntoViewOption = true;
    let logMaxRowsOption = 0;

    const fetcher = new TimedFetch();
    const notifications = new Notifications();
    const JQ = jQuery.noConflict();
    const BOOK_COOLDOWN_MS = 6 * 60 * 1000; // 6 minutes per book
    const STORAGE_KEYS = {
        BOOK_NAME: 'autograph_book_name',
        BLOCKED_CHARS: 'chars-block-itens',
        BOOK_LAST_USE: 'autograph_book_last_use',
        TOTAL_COLLECTED: 'ggf_total_autographs_collected'
    };

    // =============================================================================
    // Logging
    // =============================================================================

    const LOG_TYPE_COLORS = {
        info: '#1976d2',
        warning: '#f9a825',
        error: '#d32f2f',
        success: '#4caf50'
    };

    /**
     * Logs a message to the autograph collection log panel.
     * @param {string} data - Message to display (may contain HTML).
     * @param {'info'|'warning'|'error'|'success'} [type='info'] - Log type (color/title).
     */
    function log(data, type = 'info', scrollTo = true) {
        if (window.parent === window) {
            const now = new Date();
            const time = now.toLocaleTimeString();
            const typeColor = LOG_TYPE_COLORS[type] || LOG_TYPE_COLORS.info;
            const typeCell = `<span style="color: ${typeColor}; font-weight: 600;">${type}</span>`;

            if (JQ('#autograph-logs tbody').length) {
                if (logMaxRowsOption > 0) {
                    let rowCount = JQ('#autograph-logs tbody tr').length;

                    if (rowCount >= logMaxRowsOption) JQ("#autograph-logs tbody tr:first-child").remove();
                }

                let tr = JQ(`<tr><td>${time}</td><td>${typeCell}</td><td>${data}</td></tr>`);
                JQ('#autograph-logs tbody').append(tr);
                if (scrollTo && scrollIntoViewOption) tr[0].scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
            }
        }
    }

    // =============================================================================
    // Storage: blocked characters (that do not accept item usage)
    // =============================================================================

    /**
     * Gets the list of blocked character IDs for item usage.
     * @returns {Promise<string[]>} List of blocked character IDs.
     */
    function getBlockedChars() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                'type': 'storage.session',
                'payload': 'get',
                'param': [STORAGE_KEYS.BLOCKED_CHARS],
            })
                .then((items) => {
                    const blocked = items[STORAGE_KEYS.BLOCKED_CHARS];
                    resolve(Array.isArray(blocked) ? blocked : []);
                });
        });
    }

    /**
     * Persists the list of blocked characters.
     * @param {string[]} blockedChars - List of blocked character IDs.
     * @returns {Promise<any>}
     */
    function setBlockedChars(blockedChars) {
        return chrome.runtime.sendMessage({
            'type': 'storage.session',
            'payload': 'set',
            'param': { [STORAGE_KEYS.BLOCKED_CHARS]: blockedChars },
        });
    }

    // =============================================================================
    // Storage: book last use (cooldown per book)
    // =============================================================================

    /**
     * Gets the map of bookId -> last use timestamp.
     * @returns {Promise<Object<string, number>>} Map of book ID to timestamp.
     */
    function getBookLastUse() {
        return new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEYS.BOOK_LAST_USE], (items) => {
                const data = items[STORAGE_KEYS.BOOK_LAST_USE];
                resolve(typeof data === 'object' && data !== null ? data : {});
            });
        });
    }

    /**
     * Updates the last use timestamp for a book.
     * @param {string} bookId - Book ID.
     * @param {number} timestamp - Use timestamp.
     * @returns {Promise<void>}
     */
    function setBookLastUse(bookId, timestamp) {
        return new Promise((resolve) => {
            getBookLastUse().then((lastUse) => {
                lastUse[bookId] = timestamp;
                chrome.storage.local.set({ [STORAGE_KEYS.BOOK_LAST_USE]: lastUse }, resolve);
            });
        });
    }

    /**
     * Removes from storage any books not in the given list.
     * @param {string[]} bookIds - Book IDs to keep.
     * @returns {Promise<void>}
     */
    function pruneBookLastUse(bookIds) {
        return new Promise((resolve) => {
            getBookLastUse().then((lastUse) => {
                const pruned = {};
                const idSet = new Set(bookIds);
                for (const [id, ts] of Object.entries(lastUse)) {
                    if (idSet.has(id)) pruned[id] = ts;
                }
                chrome.storage.local.set({ [STORAGE_KEYS.BOOK_LAST_USE]: pruned }, resolve);
            });
        });
    }

    // =============================================================================
    // Book availability (cooldown)
    // =============================================================================

    /**
     * Returns the first available book (off cooldown) among the given IDs.
     * @param {string[]} bookIds - Book IDs to consider.
     * @returns {Promise<string|null>} First available book ID or null.
     */
    async function getAvailableBook(bookIds) {
        const lastUse = await getBookLastUse();
        const now = Date.now();
        for (const bookId of bookIds) {
            const last = lastUse[bookId];
            if (!last || (now - last) >= BOOK_COOLDOWN_MS) {
                return bookId;
            }
        }
        return null;
    }

    /**
     * Calculates how many ms until the soonest book becomes available.
     * @param {string[]} bookIds - Book IDs to consider.
     * @returns {Promise<number>} Milliseconds until next book available (0 if one is already available).
     */
    async function getSoonestAvailableMs(bookIds) {
        const lastUse = await getBookLastUse();
        const now = Date.now();
        let soonestMs = Infinity;
        for (const bookId of bookIds) {
            const last = lastUse[bookId];
            if (last) {
                const remaining = BOOK_COOLDOWN_MS - (now - last);
                if (remaining > 0 && remaining < soonestMs) {
                    soonestMs = remaining;
                }
            } else {
                return 0; // some book never used, available now
            }
        }
        return soonestMs === Infinity ? 0 : soonestMs;
    }

    // =============================================================================
    // Storage: book name (user language)
    // =============================================================================

    /**
     * Gets the autograph book name configured by the user.
     * @returns {Promise<string>} Book name (e.g. "Autograph book").
     */
    function getBookName() {
        return new Promise((resolve) => {
            chrome.storage.sync.get([STORAGE_KEYS.BOOK_NAME], (items) => {
                resolve(items[STORAGE_KEYS.BOOK_NAME] || 'Livro de autógrafos');
            });
        });
    }

    // =============================================================================
    // People in city (list for collection)
    // =============================================================================

    /**
     * Gets the list of characters in the city eligible for autograph collection (autograph filter, available).
     * @returns {Promise<Array<{name: string, id: string, status: string}>>} List of people to collect from.
     */
    async function getPeopleToCollect() {
        let people = [];
        const peopleOnlineUrl = Utils.getServerLink('World/Popmundo.aspx/City/PeopleOnline');

        try {
            // Step 1: Initial GET to obtain the form
            const html = await fetcher.fetch(peopleOnlineUrl, { method: "GET" }, false);

            // Step 2: Parse HTML and extract FormData
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            const docForm = doc.getElementById('aspnetForm');

            if (!docForm) {
                throw new Error("Form 'aspnetForm' not found in page.");
            }

            const formDataOrig = new FormData(docForm);

            // Step 3: Set form values
            formDataOrig.set('ctl00$cphLeftColumn$ctl00$btnFilter', doc.getElementById('ctl00_cphLeftColumn_ctl00_btnFilter').value);
            formDataOrig.set('__EVENTTARGET', '');
            formDataOrig.set('__EVENTARGUMENT', '');
            formDataOrig.set('ctl00$cphLeftColumn$ctl00$chkAutograph', 'on');

            if (formDataOrig.has('ctl00$cphLeftColumn$ctl00$chkOnline')) {
                formDataOrig.delete('ctl00$cphLeftColumn$ctl00$chkOnline');
            }
            if (formDataOrig.has('ctl00$cphLeftColumn$ctl00$chkGame')) {
                formDataOrig.delete('ctl00$cphLeftColumn$ctl00$chkGame');
            }
            if (formDataOrig.has('ctl00$cphLeftColumn$ctl00$chkRelationships')) {
                formDataOrig.delete('ctl00$cphLeftColumn$ctl00$chkRelationships');
            }

            // Step 4: POST with configured FormData
            const postHtml = await fetcher.fetch(peopleOnlineUrl, {
                method: "POST",
                body: formDataOrig
            }, false);

            const postDoc = parser.parseFromString(postHtml, "text/html");

            // Step 5: Extract people from table (language-independent)
            const peopleTable = new CssSelectorHelper('#tablepeople', postDoc).getSingle();

            if (peopleTable) {
                Array.from(new CssSelectorHelper('tbody tr', peopleTable).getAll()).forEach(row => {
                    const characterLink = new CssSelectorHelper('a', row).getSingle();
                    const statusCell = new CssSelectorHelper('td', row).getAll()[1];
                    const statusText = statusCell ? statusCell.textContent.trim() : '';
                    const isAvailable = !statusText || statusText === '';

                    if (isAvailable && characterLink) {
                        const href = characterLink.getAttribute('href');
                        const characterId = href.split('/').pop();

                        people.push({
                            name: characterLink.textContent.trim(),
                            id: characterId,
                            status: 'Available'
                        });
                    }
                });
            }
            return people;
        } catch (error) {
            console.error('Error in getPeopleToCollect:', error);
            throw error;
        }
    }

    // =============================================================================
    // Navigation (go to character location)
    // =============================================================================

    /**
     * Navigates to the character's location (via Interact / MoveToLocale).
     * @param {string} charId - Character ID.
     * @param {string} charName - Character name (for logging).
     * @returns {Promise<void>}
     */
    async function goToLocation(charId, charName) {
        const characterUrl = Utils.getServerLink('World/Popmundo.aspx/Character/' + charId);
        let finalUrl = null;

        try {
            // Step 1: Initial GET of character page via HTTP
            const html = await fetcher.fetch(characterUrl, { method: "GET" }, false);

            // Step 2: Parse HTML with DOMParser
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            // Step 3: Detect navigation method and execute
            const linkInteract = new CssSelectorHelper('#ctl00_cphRightColumn_ctl00_lnkInteract', doc).getSingle();
            const btnInteract = new CssSelectorHelper('#ctl00_cphRightColumn_ctl00_btnInteract', doc).getSingle();

            if (linkInteract) {
                const href = linkInteract.getAttribute('href');
                if (href && !href.startsWith('javascript:')) {
                    finalUrl = href.startsWith('http') ? href : Utils.getServerLink(href);
                    await fetcher.fetch(finalUrl, { method: "GET" }, false);
                    log(chrome.i18n.getMessage('ggfMovingToLocation', [charName]), 'info');
                    notifications.getPageNotifications(fetcher);
                    return;
                }
            }

            if (btnInteract) {
                const btnHref = btnInteract.getAttribute('href');

                if (btnHref && !btnHref.startsWith('javascript:')) {
                    finalUrl = btnHref.startsWith('http') ? btnHref : Utils.getServerLink(btnHref);
                    await fetcher.fetch(finalUrl, { method: "GET" }, false);
                    log(chrome.i18n.getMessage('ggfMovingToLocation', [charName]), 'info');
                    notifications.getPageNotifications(fetcher);
                    return;
                }

                if (btnHref && btnHref.includes('__doPostBack')) {
                    const doPostBackMatch = btnHref.match(/javascript:__doPostBack\('([^']+?)','([^']*?)'\)/);
                    if (doPostBackMatch) {
                        const eventTarget = doPostBackMatch[1];
                        const eventArgument = doPostBackMatch[2] || '';

                        const form = doc.getElementById('aspnetForm');
                        if (form) {
                            const formData = new FormData(form);
                            formData.set('__EVENTTARGET', eventTarget);
                            formData.set('__EVENTARGUMENT', eventArgument);

                            const postHtml = await fetcher.fetch(characterUrl, {
                                method: "POST",
                                body: formData
                            }, false);

                            const postDoc = parser.parseFromString(postHtml, "text/html");
                            const redirectLink = new CssSelectorHelper('#ctl00_cphRightColumn_ctl00_lnkInteract', postDoc).getSingle()?.getAttribute('href') ||
                                new CssSelectorHelper('a[href*="/Locale/MoveToLocale/"]', postDoc).getSingle()?.getAttribute('href');

                            if (redirectLink && !redirectLink.startsWith('javascript:')) {
                                finalUrl = redirectLink.startsWith('http') ? redirectLink : Utils.getServerLink(redirectLink);
                            } else {
                                finalUrl = characterUrl;
                            }
                            log(chrome.i18n.getMessage('ggfMovingToLocation', [charName]), 'info');
                            notifications.getPageNotifications(fetcher);
                            return;
                        }
                    }
                }

                if (btnInteract.type === 'submit' || btnInteract.tagName.toLowerCase() === 'button') {
                    const form = btnInteract.closest('form') || doc.getElementById('aspnetForm');
                    if (form) {
                        const formData = new FormData(form);
                        const btnName = btnInteract.getAttribute('name');
                        const btnValue = btnInteract.getAttribute('value') || '';

                        if (btnName) {
                            formData.set(btnName, btnValue);
                        }

                        const formAction = form.getAttribute('action') || characterUrl;
                        const postUrl = formAction.startsWith('http') ? formAction : Utils.getServerLink(formAction);

                        const postHtml = await fetcher.fetch(postUrl, {
                            method: "POST",
                            body: formData
                        }, false);

                        const postDoc = parser.parseFromString(postHtml, "text/html");
                        log(chrome.i18n.getMessage('ggfMovingToLocation', [charName]), 'info');
                        notifications.getPageNotifications(fetcher);
                        return;
                    }
                }
            }

            const characterPresentation = new CssSelectorHelper('.characterPresentation', doc).getSingle();
            if (characterPresentation) {
                const links = new CssSelectorHelper('a', characterPresentation).getAll();
                if (links.length > 0) {
                    const lastLink = links[links.length - 1];
                    const href = lastLink.getAttribute('href');
                    if (href) {
                        const locationId = href.split('/').pop();
                        if (locationId) {
                            finalUrl = Utils.getServerLink('World/Popmundo.aspx/Locale/MoveToLocale/' + locationId + '/' + charId);
                            await fetcher.fetch(finalUrl, { method: "GET" }, false);
                            log(chrome.i18n.getMessage('ggfMovingToLocation', [charName]), 'info');
                            notifications.getPageNotifications(fetcher);
                            return;
                        }
                    }
                }
            }

            let locationLink = linkInteract?.getAttribute('href') || btnInteract?.getAttribute('href');
            if (locationLink && locationLink.startsWith('javascript:') && !locationLink.includes('__doPostBack')) {
                if (btnInteract) {
                    const form = doc.getElementById('aspnetForm');
                    if (form) {
                        const formData = new FormData(form);
                        const btnName = btnInteract.getAttribute('name');
                        const btnId = btnInteract.getAttribute('id');

                        if (btnName) {
                            formData.set(btnName, btnInteract.getAttribute('value') || '');
                        } else if (btnId) {
                            const eventTarget = btnId.replace(/_/g, '$');
                            formData.set('__EVENTTARGET', eventTarget);
                            formData.set('__EVENTARGUMENT', '');
                        }

                        const postHtml = await fetcher.fetch(characterUrl, {
                            method: "POST",
                            body: formData
                        }, false);

                        const postDoc = parser.parseFromString(postHtml, "text/html");
                        const redirectLink = new CssSelectorHelper('#ctl00_cphRightColumn_ctl00_lnkInteract', postDoc).getSingle()?.getAttribute('href') ||
                            new CssSelectorHelper('a[href*="/Locale/MoveToLocale/"]', postDoc).getSingle()?.getAttribute('href');

                        if (redirectLink && !redirectLink.startsWith('javascript:')) {
                            finalUrl = redirectLink.startsWith('http') ? redirectLink : Utils.getServerLink(redirectLink);
                        } else {
                            finalUrl = characterUrl;
                        }
                        log(chrome.i18n.getMessage('ggfMovingToLocation', [charName]), 'info');
                        notifications.getPageNotifications(fetcher);
                        return;
                    }
                }
            }

            if (locationLink && locationLink.includes('/World/')) {
                const relativePath = locationLink.split('/World/')[1];
                if (relativePath) {
                    finalUrl = Utils.getServerLink('World/' + relativePath);
                    await fetcher.fetch(finalUrl, { method: "GET" }, false);
                    log(chrome.i18n.getMessage('ggfMovingToLocation', [charName]), 'info');
                    notifications.getPageNotifications(fetcher);
                    return;
                }
            }

            log(chrome.i18n.getMessage('ggfMaybeLeft', [charName]), 'warning');

        } catch (error) {
            console.error('Error in goToLocation:', error);
            log(chrome.i18n.getMessage('ggfErrorNavigating', [charName, error.message]), 'error');
        }
    }

    // =============================================================================
    // Autograph collection (use book on character)
    // =============================================================================

    /**
     * Attempts to collect autograph from the character using an available book.
     * @param {{name: string, id: string}} person - Character (name and ID).
     * @returns {Promise<{success: boolean, bookIds: string[], waitMs?: number, skipPerson?: boolean}>} Operation result.
     */
    async function collectAutograph(person) {
        const interactUrl = Utils.getServerLink('World/Popmundo.aspx/Interact/' + person.id);
        let bookIds = [];

        try {
            const html = await fetcher.fetch(interactUrl, { method: "GET" }, false);

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            const select = new CssSelectorHelper('#ctl00_cphTopColumn_ctl00_ddlUseItem', doc).getSingle();

            if (!select) {
                log(chrome.i18n.getMessage('ggfNotAvailable', [person.name]));
                const blockedChars = await getBlockedChars();
                if (!blockedChars.includes(person.id)) {
                    blockedChars.push(person.id);
                    await setBlockedChars(blockedChars);
                    log(chrome.i18n.getMessage('ggfStoringChar', [person.name, person.id]), 'warning');
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                return { success: false, bookIds: [], skipPerson: true };
            }

            const bookName = await getBookName();
            const fallbackNames = ['Livro de autógrafos', 'Autograph book'];
            const searchNames = bookName ? [bookName, ...fallbackNames] : fallbackNames;

            const options = new CssSelectorHelper('option', select).getAll();
            options.forEach(option => {
                const optionText = option.textContent.trim();
                const optionValue = option.getAttribute('value');

                if (searchNames.some(name => optionText === name)) {
                    bookIds.push(optionValue);
                }
            });

            if (bookIds.length === 0) {
                return { success: false, bookIds: [] };
            }

            await pruneBookLastUse(bookIds);

            const selectedBookId = await getAvailableBook(bookIds);

            if (!selectedBookId) {
                const waitMs = await getSoonestAvailableMs(bookIds);
                log(chrome.i18n.getMessage('ggfWaitingCooldown', [String(Math.ceil(waitMs / 60000))]), 'info');
                return { success: false, bookIds, waitMs };
            }

            const docForm = doc.getElementById('aspnetForm');
            if (!docForm) {
                throw new Error("Form 'aspnetForm' not found in page.");
            }

            const formData = new FormData(docForm);

            const btnUseItem = doc.getElementById('ctl00_cphTopColumn_ctl00_btnUseItem');
            const btnUseItemValue = btnUseItem?.value;

            if (!btnUseItem || !btnUseItemValue) {
                throw new Error(`Button 'ctl00_cphTopColumn_ctl00_btnUseItem' not found or has no value.`);
            }

            formData.set('ctl00$cphTopColumn$ctl00$ddlUseItem', selectedBookId);
            formData.set('ctl00$cphTopColumn$ctl00$btnUseItem', btnUseItemValue);
            formData.set('__EVENTTARGET', '');
            formData.set('__EVENTARGUMENT', '');
            log(chrome.i18n.getMessage('ggfCollectingFrom', [person.name, selectedBookId]), 'info');
            const urlParams = new URLSearchParams();
            console.dir(formData.entries());
            for (const [key, value] of formData) {
                urlParams.append(key, value);
            }
            await fetcher.fetch(interactUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: urlParams.toString()
            }, false);
            const notification = await notifications.getPageNotifications(fetcher);

            if (notification.Status === "error") {
                log(chrome.i18n.getMessage('ggfErrorCollecting', [person.name, notification.Text]), 'error');
                return { success: false, bookIds };
            }

            await setBookLastUse(selectedBookId, Date.now());

            if (notification.Status === "success") {
                log(chrome.i18n.getMessage('ggfAutographCollected', [person.name]), 'success');
                await incrementTotalCollected();
                updateCounterUI();
            } else if (notification.Status === "normal") {
                log(chrome.i18n.getMessage('ggfAutographCompleted', [person.name]), 'info');
                await incrementTotalCollected();
                updateCounterUI();
            }

            return { success: true, bookIds };
        } catch (error) {
            console.error('Error in collectAutograph:', error);
            log(chrome.i18n.getMessage('ggfErrorCollecting', [person.name, error.message]), 'error');
            return { success: false, bookIds };
        }
    }

    // =============================================================================
    // Timer / UI (visual cooldown)
    // =============================================================================

    /**
     * Shows countdown in minutes/seconds in the UI and resolves when finished.
     * @param {number} minutes - Minutes to wait.
     * @returns {Promise<void>}
     */
    function startDelayTimer(minutes) {
        let timerMessage = JQ('#timer-message');
        let totalSeconds = minutes * 60;

        return new Promise((resolve) => {
            const interval = setInterval(() => {
                let minutesLeft = Math.floor(totalSeconds / 60);
                let secondsLeft = totalSeconds % 60;

                timerMessage.text(chrome.i18n.getMessage('ggfWaiting', [String(minutesLeft), String(secondsLeft)]));

                if (totalSeconds <= 0) {
                    clearInterval(interval);
                    timerMessage.text(chrome.i18n.getMessage('ggfContinuing'));
                    setTimeout(() => timerMessage.text(''), 2000);
                    resolve();
                }

                totalSeconds--;
            }, 1000);
        });
    }

    // =============================================================================
    // Global Counter
    // =============================================================================

    function getTotalCollected() {
        return new Promise((resolve) => {
            chrome.storage.sync.get([STORAGE_KEYS.TOTAL_COLLECTED], (items) => {
                resolve(items[STORAGE_KEYS.TOTAL_COLLECTED] || 0);
            });
        });
    }

    function incrementTotalCollected() {
        return new Promise((resolve) => {
            getTotalCollected().then((total) => {
                const newTotal = total + 1;
                chrome.storage.sync.set({ [STORAGE_KEYS.TOTAL_COLLECTED]: newTotal }, () => resolve(newTotal));
            });
        });
    }

    function getFunMessage(count) {
        if (count === 0) return chrome.i18n.getMessage('ggfTotalCollected0');
        if (count < 10) return chrome.i18n.getMessage('ggfTotalCollected10', [String(count)]);
        if (count < 50) return chrome.i18n.getMessage('ggfTotalCollected50', [String(count)]);
        if (count < 100) return chrome.i18n.getMessage('ggfTotalCollected100', [String(count)]);
        if (count < 500) return chrome.i18n.getMessage('ggfTotalCollected500', [String(count)]);
        return chrome.i18n.getMessage('ggfTotalCollectedLegendary', [String(count)]);
    }

    async function updateCounterUI() {
        const count = await getTotalCollected();
        const msg = getFunMessage(count);
        JQ('#autograph-counter').html(msg);
    }

    // =============================================================================
    // Initialization (DOM ready)
    // =============================================================================

    JQ(document).ready(async function () {
        const { collect_autograph: isEnabled = true, collect_autograph_scroll: scrollIntoViewOptionLocal, autograph_log_max_rows: logMaxRowsOptionLocal } =
            await new Promise(resolve =>
                chrome.storage.sync.get({ collect_autograph: true, collect_autograph_scroll: true, autograph_log_max_rows: 0 }, resolve)
            );

        scrollIntoViewOption = scrollIntoViewOptionLocal
        logMaxRowsOption = logMaxRowsOptionLocal

        if (!isEnabled) return;

        JQ('#checkedlist').before(`<div class="box" id="autograph-box"><h2>${chrome.i18n.getMessage('ggfTitle')}</h2></div>`);
        JQ('#autograph-box').append(`<p>${chrome.i18n.getMessage('ggfDescription')}</p>`);
        JQ('#autograph-box').append(`<p><small>${chrome.i18n.getMessage('ggfDisableHint')}</small></p>`);
        JQ('#autograph-box').append(`<p id="autograph-counter"></p>`);

        const popupTheme = Utils.getPopupTheme();

        const howToUseContent =
            `<div class="box" style="font-size:${popupTheme.FONT_SIZE};color:${popupTheme.COLOR};">` +
            `<h2>${chrome.i18n.getMessage('ggfHowToUse')}</h2>` +
            `<ol class="normal">` +
            `<li>${chrome.i18n.getMessage('ggfStep1')}</li>` +
            `<li>${chrome.i18n.getMessage('ggfStep2')}</li>` +
            `<li>${chrome.i18n.getMessage('ggfStep3')}</li>` +
            `<li>${chrome.i18n.getMessage('ggfStep4')}</li>` +
            `</ol>` +
            `</div>`;

        JQ('#autograph-box').append(`<p><a href="#" id="ggf-how-to-use-link">${chrome.i18n.getMessage('ggfHowToUse')}</a></p>`);

        new PmPopup('#ggf-how-to-use-link', {
            content: howToUseContent,
            interactive: true,
            placement: 'bottom-start',
            theme: popupTheme.DATA_THEME,
            maxWidth: 520,
        });

        JQ('#autograph-box').on('click', '#ggf-how-to-use-link', function (e) {
            e.preventDefault();
        });
        JQ('#autograph-box').append(`
            <div class="actionbuttons" style="margin: 16px 0;">
                <input type="submit" name="btn-clear-storage" value="${chrome.i18n.getMessage('ggfClearBlockedChars')}" id="clear-blocked-chars" class="cns" title="${chrome.i18n.getMessage('ggfClearBlockedCharsTitle')}">
                <input type="submit" name="btn-start-collection" value="${chrome.i18n.getMessage('ggfStart')}" id="start-collection" class="cns">
            </div>
        `);

        JQ('#autograph-box').append(
            '<div id="timer-message-wrap" style="margin-bottom: 14px; min-height: 1.5em;">' +
            '<div id="timer-message" style="font-weight: bold; color: red; padding: 6px 0;"></div>' +
            '</div>'
        );
        updateCounterUI();
        JQ('#autograph-box').append(

            '<table id="autograph-logs" class="data">' +
            `<thead><tr><th>${chrome.i18n.getMessage('ggfLogColTime')}</th><th>${chrome.i18n.getMessage('ggfLogColType')}</th><th>${chrome.i18n.getMessage('ggfLogColMessage')}</th></tr></thead>` +
            '<tbody></tbody></table>'
        );

        const bookName = await getBookName();
        const escaped = bookName.replace(/"/g, '\\"');
        const bookElement = JQ(`#checkedlist a:contains("${escaped}")`);

        if (bookElement.length === 0) {
            log(chrome.i18n.getMessage('ggfNoBooksFound'), 'warning', false);
            JQ('#start-collection').prop('disabled', true).prop('value', chrome.i18n.getMessage('ggfNoBooks'));
        } else {
            const bookQuantity = bookElement.closest('td').find('em').text().trim();
            if (bookQuantity.startsWith('x')) {
                log(chrome.i18n.getMessage('ggfBooksFound', [String(parseInt(bookQuantity.substring(1)))]), 'info', false);
            } else {
                log(chrome.i18n.getMessage('ggfBooksFound', [String(bookElement.length)]), 'info', false);
            }
        }

        let lastCycleIds = [];
        let queue = [];

        JQ('#autograph-open-options-link').on('click', function (e) {
            e.preventDefault();
            chrome.runtime.sendMessage(chrome.runtime.id, { type: 'cmd', payload: 'open-options' });
            return false;
        });

        JQ('#ggf-options-hint-link').on('click', function (e) {
            e.preventDefault();
            chrome.runtime.sendMessage(chrome.runtime.id, { type: 'cmd', payload: 'open-options' });
            return false;
        });

        JQ('#start-collection').click(async function () {
            if (collectionInProgress) return;
            collectionInProgress = true;
            keepCollecting = true;
            JQ('#start-collection').prop('disabled', true);
            JQ('#start-collection').prop('value', chrome.i18n.getMessage('ggfCollecting'));
            const waitSeconds = s => new Promise(r => setTimeout(r, s * 1000));

            while (keepCollecting) {
                try {
                    if (queue.length === 0) {
                        const freshQueue = await getPeopleToCollect();
                        const blockedChars = await getBlockedChars();
                        queue = freshQueue.filter(
                            p => !blockedChars.includes(p.id) && !lastCycleIds.includes(p.id)
                        );

                        if (queue.length === 0) {
                            log(chrome.i18n.getMessage('ggfNoEligible'), 'warning');
                            await waitSeconds(60);
                            continue;
                        }
                    }

                    const person = queue[0];
                    await goToLocation(person.id, person.name);

                    const result = await collectAutograph(person);

                    if (result.waitMs > 0) {
                        const waitMin = Math.ceil(result.waitMs / 60000);
                        log(chrome.i18n.getMessage('ggfCooldownWait', [String(waitMin)]));
                        await startDelayTimer(waitMin);
                        continue;
                    }

                    queue.shift();

                    if (result.skipPerson || !result.success) {
                        continue;
                    }

                    lastCycleIds.push(person.id);
                } catch (err) {
                    console.error(err);
                    log(chrome.i18n.getMessage('ggfScriptError'), 'error');
                }
            }

            collectionInProgress = false;
            JQ('#start-collection').prop('disabled', false);
            JQ('#start-collection').prop('value', chrome.i18n.getMessage('ggfStart'));
            log(chrome.i18n.getMessage('ggfStopped'));
        });
        //prevent default form submission

        JQ('#clear-blocked-chars').click(function (e) {
            e.preventDefault();
            e.stopPropagation();
            chrome.runtime.sendMessage({
                'type': 'storage.session',
                'payload': 'remove',
                'param': STORAGE_KEYS.BLOCKED_CHARS,
            })
                .then(() => log(chrome.i18n.getMessage('ggfBlockedCleared')));
        });
    });

})();
