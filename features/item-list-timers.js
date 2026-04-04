/**
 * This function will take care of drawing a small clock close to the items that currently hold a timer
 *
 */
async function drawTimerIcon() {
    // Emoji icons for the clock
    const TIMER_WARN_ICON = '⏰';
    const TIMER_OK_ICON = '⏳';

    // XPaths required by the logic
    const ITEM_TR_XPATH = "//tr[contains(@id, 'trItemGroup')]";
    const ITEM_A_XPATH = "./td[2]/a";
    const ITEM_ICON_XPATH = "./td[3]";

    // We get the Character ID, we'll use this to check the timers
    let myID = Utils.getMyID();

    // We get the saved timers
    let items = await chrome.storage.sync.get({ 'timers': {}, 'enhanced_links_font_size': 16 });
    
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

drawTimerIcon();