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

    // XPATH used to search friend id in the relationship page
    const RELATIONS_XPATH = '//td/a[contains(@href, "/World/Popmundo.aspx/Character/")]';
    // Regex to extract the character friend id from the href of a elems
    const RELATIONS_ID_RE = /\/World\/Popmundo.aspx\/Character\/(\d+)/g

    // We search for friend ID in the relationship page
    let relationsXPathHelp = new XPathHelper(RELATIONS_XPATH);
    let relationsNodes = relationsXPathHelp.getOrderedSnapshot(document);

    let ignoreCnt = 0;
    let friendsInfo = [];
    for (let i = 0; i < relationsNodes.snapshotLength; i++) {
        let barNode = relationsNodes.snapshotItem(i);
        let href = barNode.getAttribute('href');

        var friendMatch = RELATIONS_ID_RE.exec(href);
        if (friendMatch) {
            // We convert the friend id to integer
            let friendData = {
                'id': parseInt(friendMatch[1]),
                'name': barNode.textContent,
            }

            // We make sure not to include ids in the exclusion list
            if (!savedOptions.call_exclude_id.includes(friendData.id)){
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
            statusMessage += `Ignored ${ignoreCnt} friend(s). `;
        statusMessage += `Checking friend ${friendIndex + 1} out of ${friendsInfo.length} (${friendDict.name}).`;
        statusPElem.textContent = statusMessage;

        let interactUrl = Utils.getServerLink(`${interactPath}${friendDict.id}`);
        try {
            const html = await fetcher.fetch(interactUrl);

            // Initialize the DOM parser
            let parser = new DOMParser();

            // Parse the text
            let doc = parser.parseFromString(html, "text/html");

            // This XPATH makes sure that the Wazzup call option is there
            let wazzupXpathHelper = new XPathHelper('//select[@id="ctl00_cphTopColumn_ctl00_ddlInteractionTypes"]/option[@value="24"]');
            let wazzupNode = wazzupXpathHelper.getOrderedSnapshot(doc);

            // Random interaction is 0 by default, if interactions are available a random value is generated
            let randomInteraction = 0;
            if (wazzupNode.snapshotLength > 0) {
                let availableInteractions = [];
                // This is the XPATH for the option values in the interaction select element
                let interactionsXpathHelper = new XPathHelper('//select[@id="ctl00_cphTopColumn_ctl00_ddlInteractionTypes"]/option')
                let interactionNodes = interactionsXpathHelper.getUnorderedNodeSnapshot(doc);

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
        statusPElem.textContent = `No friends to call.`;
    } else {
        statusPElem.textContent = `Calling ${callableFriends.length} friends out of ${friendsInfo.length}...`;

        let succesCalls = 0;

        // Phase 2: call each friend sequentially
        for (let friendIndex = 0; friendIndex < callableFriends.length; friendIndex++) {
            let friendDetails = callableFriends[friendIndex];
            statusPElem.textContent = `Calling friend ${friendIndex + 1} out of ${callableFriends.length} (${friendDetails.name})...`;

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

        statusPElem.textContent = `Succesfully called ${succesCalls} friends out of ${callableFriends.length}.`;

        // We reload the page so we get all the notifications prited out in the green banners.
        if (succesCalls > 0) {
            location.reload();
        }
    }
};

/**
 * This function will inject the required HTML elements to make the "Call all" functionality available in the relations page
 *
 */
function injectCallAllHTML() {
    const END_RELATION_XPATH = '//div[@id="ctl00_cphLeftColumn_ctl00_pnlEndMultiple"]';

    let endRelationsXPathHelp = new XPathHelper(END_RELATION_XPATH);
    let endRelationsNode = endRelationsXPathHelp.getFirstOrderedNode(document);

    if (endRelationsNode.singleNodeValue) {
        // console.log("End relations div");

        let callAllDiv = document.createElement('div');
        callAllDiv.setAttribute('class', 'box');

        let callAllH2 = document.createElement('h2');
        callAllH2.textContent = 'Call all your contancts';

        let callAllP1 = document.createElement('p');
        callAllP1.textContent = 'Call all your friends that have a phone.';
        let callAllP3 = document.createElement('p');
        callAllP3.setAttribute('id', 'call-all-status-p');
        callAllP3.textContent = '';

        let callAllP2 = document.createElement('p');
        callAllP2.setAttribute('class', 'actionbuttons');

        let callAllSubmit = document.createElement('input');
        callAllSubmit.setAttribute('type', 'submit');
        callAllSubmit.setAttribute('value', 'Call all relationships');
        callAllSubmit.setAttribute('class', 'cns');
        callAllSubmit.onclick = () => { onSubmitClick(); return false; };

        callAllP2.appendChild(callAllSubmit);

        callAllDiv.appendChild(callAllH2);
        callAllDiv.appendChild(callAllP1);
        callAllDiv.appendChild(callAllP3);
        callAllDiv.appendChild(callAllP2);

        endRelationsNode.singleNodeValue.parentNode.insertBefore(callAllDiv, endRelationsNode.singleNodeValue.nextSibling);
    }
}

if (window.location.href.includes(Utils.getMyID())) {
    injectCallAllHTML();
}