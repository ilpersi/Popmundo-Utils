/**
 * Get day of the year and year number for a specific date.
 *
 * @param {Date} [date=new Date()] The input date
 * @return {{year: number, day: number}} year = Popmundo year number, day = day within that year (1–56)
 */
function getDayDetails(date = new Date()) {
    const YEAR_DAYS = 56;
    const DAY_DURATION = 1000 * 60 * 60 * 24;
    const DAY1 = new Date(2003, 0, 1, 0, 0, 0);

    let yesterday = new Date(date - DAY_DURATION);
    yesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);

    let dayDifference = Math.ceil((yesterday - DAY1) / DAY_DURATION) + 1;
    let yearNumber = Math.ceil(dayDifference / YEAR_DAYS);
    let dayOfYear = parseInt(dayDifference % YEAR_DAYS);
    dayOfYear = dayOfYear === 0 ? 56 : dayOfYear;

    return { year: yearNumber, day: dayOfYear };
}

/**
 * Replace BBCode tags in reminder text with their HTML equivalents.
 * Recognised tags:
 *   [year]                                → current Popmundo year number
 *   [yearday]                             → current day within the Popmundo year
 *   [localeid=NNN name=SSS]               → anchor linking to a locale
 *   [itemdetailsid=NNN name=SSS]          → anchor linking to an item-details page
 * Names containing spaces must be quoted: name="My Name Here"
 *
 * @param {string} text        Raw reminder text with BBCode tags
 * @param {{year: number, day: number}} dayDetails
 * @return {string} HTML string safe for assignment to innerHTML
 */
function parseBBCode(text, dayDetails) {
    let result = text;

    result = result.replace(/\[year\]/g, String(dayDetails.year));
    result = result.replace(/\[yearday\]/g, String(dayDetails.day));

    result = result.replace(
        /\[localeid=(\d+)\s+name=(?:"([^"]*)"|([\S]+))\]/g,
        (_, id, quotedName, unquotedName) => {
            const name = quotedName !== undefined ? quotedName : unquotedName;
            const href = Utils.getServerLink(`/World/Popmundo.aspx/Locale/${id}`);
            return `<a href="${href}">${name}</a>`;
        }
    );

    result = result.replace(
        /\[itemdetailsid=(\d+)\s+name=(?:"([^"]*)"|([\S]+))\]/g,
        (_, id, quotedName, unquotedName) => {
            const name = quotedName !== undefined ? quotedName : unquotedName;
            const href = Utils.getServerLink(`/World/Popmundo.aspx/Locale/ItemDetails/${id}`);
            return `<a href="${href}">${name}</a>`;
        }
    );

    return result;
}

/**
 * Build the instance ID that uniquely identifies one occurrence of a custom reminder.
 * Uses Popmundo year + day so each calendar instance is tracked independently.
 *
 * @param {string} reminderId  The reminder's persistent ID
 * @param {number} year        Current Popmundo year
 * @param {number} day         Current Popmundo day
 * @return {string}
 */
function makeInstanceId(reminderId, year, day) {
    return `${reminderId}-y${year}-d${day}`;
}

/**
 * Extract the Popmundo year embedded in a dismissed instance ID.
 *
 * @param {string} instanceId
 * @return {number|null}
 */
function extractYearFromInstanceId(instanceId) {
    const match = instanceId.match(/-y(\d+)-d\d+$/);
    return match ? parseInt(match[1]) : null;
}

/**
 * Remove dismissed entries whose Popmundo year is more than 1 year behind the current one.
 *
 * @param {string[]} dismissed   Array of dismissed instance IDs
 * @param {number}   currentYear Current Popmundo year
 * @return {string[]} Cleaned array
 */
function cleanupDismissedReminders(dismissed, currentYear) {
    return dismissed.filter(id => {
        const year = extractYearFromInstanceId(id);
        return year === null || (currentYear - year) <= 1;
    });
}

/**
 * Create and display a reminder notification via the Notifications class.
 *
 * @param {Notifications} notifications
 * @param {string}        notifId   HTML id for the notification div
 * @param {string}        html      Inner HTML content (may contain anchor tags)
 * @return {Element|null}
 */
function showReminderNotification(notifications, notifId, html) {
    const node = notifications.notifySuccess(notifId);
    if (node) node.innerHTML = html;
    return node;
}

function checkReminders() {
    const dateDetails = getDayDetails();
    const jsDay = new Date().getDay(); // 0 = Sunday
    const isoDay = jsDay === 0 ? 7 : jsDay; // ISO: 1 = Monday … 7 = Sunday

    const STORAGE_DEFAULTS = {
        timers: {},
        user_reminders: [],
        dismissed_reminders: [],
        reminders_show_timers: true,
    };

    // ------------------------------------------------------------------
    // Single DOM event handler for dismiss and navigate actions.
    // Notification links dispatch 'pmUtilsReminder' via click delegation
    // below; this listener performs the actual storage updates.
    // ------------------------------------------------------------------
    document.addEventListener('pmUtilsReminder', function (e) {
        const { action, reminderId, itemId } = e.detail;

        if (action === 'dismiss') {
            // Remove the notification element immediately
            const notifEl = document.getElementById(`reminder-${reminderId}`);
            if (notifEl) notifEl.remove();

            if (reminderId.startsWith('timer-')) {
                // Timer reminder: delete the entry from the timers storage key
                const parts = reminderId.split('-');
                const charId = parts[1];
                const tItemId = parts[2];
                chrome.storage.sync.get({ timers: {} }).then(data => {
                    if (data.timers[charId] && data.timers[charId][tItemId]) {
                        delete data.timers[charId][tItemId];
                        chrome.storage.sync.set({ timers: data.timers });
                    }
                });
            } else {
                // Custom reminder: persist this instance as dismissed
                chrome.storage.sync.get({ dismissed_reminders: [] }).then(data => {
                    const instanceId = makeInstanceId(reminderId, dateDetails.year, dateDetails.day);
                    const cleaned = cleanupDismissedReminders(data.dismissed_reminders, dateDetails.year);
                    if (!cleaned.includes(instanceId)) {
                        cleaned.push(instanceId);
                        chrome.storage.sync.set({ dismissed_reminders: cleaned });
                    }
                });
            }

        } else if (action === 'navigate') {
            // Timer reminder: dismiss the entry and redirect to the item-details page
            const parts = reminderId.split('-');
            const charId = parts[1];
            const actualItemId = itemId || parts[2];
            chrome.storage.sync.get({ timers: {} }).then(data => {
                if (data.timers[charId] && data.timers[charId][actualItemId]) {
                    delete data.timers[charId][actualItemId];
                    chrome.storage.sync.set({ timers: data.timers });
                }
            });
            window.location.href = Utils.getServerLink(`/World/Popmundo.aspx/Character/ItemDetails/${actualItemId}`);
        }
    });

    chrome.storage.sync.get(STORAGE_DEFAULTS).then(items => {
        const notifications = new Notifications();
        const isGH = Utils.isGreatHeist();
        const myID = Utils.getMyID();
        const nowTimestamp = Date.now();
        const todayStr = chrome.i18n.getMessage('remTodayIs', [String(dateDetails.day), String(dateDetails.year)]);
        const dismissLabel = chrome.i18n.getMessage('remDismissLink');

        // Clean up stale dismissed entries and rebuild the lookup set
        const cleanedDismissed = cleanupDismissedReminders(items.dismissed_reminders, dateDetails.year);
        if (cleanedDismissed.length !== items.dismissed_reminders.length) {
            chrome.storage.sync.set({ dismissed_reminders: cleanedDismissed });
        }
        const dismissedSet = new Set(cleanedDismissed);

        // ------------------------------------------------------------------
        // Custom reminders
        // ------------------------------------------------------------------
        items.user_reminders.forEach(reminder => {
            if (!reminder.active) return;
            if (isGH && !reminder.forGreatHeist) return;
            if (!isGH && !reminder.forPopmundo) return;

            const fires = (reminder.type === 'yearday' && reminder.dayValue === dateDetails.day)
                       || (reminder.type === 'weekday' && reminder.dayValue === isoDay);
            if (!fires) return;

            const instanceId = makeInstanceId(reminder.id, dateDetails.year, dateDetails.day);
            if (dismissedSet.has(instanceId)) return;

            const parsedText = parseBBCode(reminder.text, dateDetails);
            const dismissHref = `<a href="#" data-pm-action="dismiss" data-pm-rid="${reminder.id}">${dismissLabel}</a>`;
            showReminderNotification(
                notifications,
                `reminder-${reminder.id}`,
                `${todayStr} ${parsedText} ${dismissHref}`
            );
        });

        // ------------------------------------------------------------------
        // Timer reminders
        // ------------------------------------------------------------------
        if (items.reminders_show_timers && items.timers[myID]) {
            const useLabel = chrome.i18n.getMessage('remUseLink');

            Object.entries(items.timers[myID]).forEach(([itemID, itemDetails]) => {
                if (nowTimestamp < itemDetails.timerTimeStamp) return;

                const reminderId = `timer-${myID}-${itemID}`;
                const itemReadyText = chrome.i18n.getMessage('remItemReady', [itemDetails.name]);
                const navHref = `<a href="#" data-pm-action="navigate" data-pm-rid="${reminderId}" data-pm-iid="${itemID}">${useLabel}</a>`;
                const dismissHref = `<a href="#" data-pm-action="dismiss" data-pm-rid="${reminderId}">${dismissLabel}</a>`;
                showReminderNotification(
                    notifications,
                    `reminder-${reminderId}`,
                    `${itemReadyText} ${navHref} or ${dismissHref}.`
                );
            });
        }

        // ------------------------------------------------------------------
        // Click delegation: intercept action links inside the notifications
        // container and dispatch the pmUtilsReminder custom event.
        // ------------------------------------------------------------------
        const notifContainer = document.getElementById('notifications');
        if (notifContainer) {
            notifContainer.addEventListener('click', function (e) {
                const link = e.target.closest('[data-pm-action]');
                if (!link) return;
                e.preventDefault();
                document.dispatchEvent(new CustomEvent('pmUtilsReminder', {
                    detail: {
                        action: link.dataset.pmAction,
                        reminderId: link.dataset.pmRid,
                        itemId: link.dataset.pmIid || null,
                    }
                }));
            });
        }
    });
}

checkReminders();
