/**
 * This function will check if any notification with delay is present at the top of the page and it will use it
 * to generate reminders for users.
 *
 */
async function checkForTimer() {

    // We initialize the varibles we need later on
    let errors;
    let notifications = new Notifications();
    errors = notifications.getErrorsAsText();

    // debugger;

    // Maybe a timer is there
    if (errors.length > 0) {
        // console.log('Found ' + errors.length + ' errors');
        // Timings
        const SECOND = 1000;
        const MINUTE = SECOND * 60;
        const HOUR = MINUTE * 60;
        const DAY = HOUR * 24;
        const WEEK = DAY * 7;

        // Timer Regex
        const minRegex = new RegExp(chrome.i18n.getMessage('itMinRegex'), "i");
        const hourRegex = new RegExp(chrome.i18n.getMessage('itHourRegex'), "i");
        const daysRegex = new RegExp(chrome.i18n.getMessage('itDaysRegex'), "i");
        const weeksRegex = new RegExp(chrome.i18n.getMessage('itWeeksRegex'), "i");

        // URL Regex for item id
        const itemIDRegex = /\d{2}.popmundo.com\/World\/Popmundo.aspx\/Character\/ItemDetails\/(\d+)/gi;

        // Settings KEY
        const TIMERS_STORAGE_VALUE = { 'timers': {} };
        const LAST_USED_ITEM_ID = { 'lastUseditemID': 0 };

        let itemID = 0;
        // If we are on the items page we need to get the last used item ID from the cache
        if (window.location.href.includes('Character/Items/')) {

            let lastUsedDetails = await chrome.runtime.sendMessage({
                'type': 'storage.session',
                'payload': 'get',
                'param': LAST_USED_ITEM_ID,
            });
            itemID = lastUsedDetails.lastUseditemID;
            // console.log('used item id loaded from cache: ' + itemID);

            // We reset the last used id
            await chrome.runtime.sendMessage({
                'type': 'storage.session',
                'payload': 'set',
                'param': { "lastUseditemID": 0 },
            });
        } else {
            // If we are on a specific item, we use the URL to get the ID
            let idMatch = itemIDRegex.exec(window.location.href);
            itemID = idMatch ? parseInt(idMatch[1]) : 0;
        }

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
            let minutes = minMatch ? parseInt(minMatch[1]) : 0;
            let hours = hourMatch ? parseInt(hourMatch[1]) : 0;
            let days = daysMatch ? parseInt(daysMatch[1]) : 0;
            let weeks = weeksMatch ? parseInt(weeksMatch[1]) : 0;

            // console.log(`Timer for id ${itemID}: ${weeks} weeks, ${days} days, ${hours} hours, ${minutes} minutes`);

            // We only update the timer when we find something
            if (minutes > 0 || hours > 0 || days > 0 || weeks > 0) {

                // we round minutes and hours to avoid any false notification
                if (minutes > 0) minutes += 1;
                if (hours > 0 && minutes == 0) hours += 1;
                if (days > 0 && hours == 0 && minutes == 0) days += 1;

                // We add duration to current time
                let nowTimeStamp = now.getTime();
                let timerTimeStamp = nowTimeStamp + (weeks * WEEK) + (days * DAY) + (hours * HOUR) + (minutes * MINUTE);

                // We add a 2 seconds buffer
                timerTimeStamp += (2 * SECOND);

                // Timer was found for the item, we make sure that values are updated in the database
                if (timerTimeStamp > nowTimeStamp) {

                    let itemName = '';
                    if (window.location.href.includes('Character/Items/')) {
                        // We use XPATH to get the item name. This will be used in the notification message.
                        let xpathHelper = new XPathHelper('//a[@href="/World/Popmundo.aspx/Character/ItemDetails/' + itemID + '"]');
                        let itemNameNode = xpathHelper.getFirstOrderedNode(document);
                        itemName = itemNameNode.singleNodeValue.textContent;

                    } else {
                        // We use XPATH to get the item name. This will be used in the notification message.
                        let xpathHelper = new XPathHelper('//div[@class="content"][1]/div[@class="box"][1]/h2');
                        let itemNameNode = xpathHelper.getFirstOrderedNode(document);
                        itemName = itemNameNode.singleNodeValue?.textContent ?? '';
                    }

                    // We make sure that a key is present for the current character
                    if (!timers.hasOwnProperty(myID)) timers[myID] = {};

                    // We update the timer for the current items
                    if (itemID != 0 && itemName != '')
                        timers[myID][itemID] = { 'timerTimeStamp': timerTimeStamp, 'name': itemName, 'now': nowTimeStamp };
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
        // console.log(html);
    });

    btnNode.click();
}

/**
 * Onclick event handler for the ⏱ span injected by injectUseAndTimerList(). Mirrors
 * timerOnClick() but adapted for type="image" inputs: sets .x/.y coordinates so that
 * background.js can derive the item ID from the intercepted request body.
 *
 * @param {HTMLInputElement} btnNode - The original Use/Tune image input.
 */
async function timerOnClickList(btnNode) {

    let docForm = document.getElementById('aspnetForm');
    let formData = new FormData(docForm);
    let btnName = btnNode.getAttribute('name');
    formData.set(btnName + '.x', '0');
    formData.set(btnName + '.y', '0');

    await fetch(location.href, {
        "body": formData,
        "method": "POST",
    }).then((response) => {
        if (response.ok && response.status >= 200 && response.status < 300) {
            return response.text();
        }
    }).then((_html) => { });

    await Utils.sleep(750);
    btnNode.click();
}

/**
 * Injects a ⏱ span next to each Use/Tune image button on the item list page.
 * Clicking the span triggers the same double-submission flow as the detail page button.
 */
async function injectUseAndTimerList(fontSize) {

    const USE_BTN_SELECTOR = "input[type='image'][title='Use'][src*='Static/Icons/Item_Use'], input[type='image'][title='Tune'][src*='Static/Icons/Item_Tune']";
    let btnHelper = new CssSelectorHelper(USE_BTN_SELECTOR);
    let btnResults = btnHelper.getAll();

    for (let btnNode of btnResults) {

        let timerSpan = document.createElement('span');
        timerSpan.textContent = '⚡';
        timerSpan.setAttribute('title', btnNode.getAttribute('title') + chrome.i18n.getMessage('itTimerButtonSuffix'));
        timerSpan.style.cssText = `font-size:${fontSize}px; cursor:pointer; margin-left:3px; user-select:none;`;
        timerSpan.onclick = () => { timerOnClickList(btnNode); return false; };

        btnNode.parentNode.insertBefore(timerSpan, btnNode.nextSibling);
    }
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
        newBtn.setAttribute('value', btnNode.getAttribute('value') + chrome.i18n.getMessage('itTimerButtonSuffix'));
        newBtn.setAttribute('class', btnNode.getAttribute('class'));

        btnNode.parentNode.insertBefore(newBtn, btnResult.nextSibling);
        newBtn.onclick = () => { timerOnClick(btnNode); return false; };
    }
}

async function drawTimerIcon(items) {
    // Emoji icons for the clock
    const TIMER_WARN_ICON = '⏰';
    const TIMER_OK_ICON = '⏳';

    // XPaths required by the logic
    const ITEM_TR_XPATH = "//tr[contains(@id, 'trItemGroup')]";
    const ITEM_A_XPATH = "./td[2]/a";
    const ITEM_ICON_XPATH = "./td[3]";

    // We get the Character ID, we'll use this to check the timers
    let myID = Utils.getMyID();

    // Current Character has saved timers
    if (items.timers.hasOwnProperty(myID)) {

        // My char timers
        let myTimers = items.timers[myID];

        // Let's find item rows
        let trXpathHelper = new XPathHelper(ITEM_TR_XPATH);
        let trXpathResult = trXpathHelper.getUnorderedNodeSnapshot(document);

        // Let's loop on the found rows
        for (let trCnt = 0; trCnt < trXpathResult.snapshotLength; trCnt++) {
            let trNode = trXpathResult.snapshotItem(trCnt);

            // We need to get Items IDs  and to do so we look on links
            let aXpathHelper = new XPathHelper(ITEM_A_XPATH);
            let aXpathResult = aXpathHelper.getAnyUnorderedNode(trNode);

            if (aXpathResult.singleNodeValue) {
                // The item ID is part of the href attribute
                let aNode = aXpathResult.singleNodeValue;
                let href = aNode.getAttribute('href');

                let itemIDRegex = new RegExp("/World/Popmundo.aspx/Character/ItemDetails/(\\d{1,})", "i");
                let itemIDMatch = itemIDRegex.exec(href);

                // Regex matches, item id has been found!
                if (itemIDMatch) {
                    let itemID = parseInt(itemIDMatch[1]);
                    
                    // Do we have saved timers for the current item?
                    if (myTimers.hasOwnProperty(itemID)) {

                        // Let's draw the the icon in the last TD
                        let icontXpathHelper = new XPathHelper(ITEM_ICON_XPATH);
                        let iconXpathResult = icontXpathHelper.getAnyUnorderedNode(trNode);

                        if (iconXpathResult.singleNodeValue) {
                            let timerDate = new Date(myTimers[itemID]['timerTimeStamp']);
                            let nowTime = new Date();

                            let iconTXT = nowTime >= timerDate ? TIMER_WARN_ICON : TIMER_OK_ICON;
                            let dateTXT = "" + timerDate;
                            if (nowTime >= timerDate) dateTXT = chrome.i18n.getMessage('iltTimerExpired') + dateTXT;

                            let newIcon = document.createElement('span');
                            newIcon.textContent = iconTXT;
                            newIcon.setAttribute('title', dateTXT);
                            newIcon.style.cssText = `font-size:${items.enhanced_links_font_size}px; cursor:help; margin-left:5px; user-select:none;`;
                            iconXpathResult.singleNodeValue.appendChild(newIcon);
                        }
                    }
                }


            }

        }
    }

}

// If we are on a specific item page, we inject "Use and Timer" button
if (!window.location.href.includes('Character/Items/')) {
    injectUseAndTimer();
} else {
    (async () => {
        let items = await chrome.storage.sync.get({ 'timers': {}, 'enhanced_links_font_size': 16 });
        drawTimerIcon(items);
        injectUseAndTimerList(items.enhanced_links_font_size);
    })();
}

let maxIntervalCnt = 1;

let intervalID = setInterval(async () => {
    // console.log("Interval run: " + maxIntervalCnt);

    // After 10 attempts we cancell the interval
    if (maxIntervalCnt > 10) {
        // console.log("Max attempts, cancellin intervall.");
        clearInterval(intervalID);
    }

    // We make sure notifications are not loading
    let notifications = new Notifications();
    if (!notifications.areLoading()) {
        // console.log("Notifications found, cancelling interval.");
        clearInterval(intervalID);
        await checkForTimer();
    }

    maxIntervalCnt += 1;
}, 500)


