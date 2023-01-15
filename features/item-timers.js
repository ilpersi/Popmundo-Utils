/**
 * This function will check if any notification with delay is present at the top of the page and it will use it
 * to generate reminders for users.
 *
 */
function checkForTimer() {
    // Settings KEY
    const TIMERS_STORAGE_VALUE = { 'timers': {} };

    // Timer Regex
    const minRegex = /(\d{1,})\s+minutes/gi;
    const hourRegex = /(\d{1,})\s+hours/gi;
    const daysRegex = /(\d{1,})\s+days/gi;
    const weeksRegex = /(\d{1,})\s+weeks/gi;

    // Timings
    const SECOND = 1000;
    const MINUTE = SECOND * 60;
    const HOUR = MINUTE * 60;
    const DAY = HOUR * 24;
    const WEEK = DAY * 7;

    // URL Regex for item id
    const itemIDRegex = /\d{2}.popmundo.com\/World\/Popmundo.aspx\/Character\/ItemDetails\/(\d+)/gi;

    // XPath for Item name
    const ITEM_NAME_XPATH = '//div[@class="content"][1]/div[@class="box"][1]/h2';

    // We initialize the varibles we need later on
    let minutes, hours, days, weeks, itemID;

    // We get the timer
    let notifications = new Notifications();
    let errors = notifications.getErrorsAsText();

    // Maybe a timer is there
    if (errors.length > 0) {
        let idMatch = itemIDRegex.exec(window.location.href);
        itemID = idMatch ? parseInt(idMatch[1]) : 0;

        // We loop trough the notifications searching for timers
        errors.forEach(errorTxt => {
            let now = new Date();

            // We apply all the regexes
            let minMatch = minRegex.exec(errorTxt);
            let hourMatch = hourRegex.exec(errorTxt);
            let daysMatch = daysRegex.exec(errorTxt);
            let weeksMatch = weeksRegex.exec(errorTxt);

            // We check for values and default to 0
            minutes = minMatch ? parseInt(minMatch[1]) : 0;
            days = daysMatch ? parseInt(daysMatch[1]) : 0;
            hours = hourMatch ? parseInt(hourMatch[1]) : 0;
            weeks = weeksMatch ? parseInt(weeksMatch[1]) : 0;

            // console.log(`Timer for id ${itemID}: ${weeks} weeks, ${days} days, ${hours} hours, ${minutes} minutes`);

            // We add duration to current time
            let nowTimeStamp = now.getTime();
            let timerTimeStamp = nowTimeStamp + (weeks * WEEK) + (days * DAY) + (hours * HOUR) + (minutes * MINUTE);

            // We add a 2 seconds buffer
            timerTimeStamp += (2 * SECOND);

            // Timer was found for the item, we make sure that values are updated in the database
            if (timerTimeStamp > nowTimeStamp) {
                chrome.storage.sync.get(TIMERS_STORAGE_VALUE, items => {
                    // My ID
                    let myID = Utils.getMyID();

                    // We use XPATH to get the item name. This will be used in the notification message.
                    let xpathHelper = new XPathHelper(ITEM_NAME_XPATH);
                    let itemNameNode = xpathHelper.getFirstOrderedNode(document);

                    // Saved Timers
                    let timers = items.timers;

                    // We make sure that a key is present for the current character
                    if (!timers.hasOwnProperty(myID)) timers[myID] = {};

                    // We update the timer for the current items
                    timers[myID][itemID] = { 'timerTimeStamp': timerTimeStamp, 'name': itemNameNode.singleNodeValue.textContent, 'now': nowTimeStamp };
                    chrome.storage.sync.set({ "timers": timers }, null);

                })
            }

        });
    }

}

// Notifications may take some seconds to be loaded, so we wait a couple of seconds before checking for them
window.setTimeout(() => { checkForTimer(); }, 2000);