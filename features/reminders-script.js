/**
 * Get day of the year and year number for a specific data
 *
 * @param {Date} [date=new Date()] The input date 
 * @return {object} An object with two keys 'year' for the number of the year and 'day' for the number of the day
 */
function getDayDetails(date = new Date()) {

    const YEAR_DAYS = 56;
    const DAY_DURATION = 1000 * 60 * 60 * 24;
    const DAY1 = new Date(2003, 0, 1, 0, 0, 0);

    let yesterday = new Date(date - DAY_DURATION);
    // we make sure we do not include current day in computations
    yesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);

    // We cound the difference in days sinche the beginning. We make sure to add one to include today in the computation
    let dayDifference = Math.ceil((yesterday - DAY1) / (DAY_DURATION)) + 1;
    let yearNumber = Math.ceil(dayDifference / YEAR_DAYS);

    // As we use module operator, on day 56 we get 0
    let dayOfYear = parseInt(dayDifference % YEAR_DAYS);
    dayOfYear = dayOfYear === 0 ? 56 : dayOfYear;

    // console.log('Day ' + dayOfYear + ' of year ' + yearNumber);
    return { year: yearNumber, day: dayOfYear };

}

function checkReminders() {

    // Only possible workaround to inject custom scripts via content scripts
    // It is not the best solution, but what happens is that the injected script will trigger a custom deleteAndredirect used later on in the script
    let s = document.createElement('script');
    s.src = chrome.runtime.getURL('/injected-js/reminders-injected.js');
    s.onload = function() { this.remove(); };
    (document.head || document.documentElement).appendChild(s);

    // Custom event triggered by the injected script
    document.addEventListener('deleteAndredirect', function (e) {
        let data = e.detail;

        chrome.storage.sync.get(TIMERS_STORAGE_VALUE)
            .then((items) => {

                // Is character id present?
                if (items.timers.hasOwnProperty(data.characterID)) {
                    let timers = items.timers;

                    // Is the item id present in the storage?
                    if (timers[data.characterID].hasOwnProperty(data.itemID)) {
                        delete timers[data.characterID][data.itemID];
                        chrome.storage.sync.set({ "timers": timers }, null);
                    }
                }
            });

        if (data.redirect) {
            // https://74.popmundo.com/World/Popmundo.aspx/Character/ItemDetails/12345
            let itemHREF = Utils.getServerLink(`/World/Popmundo.aspx/Character/ItemDetails/${data.itemID}`);
            window.location.href = itemHREF;
        } else {
            // We should delete the notification
        }
    });

    // Storage key for item timers
    const TIMERS_STORAGE_VALUE = { 'timers': {} };

    let dateDetails = getDayDetails();
    let todayStr = chrome.i18n.getMessage('remTodayIs', [String(dateDetails.day), String(dateDetails.year)]);

    const REMINDERS = [
        // { dayNumber: 26, reminder: `Test day 26.` },
        { dayNumber: 27, id: `day-27-${dateDetails.year}`, type: 'html', reminder: `Remember to visit <a href="${Utils.getServerLink('/World/Popmundo.aspx/Locale/4141')}">Stockholm's Graveyard</a> and use the <a href="${Utils.getServerLink('/World/Popmundo.aspx/Locale/ItemDetails/103487217')}">Frank Blomdahl Minneslund</a> Monolith to get 3 experince points.` },
        { dayNumber: 28, id: `day-28-${dateDetails.year}`, type: 'text', reminder: chrome.i18n.getMessage('remDay28') },
        { dayNumber: 40, id: `day-40-${dateDetails.year}`, type: 'text', reminder: chrome.i18n.getMessage('remDay40') },
        { dayNumber: 48, id: `day-48-${dateDetails.year}`, type: 'text', reminder: chrome.i18n.getMessage('remDay48') },
        { dayNumber: 52, id: `day-52-${dateDetails.year}`, type: 'text', reminder: chrome.i18n.getMessage('remDay52') },
        { dayNumber: 54, id: `day-54-${dateDetails.year}`, type: 'text', reminder: chrome.i18n.getMessage('remDay54') },
    ];

    if (Utils.isGreatHeist()) {
        let nowDate = new Date();
        
        if (nowDate.getDay() == 4) {
            let cardReminder = {
                dayNumber: dateDetails.day,
                id: `tgh-card-day-${dateDetails.year}-${dateDetails.day}`,
                type: 'text',
                reminder: chrome.i18n.getMessage('remThursdayCards'),
            };

            REMINDERS.push(cardReminder);
        } 

    }

    let notificationData = [];
    REMINDERS.forEach((info) => {
        if (info.dayNumber == dateDetails.day) {
            let details = {
                id: info.id,
                type: info.type,
                content: `${todayStr} ${info.reminder}`,
            };

            notificationData.push(details);
        }
    });

    chrome.storage.sync.get(TIMERS_STORAGE_VALUE)
        .then((items) => {

            let nowTimeStamp = Date.now();
            let myID = Utils.getMyID();

            if (items.timers.hasOwnProperty(myID)) {
                let timers = items.timers[myID];

                for (const [itemID, itemDetails] of Object.entries(timers)) {
                    if (nowTimeStamp < itemDetails.timerTimeStamp) continue;

                    let details = {
                        id: itemID,
                        type: 'html',
                        content: `${chrome.i18n.getMessage('remItemReady', [itemDetails.name])} <a id='item-${itemID}' onclick='deleteAndredirect(${myID}, ${itemID}, true)'>${chrome.i18n.getMessage('remUseLink')}</a>
                        or <a id='${itemID}' onclick='deleteAndredirect(${myID}, ${itemID}, false)'>${chrome.i18n.getMessage('remDismissLink')}</a>.`,
                    };

                    notificationData.push(details);
                }
            }

            let notifications = new Notifications();
            // notifications.deleteAll();

            notificationData.forEach((details) => {
                if ('text' === details.type)
                    notifications.notifySuccess(details.id, details.content);
                else if ('html' === details.type) {
                    let notificationNode = notifications.notifySuccess(details.id);
                    notificationNode.innerHTML = details.content;
                }
            });
        });
}

checkReminders();