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
    // debugger;
    let myID = Utils.getMyID();

    let s = document.createElement('script');
    s.src = chrome.runtime.getURL('/injected-js/reminders-injected.js');
    s.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(s);

    document.addEventListener('deleteAndredirect', function (e) {
        // debugger;
        let data = e.detail;

        chrome.storage.sync.get(TIMERS_STORAGE_VALUE)
            .then((items) => {
                if (items.timers.hasOwnProperty(data.characterID)) {
                    let timers = items.timers;

                    if (timers.hasOwnProperty(myID)) {
                        if (timers[myID].hasOwnProperty(data.itemID)) {
                            delete timers[myID][data.itemID];
                            chrome.storage.sync.set({ "timers": timers }, null);
                        }
                    }
                }
            });

        // https://74.popmundo.com/World/Popmundo.aspx/Character/ItemDetails/12345
        let itemHREF = `http://${window.location.host}/World/Popmundo.aspx/Character/ItemDetails/${data.itemID}`;
        window.location.href = itemHREF;

    });

    // Storage key for item timers
    const TIMERS_STORAGE_VALUE = { 'timers': {} };

    let dateDetails = getDayDetails();
    let todayStr = `Today is day ${dateDetails.day} of year ${dateDetails.year}.`;

    const REMINDERS = [
        // { dayNumber: 26, reminder: `Test day 26.` },
        { dayNumber: 27, reminder: `Remember to get Stockholm cemetery to get 2 experince points.` },
        { dayNumber: 28, reminder: `Is the Day of the Dead!` },
        { dayNumber: 40, reminder: `Is St Kobe's Day! Investigate the Statues of Celestial Beauty in Johannesburg, Moscow, Singapore, and Tromsø to go on a adventurous quest for improved music genre skills.` },
        { dayNumber: 48, reminder: `Remember to user your Halloween Horror!` },
        { dayNumber: 52, reminder: `Is Chirsmast!` },
        { dayNumber: 54, reminder: `Remember to wear your Marvin T-Shirt to increase your star quality and get one experince point.` },
    ];

    let notificationData = [];
    REMINDERS.forEach((info) => {
        if (info.dayNumber == dateDetails.day) {
            let details = {
                type: 'text',
                content: `${todayStr} ${info.reminder}`,
            };

            notificationData.push(details);
        }
    });

    chrome.storage.sync.get(TIMERS_STORAGE_VALUE)
        .then((items) => {
            // debugger;

            let nowTimeStamp = Date.now();

            if (items.timers.hasOwnProperty(myID)) {
                let timers = items.timers[myID];

                for (const [itemID, itemDetails] of Object.entries(timers)) {
                    if (nowTimeStamp < itemDetails.timerTimeStamp) continue;

                    let details = {
                        type: 'html',
                        content: `Your ${itemDetails.name} is ready to be used. <a id='${itemID}' onclick='deleteAndredirect(${myID}, ${itemID})'>Use</a>.`,
                    };

                    notificationData.push(details);
                }
            }

            let notifications = new Notifications();
            notifications.deleteAll();

            notificationData.forEach((details) => {
                if ('text' === details.type)
                    notifications.notifySuccess(details.content);
                else if ('html' === details.type) {
                    let notificationNode = notifications.notifySuccess();
                    notificationNode.innerHTML = details.content;
                }
            });
        });
}

checkReminders();