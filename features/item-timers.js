/**
 * This function will check if any notification with delay is present at the top of the page and it will use it
 * to generate reminders for users.
 *
 */
async function checkForTimer() {
    // Settings KEY
    const TIMERS_STORAGE_VALUE = { 'timers': {} };

    // Timer Regex
    const minRegex = new RegExp("(\\d{1,})\\s+minutes", "i");
    const hourRegex = new RegExp("(\\d{1,})\\s+hours", "i");
    const daysRegex = new RegExp("(\\d{1,})\\s+days", "i");
    const weeksRegex = new RegExp("(\\d{1,})\\s+weeks", "i");

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

        // My ID
        let myID = Utils.getMyID();

        // Current saved timers
        let items = await chrome.storage.sync.get(TIMERS_STORAGE_VALUE);
        let timers = items.timers;

        // We loop trough the notifications searching for timers
        errors.forEach((errorTxt) => {
            let now = new Date();

            // We apply all the regexes
            let minMatch = minRegex.exec(errorTxt);
            let hourMatch = hourRegex.exec(errorTxt);
            let daysMatch = daysRegex.exec(errorTxt);
            let weeksMatch = weeksRegex.exec(errorTxt);

            // We check for values and default to 0
            minutes = minMatch ? parseInt(minMatch[1]) : 0;
            hours = hourMatch ? parseInt(hourMatch[1]) : 0;
            days = daysMatch ? parseInt(daysMatch[1]) : 0;
            weeks = weeksMatch ? parseInt(weeksMatch[1]) : 0;

            // console.log(`Timer for id ${itemID}: ${weeks} weeks, ${days} days, ${hours} hours, ${minutes} minutes`);
            
            // We only update the timer when we find something
            if (minutes > 0 || hours > 0 || days > 0 || weeks > 0) {
                // We add duration to current time
                let nowTimeStamp = now.getTime();
                let timerTimeStamp = nowTimeStamp + (weeks * WEEK) + (days * DAY) + (hours * HOUR) + (minutes * MINUTE);
    
                // We add a 2 seconds buffer
                timerTimeStamp += (2 * SECOND);
    
                // Timer was found for the item, we make sure that values are updated in the database
                if (timerTimeStamp > nowTimeStamp) {
    
                    // We use XPATH to get the item name. This will be used in the notification message.
                    let xpathHelper = new XPathHelper(ITEM_NAME_XPATH);
                    let itemNameNode = xpathHelper.getFirstOrderedNode(document);
    
                    // We make sure that a key is present for the current character
                    if (!timers.hasOwnProperty(myID)) timers[myID] = {};
    
                    // We update the timer for the current items
                    timers[myID][itemID] = { 'timerTimeStamp': timerTimeStamp, 'name': itemNameNode.singleNodeValue.textContent, 'now': nowTimeStamp };
                }
            }
        });

        await chrome.storage.sync.set({ "timers": timers });
    }
}

/**
 * Onclick event handler for the HTML button injected by the injectUseAndTimer() fundtion. When
 * this new button is clicked the method will mock a form submission using a fetch call and then
 * it will click the normal button so that the standard item timer logic is triggered
 *
 * @param {*} btnNode - The orginal Use/Tune button.
 */
async function timerOnClick(btnNode) {

    let docForm = document.getElementById('aspnetForm');
    let formData = new FormData(docForm);
    formData.set(btnNode.getAttribute('name'), btnNode.getAttribute('value'));

    let bgFetch = await fetch(location.href, {
        "body": formData,
        "method": "POST",
    }).then((response) => {
        if (response.ok && response.status >= 200 && response.status < 300) {
            return response.text();
        }
    }).then((html) => {
        console.log(html);
    });
    
    btnNode.click();
}

/**
 * This function will inject the "Use & Timer" button on the page
 *
 */
async function injectUseAndTimer() {

    // The standard Use/Tune button
    const USE_BTN_XPATH = "//input[@type='submit' and contains(@name, 'ItemUse')]";
    let btnXPathHelper = new XPathHelper(USE_BTN_XPATH);
    let btnResult = btnXPathHelper.getAnyUnorderedNode(document);

    if (btnResult.singleNodeValue) {
        let btnNode = btnResult.singleNodeValue;

        let newBtn = document.createElement('input');
        newBtn.setAttribute('type', 'submit');
        newBtn.setAttribute('name', btnNode.getAttribute('name'));
        newBtn.setAttribute('value', btnNode.getAttribute('value') + ' & Timer');
        newBtn.setAttribute('class', btnNode.getAttribute('class'));

        btnNode.parentNode.insertBefore(newBtn, btnResult.nextSibling);
        newBtn.onclick = () => { timerOnClick(btnNode); return false; };
    }
}

// Notifications may take some seconds to be loaded, so we wait a couple of seconds before checking for them
window.setTimeout(() => { checkForTimer(); }, 2000);
injectUseAndTimer();
