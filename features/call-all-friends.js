/**
 * This async function is triggered when the user clicks on the "Call all relations" button
 *
 */
async function onSubmitClick() {

    const optionsGet = {
        'call_all_wazzup': true,   // 24
        'call_all_prank': false,   // 26
        'call_all_sms_pic': false, // 58
        'call_all_sms_txt': false, // 61
        'call_all_gossip': false,  // 121
        'call_exclude_id': [],
    }

    const optionsMap = {
        'call_all_wazzup': 24,
        'call_all_prank': 26,
        'call_all_sms_pic': 58,
        'call_all_sms_txt': 61,
        'call_all_gossip': 121,
    }

    // The script will randomly choose one of the following interactions
    let INTERACTIONS = [];

    // We build the array of possible interactions based on the saved options
    let savedOptions = await chrome.storage.sync.get(optionsGet);
    for (let optionName in optionsMap) {
        if (savedOptions.hasOwnProperty(optionName)) {
            if (savedOptions[optionName])
                INTERACTIONS.push(optionsMap[optionName]);
        }
    }

    // CSS Selector used to search friend id in the relationship page
    const RELATIONS_SELECTOR = 'td > a[href*="/World/Popmundo.aspx/Character/"]';
    // Regex to extract the character friend id from the href of a elems
    const RELATIONS_ID_RE = /\/World\/Popmundo.aspx\/Character\/(\d+)/g

    // We search for friend ID in the relationship page
    let relationsNodes = new CssSelectorHelper(RELATIONS_SELECTOR).getAll();

    // Support both old integer array format and new [{id, name}] format
    const excludedIds = savedOptions.call_exclude_id.map(e => typeof e === 'object' ? e.id : e);

    let ignoreCnt = 0;
    let friendsInfo = [];
    for (let i = 0; i < relationsNodes.length; i++) {
        let barNode = relationsNodes[i];
        let href = barNode.getAttribute('href');

        var friendMatch = RELATIONS_ID_RE.exec(href);
        if (friendMatch) {
            // We convert the friend id to integer
            let friendData = {
                'id': parseInt(friendMatch[1]),
                'name': barNode.textContent,
            }

            // We make sure not to include ids in the exclusion list
            if (!excludedIds.includes(friendData.id)) {
                friendsInfo.push(friendData);
            } else {
                ignoreCnt++;
            }
        }

        // We make sure the regex is working in the next iteration
        RELATIONS_ID_RE.lastIndex = 0;
    }

    const interactPath = '/World/Popmundo.aspx/Interact/Phone/';

    // The list of fields that we will include in the fetch call payload when actually calling your friend.
    const bodyFields = ['__EVENTTARGET', '__EVENTARGUMENT', '__VIEWSTATE', '__VIEWSTATEGENERATOR', '__EVENTVALIDATION', 'ctl00$cphTopColumn$ctl00$ddlInteractionTypes',
        'ctl00$cphTopColumn$ctl00$btnInteract'];

    let statusPElem = document.getElementById('call-all-status-p');

    // We randomly sort the interactions and create an iterator base on it
    let interactionIterator = Utils.cycle(Utils.shuffle(INTERACTIONS));

    const fetcher = new TimedFetch(false);

    // Phase 1: check each friend sequentially to determine which can be called
    let friendsDetails = [];
    for (let friendIndex = 0; friendIndex < friendsInfo.length; friendIndex++) {
        let friendDict = friendsInfo[friendIndex];

        let statusMessage = '';
        if (ignoreCnt > 0)
            statusMessage += chrome.i18n.getMessage('cafStatusIgnored', [String(ignoreCnt)]);
        statusMessage += chrome.i18n.getMessage('cafStatusChecking', [String(friendIndex + 1), String(friendsInfo.length), friendDict.name]);
        statusPElem.textContent = statusMessage;

        let interactUrl = Utils.getServerLink(`${interactPath}${friendDict.id}`);
        try {
            const html = await fetcher.fetch(interactUrl);

            // Initialize the DOM parser
            let parser = new DOMParser();

            // Parse the text
            let doc = parser.parseFromString(html, "text/html");

            // This XPATH makes sure that the Wazzup call option is there
            let wazzupXpathHelper = new XPathHelper('//select[@id="ctl00_cphTopColumn_ctl00_ddlInteractionTypes"]/option[@value="24"]', doc);
            let wazzupNode = wazzupXpathHelper.getOrderedSnapshot(doc);
            Logger.debug(wazzupXpathHelper.prettyPrint());

            // Random interaction is 0 by default, if interactions are available a random value is generated
            let randomInteraction = 0;
            if (wazzupNode.snapshotLength > 0) {
                let availableInteractions = [];
                // This is the XPATH for the option values in the interaction select element
                let interactionsXpathHelper = new XPathHelper('//select[@id="ctl00_cphTopColumn_ctl00_ddlInteractionTypes"]/option', doc)
                let interactionNodes = interactionsXpathHelper.getUnorderedNodeSnapshot(doc);
                Logger.debug(interactionsXpathHelper.prettyPrint());

                // We loop and we push possible values in availableInteractions
                for (let i = 0; i < interactionNodes.snapshotLength; i++) {
                    let interactionOption = interactionNodes.snapshotItem(i);
                    let value = parseInt(interactionOption.getAttribute('value'));
                    availableInteractions.push(value);
                }

                // We intersect available interactions with call interactions
                let possibleInteractions = availableInteractions.filter(value => INTERACTIONS.includes(value));

                // We finally choose a random interaction
                if (possibleInteractions.length > 0) {
                    randomInteraction = interactionIterator.next().value;

                    while (!possibleInteractions.includes(randomInteraction))
                        randomInteraction = interactionIterator.next().value;
                }
            }

            // We get the form fields
            let docForm = doc.getElementById('aspnetForm');
            let formDataOrig = new FormData(docForm);

            // We make sure to set the correct values
            formDataOrig.set('__EVENTTARGET', '');
            formDataOrig.set('__EVENTARGUMENT', '');
            formDataOrig.set('ctl00$cphTopColumn$ctl00$btnInteract', 'Interact');
            formDataOrig.set('ctl00$cphTopColumn$ctl00$ddlInteractionTypes', randomInteraction);

            // We don't need all the fields, so we make sure to only take the relevant ones
            let formDataNew = new FormData();
            bodyFields.forEach((key) => {
                formDataNew.set(key, formDataOrig.get(key));
            });

            friendsDetails.push({
                'id': friendDict.id,
                'name': friendDict.name,
                'canCall': (wazzupNode.snapshotLength > 0) && (randomInteraction !== 0),
                'formData': formDataNew,
                'interactUrl': interactUrl,
            });
        } catch (error) {
            console.error(`Failed to check ${friendDict.name}:`, error);
        }
    }

    // We filter so to have only callable friends
    let callableFriends = friendsDetails.filter(details => details.canCall);

    if (callableFriends.length == 0) {
        statusPElem.textContent = chrome.i18n.getMessage('cafStatusNoFriends');
    } else {
        statusPElem.textContent = chrome.i18n.getMessage('cafStatusCalling', [String(callableFriends.length), String(friendsInfo.length)]);

        let succesCalls = 0;

        // Phase 2: call each friend sequentially
        for (let friendIndex = 0; friendIndex < callableFriends.length; friendIndex++) {
            let friendDetails = callableFriends[friendIndex];
            statusPElem.textContent = chrome.i18n.getMessage('cafStatusCallingOne', [String(friendIndex + 1), String(callableFriends.length), friendDetails.name]);

            try {
                await fetcher.fetch(friendDetails.interactUrl, {
                    "body": friendDetails.formData,
                    "method": "POST",
                });
                succesCalls += 1;
            } catch (error) {
                console.error(`Failed to call ${friendDetails.name}:`, error);
            }
        }

        statusPElem.textContent = chrome.i18n.getMessage('cafStatusSuccess', [String(succesCalls), String(callableFriends.length)]);

        // We reload the page so we get all the notifications prited out in the green banners.
        if (succesCalls > 0) {
            let storage = await chrome.storage.sync.get({ global_call_all_friends_count: 0 });
            await chrome.storage.sync.set({ global_call_all_friends_count: storage.global_call_all_friends_count + succesCalls });
            location.reload();
        }
    }
};

/**
 * This function will inject the required HTML elements to make the "Call all" functionality available in the relations page
 *
 */
async function injectCallAllHTML() {
    const END_RELATION_XPATH = '//div[@id="ctl00_cphLeftColumn_ctl00_pnlEndMultiple"]';

    let endRelationsXPathHelp = new XPathHelper(END_RELATION_XPATH);
    let endRelationsNode = endRelationsXPathHelp.getFirstOrderedNode(document);

    Logger.debug(endRelationsXPathHelp.prettyPrint());

    if (endRelationsNode.singleNodeValue) {
        // console.log("End relations div");

        let callAllDiv = document.createElement('div');
        callAllDiv.setAttribute('class', 'box');

        let callAllH2 = document.createElement('h2');
        callAllH2.textContent = chrome.i18n.getMessage('cafH2');

        let callAllP1 = document.createElement('p');
        callAllP1.textContent = chrome.i18n.getMessage('cafDescription');
        let callAllP3 = document.createElement('p');
        callAllP3.setAttribute('id', 'call-all-status-p');
        callAllP3.textContent = '';

        let callAllP2 = document.createElement('p');
        callAllP2.setAttribute('class', 'actionbuttons');

        let callAllSubmit = document.createElement('input');
        callAllSubmit.setAttribute('type', 'submit');
        callAllSubmit.setAttribute('value', chrome.i18n.getMessage('cafButton'));
        callAllSubmit.setAttribute('class', 'cns');
        callAllSubmit.onclick = () => { onSubmitClick(); return false; };

        callAllP2.appendChild(callAllSubmit);

        callAllDiv.appendChild(callAllH2);
        callAllDiv.appendChild(callAllP1);
        callAllDiv.appendChild(callAllP3);

        const { global_call_all_friends_count: totalCalls } = await chrome.storage.sync.get({ 'global_call_all_friends_count': 0 });
        if (totalCalls > 0) {
            let callAllP4 = document.createElement('p');
            callAllP4.innerHTML = chrome.i18n.getMessage('cafTotalCallsMsg', [String(totalCalls)]);
            callAllDiv.appendChild(callAllP4);
        }

        callAllDiv.appendChild(callAllP2);

        endRelationsNode.singleNodeValue.parentNode.insertBefore(callAllDiv, endRelationsNode.singleNodeValue.nextSibling);
    }
}

/**
 * Adds a toggle icon next to each friend link on the Relations page.
 * prohibition.png = not excluded (click to exclude).
 * tick-circle.png = excluded (click to re-include).
 */
async function injectCallAllExcludeButtons() {
    const RELATIONS_SELECTOR = 'td > a[href*="/World/Popmundo.aspx/Character/"]';
    const RELATIONS_ID_RE = /\/World\/Popmundo.aspx\/Character\/(\d+)/g;

    const prohibitionIcon = '🚫';
    const tickCircleIcon = '✅';

    const { call_exclude_id: excludeList, enhanced_links_font_size: fontSize } = await chrome.storage.sync.get({ call_exclude_id: [], enhanced_links_font_size: 16 });
    const currentExcludedIds = excludeList.map(e => typeof e === 'object' ? e.id : e);

    const relationsNodes = new CssSelectorHelper(RELATIONS_SELECTOR).getAll();

    if (relationsNodes.length === 0) return;

    const firstNode = relationsNodes[0];
    const parentTable = firstNode.closest('table');
    const originalDisplay = parentTable ? parentTable.style.display : '';

    if (parentTable) {
        parentTable.style.display = 'none';
    }

    for (let i = 0; i < relationsNodes.length; i++) {
        const aNode = relationsNodes[i];
        const href = aNode.getAttribute('href');

        RELATIONS_ID_RE.lastIndex = 0;
        const friendMatch = RELATIONS_ID_RE.exec(href);
        if (!friendMatch) continue;

        const friendID = parseInt(friendMatch[1]);
        const friendName = aNode.textContent.trim();
        const isExcluded = currentExcludedIds.includes(friendID);

        const icon = document.createElement('span');
        icon.textContent = isExcluded ? prohibitionIcon : tickCircleIcon;
        icon.title = isExcluded ? chrome.i18n.getMessage('cafInclude') : chrome.i18n.getMessage('cafExclude');
        icon.style.cssText = `margin-right:5px; cursor:pointer; font-size:${fontSize}px; user-select:none;`;

        icon.className = 'caf-status-icon';
        icon.dataset.friendId = friendID;
        icon.dataset.friendName = friendName;

        aNode.insertAdjacentElement('beforebegin', icon);
    }

    if (parentTable) {
        parentTable.style.display = originalDisplay;
    }

    document.addEventListener('click', async (e) => {
        if (!e.target.classList.contains('caf-status-icon')) return;

        const icon = e.target;
        const friendID = parseInt(icon.dataset.friendId);
        const friendName = icon.dataset.friendName;

        const { call_exclude_id: current } = await chrome.storage.sync.get({ call_exclude_id: [] });
        const currentIds = current.map(e => typeof e === 'object' ? e.id : e);

        if (currentIds.includes(friendID)) {
            // Remove from exclusion list
            const updated = current.filter(e => (typeof e === 'object' ? e.id : e) !== friendID);
            await chrome.storage.sync.set({ call_exclude_id: updated });
            icon.textContent = tickCircleIcon;
            icon.title = chrome.i18n.getMessage('cafExclude');
        } else {
            // Add to exclusion list
            const normalized = current.map(e => typeof e === 'object' ? e : { id: e, name: `#${e}` });
            normalized.push({ id: friendID, name: friendName });
            await chrome.storage.sync.set({ call_exclude_id: normalized });
            icon.textContent = prohibitionIcon;
            icon.title = chrome.i18n.getMessage('cafInclude');
        }
    });
}


if (window.location.href.includes(Utils.getMyID())) {
    injectCallAllHTML();
    injectCallAllExcludeButtons();
}s
