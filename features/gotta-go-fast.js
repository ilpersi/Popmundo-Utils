(function () {
    'use strict';

    // --- Module state and constants ---
    let continuaColeta = false;
    let coletaInProgress = false;

    const fetcher = new TimedFetch(false);
    const notifications = new Notifications();
    const JQ = jQuery.noConflict();
    const BOOK_COOLDOWN_MS = 6 * 60 * 1000; // 6 minutes per book
    const STORAGE_KEYS = {
        BOOK_NAME: 'autograph_book_name',
        BLOCKED_CHARS: 'chars-block-itens',
        BOOK_LAST_USE: 'autograph_book_last_use'
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

    let LOG_INDEX = 0;

    /**
     * Logs a message to the autograph collection log panel.
     * @param {string} data - Message to display (may contain HTML).
     * @param {'info'|'warning'|'error'|'success'} [type='info'] - Log type (color/title).
     */
    function log(data, type = 'info') {
        if (window.parent === window) {
            const now = new Date();
            const time = now.toLocaleTimeString();
            const typeColor = LOG_TYPE_COLORS[type] || LOG_TYPE_COLORS.info;
            const typeCell = `<span style="color: ${typeColor}; font-weight: 600;" drinkwater>${type}</span>`;

            if (JQ('#logs-autografos').length) {
                try {
                    const dt = JQ('#logs-autografos').DataTable();
                    if (dt) {
                        dt.row.add([time, typeCell, data]).draw(false);
                        LOG_INDEX++;
                        return;
                    }
                } catch (e) { /* DataTable not initialized */ }
            }
            JQ("#logs-autografos tbody").append(`<tr class="${LOG_INDEX % 2 === 0 ? "odd" : "even"}" drinkwater><td drinkwater>${time}</td><td drinkwater>${typeCell}</td><td drinkwater>${data}</td></tr>`);
            LOG_INDEX++;
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
            chrome.storage.session.get([STORAGE_KEYS.BLOCKED_CHARS], (items) => {
                const blocked = items[STORAGE_KEYS.BLOCKED_CHARS];
                resolve(Array.isArray(blocked) ? blocked : []);
            });
        });
    }

    /**
     * Persists the list of blocked characters.
     * @param {string[]} blockedChars - List of blocked character IDs.
     * @returns {Promise<void>}
     */
    function setBlockedChars(blockedChars) {
        return new Promise((resolve) => {
            chrome.storage.session.set({ [STORAGE_KEYS.BLOCKED_CHARS]: blockedChars }, resolve);
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
            const html = await fetcher.fetch(peopleOnlineUrl, { method: "GET" });

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
            });

            const postDoc = parser.parseFromString(postHtml, "text/html");

            // Step 5: Extract people from table (language-independent)
            const peopleTable = postDoc.querySelector('#tablepeople');

            if (peopleTable) {
                Array.from(peopleTable.querySelectorAll('tbody tr')).forEach(row => {
                    const characterLink = row.querySelector('a');
                    const statusCell = row.querySelectorAll('td')[1];
                    const statusText = statusCell ? statusCell.textContent.trim() : '';
                    const isAvailable = !statusText || statusText === '';

                    if (isAvailable && characterLink) {
                        const href = characterLink.getAttribute('href');
                        const characterId = href.split('/').pop();

                        people.push({
                            name: characterLink.textContent.trim(),
                            id: characterId,
                            status: 'Disponível'
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
            const html = await fetcher.fetch(characterUrl, { method: "GET" });

            // Step 2: Parse HTML with DOMParser
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            // Step 3: Detect navigation method and execute
            const linkInteract = doc.querySelector('#ctl00_cphRightColumn_ctl00_lnkInteract');
            const btnInteract = doc.querySelector('#ctl00_cphRightColumn_ctl00_btnInteract');

            if (linkInteract) {
                const href = linkInteract.getAttribute('href');
                if (href && !href.startsWith('javascript:')) {
                    finalUrl = href.startsWith('http') ? href : Utils.getServerLink(href);
                    await fetcher.fetch(finalUrl, { method: "GET" });
                    log(`Moving to location of <b>${charName}</b>`, 'info');
                    notifications.getPageNotifications(fetcher);
                    return;
                }
            }

            if (btnInteract) {
                const btnHref = btnInteract.getAttribute('href');

                if (btnHref && !btnHref.startsWith('javascript:')) {
                    finalUrl = btnHref.startsWith('http') ? btnHref : Utils.getServerLink(btnHref);
                    await fetcher.fetch(finalUrl, { method: "GET" });
                    log(`Moving to location of <b>${charName}</b>`, 'info');
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
                            });

                            const postDoc = parser.parseFromString(postHtml, "text/html");
                            const redirectLink = postDoc.querySelector('#ctl00_cphRightColumn_ctl00_lnkInteract')?.getAttribute('href') ||
                                postDoc.querySelector('a[href*="/Locale/MoveToLocale/"]')?.getAttribute('href');

                            if (redirectLink && !redirectLink.startsWith('javascript:')) {
                                finalUrl = redirectLink.startsWith('http') ? redirectLink : Utils.getServerLink(redirectLink);
                            } else {
                                finalUrl = characterUrl;
                            }
                            log(`Moving to location of <b>${charName}</b>`, 'info');
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
                        });

                        const postDoc = parser.parseFromString(postHtml, "text/html");
                        log(`Moving to location of <b>${charName}</b>`, 'info');
                        notifications.getPageNotifications(fetcher);
                        return;
                    }
                }
            }

            const characterPresentation = doc.querySelector('.characterPresentation');
            if (characterPresentation) {
                const links = characterPresentation.querySelectorAll('a');
                if (links.length > 0) {
                    const lastLink = links[links.length - 1];
                    const href = lastLink.getAttribute('href');
                    if (href) {
                        const locationId = href.split('/').pop();
                        if (locationId) {
                            finalUrl = Utils.getServerLink('World/Popmundo.aspx/Locale/MoveToLocale/' + locationId + '/' + charId);
                            await fetcher.fetch(finalUrl, { method: "GET" });
                            log(`Moving to location of <b>${charName}</b>`, 'info');
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
                        });

                        const postDoc = parser.parseFromString(postHtml, "text/html");
                        const redirectLink = postDoc.querySelector('#ctl00_cphRightColumn_ctl00_lnkInteract')?.getAttribute('href') ||
                            postDoc.querySelector('a[href*="/Locale/MoveToLocale/"]')?.getAttribute('href');

                        if (redirectLink && !redirectLink.startsWith('javascript:')) {
                            finalUrl = redirectLink.startsWith('http') ? redirectLink : Utils.getServerLink(redirectLink);
                        } else {
                            finalUrl = characterUrl;
                        }
                        log(`Moving to location of <b>${charName}</b>`, 'info');
                        notifications.getPageNotifications(fetcher);
                        return;
                    }
                }
            }

            if (locationLink && locationLink.includes('/World/')) {
                const relativePath = locationLink.split('/World/')[1];
                if (relativePath) {
                    finalUrl = Utils.getServerLink('World/' + relativePath);
                    await fetcher.fetch(finalUrl, { method: "GET" });
                    log(`Moving to location of <b>${charName}</b>`, 'info');
                    notifications.getPageNotifications(fetcher);
                    return;
                }
            }

            log(`Maybe ${charName} is no longer in the city, or something happened!`, 'warning');

        } catch (error) {
            console.error('Error in goToLocation:', error);
            log(`Error navigating to ${charName}: ${error.message}`, 'error');
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
            const html = await fetcher.fetch(interactUrl, { method: "GET" });

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");

            const select = doc.querySelector('#ctl00_cphTopColumn_ctl00_ddlUseItem');

            if (!select) {
                log(`Apparently <b>${person.name}</b> is no longer available or doesn't allow item usage`);
                const blockedChars = await getBlockedChars();
                if (!blockedChars.includes(person.id)) {
                    blockedChars.push(person.id);
                    await setBlockedChars(blockedChars);
                    log(`Storing char ${person.name} (${person.id}) in storage to not try again.`, 'warning');
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                return { success: false, bookIds: [], skipPerson: true };
            }

            const bookName = await getBookName();
            const fallbackNames = ['Livro de autógrafos', 'Autograph book'];
            const searchNames = bookName ? [bookName, ...fallbackNames] : fallbackNames;

            const options = select.querySelectorAll('option');
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
                log(`Waiting for book cooldown (${Math.ceil(waitMs / 60000)} min remaining)...`, 'info');
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

            log(`Collecting autograph from <b>${person.name}</b> using book ID: ${selectedBookId}`, 'info');
            const urlParams = new URLSearchParams();
            for (const [key, value] of formData.entries()) {
                urlParams.append(key, value);
            }
            await fetcher.fetch(interactUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: urlParams.toString()
            });
            const notification = await notifications.getPageNotifications(fetcher);

            if (notification.Status === "error") {
                log(`Error collecting autograph from ${person.name}: ${notification.Text}`, 'error');
                return { success: false, bookIds };
            }

            await setBookLastUse(selectedBookId, Date.now());

            if (notification.Status === "success") {
                log(`Autograph collected from ${person.name}`, 'success');
            } else if (notification.Status === "normal") {
                log(`Autograph operation completed for ${person.name}`, 'info');
            }

            return { success: true, bookIds };
        } catch (error) {
            console.error('Error in collectAutograph:', error);
            log(`Error collecting autograph from ${person.name}: ${error.message}`, 'error');
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

                timerMessage.text(`Waiting: ${minutesLeft} minutes and ${secondsLeft} seconds remaining...`);

                if (totalSeconds <= 0) {
                    clearInterval(interval);
                    timerMessage.text('Continuing autograph collection...');
                    setTimeout(() => timerMessage.text(''), 2000);
                    resolve();
                }

                totalSeconds--;
            }, 1000);
        });
    }

    // =============================================================================
    // Initialization (DOM ready)
    // =============================================================================

    JQ(document).ready(async function () {
        JQ('#checkedlist').before('<div class="box" id="autografos-box" drinkwater><h2 drinkwater>Collect Autographs</h2></div>');
        JQ('#autografos-box').append('<p drinkwater>The script will use all books in your inventory to collect autographs from popstars present in the city!</p>');

        const settingsUrl = Utils.getServerLink('User/Popmundo.aspx/User/ContentSettings');
        JQ('#autografos-box').append(`
            <div style="background-color: #ffeb3b; border: 3px solid #f57f17; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center;" drinkwater>
                <h3 style="color: #d32f2f; margin-top: 0; font-size: 24px; font-weight: bold;" drinkwater>⚠️ ATTENTION ⚠️</h3>
                <p style="font-size: 18px; font-weight: bold; color: #333; margin: 10px 0;" drinkwater>
                    YOU MUST DISABLE CONFIRMATION POPUPS FOR THE SCRIPT TO WORK PROPERLY!
                </p>
                <p style="font-size: 16px; margin: 15px 0;" drinkwater>
                    <a href="${settingsUrl}" target="_blank" style="color: #1976d2; font-weight: bold; text-decoration: underline; font-size: 18px;" drinkwater>
                        Click here to open content settings
                    </a>
                </p>
            </div>
        `);

        JQ('#autografos-box').append(`
            <div class="actionbuttons" style="margin: 16px 0;" drinkwater>
                <input type="button" name="btn-clear-storage" value="Clear blocked chars" id="limpar-chars" class="cns" title="Clear chars that don't accept item usage from the session storage" drinkwater>
                <input type="submit" name="btn-iniciar-coleta" value="Start" id="inicar-coleta" class="cns" drinkwater>
            </div>
        `);

        JQ('#autografos-box').append('<div id="timer-message" style="font-weight: bold; color: red;" drinkwater></div>');
        JQ('#autografos-box').append('<table id="logs-autografos" class="data dataTable" drinkwater></table>');

        JQ('#logs-autografos').append('<thead drinkwater><tr drinkwater><th drinkwater>Time</th><th drinkwater>Type</th><th drinkwater>Message</th></tr></thead><tbody drinkwater></tbody>');

        const bookName = await getBookName();
        const escaped = bookName.replace(/"/g, '\\"');
        const bookElement = JQ(`#checkedlist a:contains("${escaped}")`);
        if (bookElement.length > 0) {
            const bookQuantity = bookElement.closest('td').find('em').text().trim();
            if (bookQuantity.startsWith('x')) {
                log(`Number of autograph books found: ${parseInt(bookQuantity.substring(1))}`, 'info');
            } else {
                log(`Number of autograph books found: ${bookElement.length}`, 'info');
            }
        } else {
            log('No autograph books found.');
        }

        let lastCycleIds = [];
        let queue = [];

        JQ('#inicar-coleta').click(async function () {
            if (coletaInProgress) return;
            coletaInProgress = true;
            continuaColeta = true;
            JQ('#inicar-coleta').prop('disabled', true);
            JQ('#inicar-coleta').prop('value', 'Collecting Autographs...');
            const esperarSegundos = s => new Promise(r => setTimeout(r, s * 1000));

            while (continuaColeta) {
                try {
                    if (queue.length === 0) {
                        const freshQueue = await getPeopleToCollect();
                        const blockedChars = await getBlockedChars();
                        queue = freshQueue.filter(
                            p => !blockedChars.includes(p.id) && !lastCycleIds.includes(p.id)
                        );

                        if (queue.length === 0) {
                            log('No eligible person found. Will try again in 60 s.', 'warning');
                            await esperarSegundos(60);
                            continue;
                        }
                    }

                    const person = queue[0];
                    await goToLocation(person.id, person.name);

                    const result = await collectAutograph(person);

                    if (result.waitMs > 0) {
                        const waitMin = Math.ceil(result.waitMs / 60000);
                        log(`Cooldown of ${waitMin} min before next use…`);
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
                    log('Error during script execution – check the console.', 'error');
                }
            }

            coletaInProgress = false;
            JQ('#inicar-coleta').prop('disabled', false);
            JQ('#inicar-coleta').prop('value', 'Start');
            log('Autograph collection stopped.');
        });

        JQ('#limpar-chars').click(function () {
            chrome.storage.session.remove(STORAGE_KEYS.BLOCKED_CHARS, () => {
                log('Blocked chars list cleared (session storage).');
            });
        });
    });

})();
