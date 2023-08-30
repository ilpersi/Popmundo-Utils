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
    // Delaty between each fetch() call
    const CALL_DELAY = 1000;

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

    // This array will contain the required friends details
    let friendsDetailsPromises = [];

    // We save the current host so that we can build correct urls to fetch later on
    const hostName = window.location.hostname;
    const interactPath = '/World/Popmundo.aspx/Interact/Phone/';

    // The list of fields that we will include in the fetch call payload when actually calling your friend.
    const bodyFields = ['__EVENTTARGET', '__EVENTARGUMENT', '__VIEWSTATE', '__VIEWSTATEGENERATOR', '__EVENTVALIDATION', 'ctl00$cphTopColumn$ctl00$ddlInteractionTypes',
        'ctl00$cphTopColumn$ctl00$btnInteract'];

    let statusPElem = document.getElementById('call-all-status-p');

    // We randomly sort the interactions and create an iterator base on it
    let interactionIterator = Utils.cycle(Utils.shuffle(INTERACTIONS));

    friendsInfo.forEach((friendDict, friendIndex) => {

        let friendDetailsPromise = new Promise((resolve, reject) => {
            // To avoid being kicked out, we delay backgroud fetch calls
            setTimeout(async () => {
                let statusMessage = '';
                
                if (ignoreCnt > 0)
                    statusMessage += `Ignored ${ignoreCnt} friend(s). `;
                
                statusMessage += `Checking friend ${friendIndex + 1} out of ${friendsInfo.length} (${friendDict.name}).`;

                statusPElem.textContent = statusMessage;

                let interactUrl = `https://${hostName}${interactPath}${friendDict.id}`;
                await fetch(interactUrl, { "method": "GET", })
                    .then(response => {
                        if (response.ok && response.status >= 200 && response.status < 300) {
                            return response.text();
                        }
                    }).then(html => {
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
                            if (possibleInteractions.length > 0){
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

                        // The final result of the promise
                        var result = {
                            'id': friendDict.id,
                            'name': friendDict.name,
                            'canCall': (wazzupNode.snapshotLength > 0) && (randomInteraction !== 0),
                            'formData': formDataNew,
                            'interactUrl': interactUrl,
                        }

                        resolve(result);
                    })
                    .catch(error => console.error(error));
            }, CALL_DELAY * friendIndex);
        });

        friendsDetailsPromises.push(friendDetailsPromise);

    });

    // We make sure that all the promises for friend details are completed
    let friendsDetails = await Promise.all(friendsDetailsPromises);
    // We filter so to have only callable friends
    let callableFriends = friendsDetails.filter(details => details.canCall)

    if (callableFriends.length == 0) {
        statusPElem.textContent = `No friends to call.`;
    } else {
        statusPElem.textContent = `Calling ${callableFriends.length} friends out of ${friendsInfo.length}...`;
        // console.log(callableFriends);

        let succesCalls = 0;
        let friendCallsPromisses = [];

        callableFriends.forEach((friendDetails, friendIndex) => {

            let friendCallPromise = new Promise((resolve, reject) => {
                // To avoid being kicked out, we delay backgroud fetch calls
                setTimeout(() => {
                    statusPElem.textContent = `Calling friend ${friendIndex + 1} out of ${callableFriends.length} (${friendDetails.name})...`;

                    fetch(friendDetails.interactUrl, {
                        // "headers": {
                        //     "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                        //     "accept-language": "en-US,en;q=0.7",
                        //     "cache-control": "max-age=0",
                        //     "content-type": "application/x-www-form-urlencoded",
                        //     "sec-fetch-dest": "document",
                        //     "sec-fetch-mode": "navigate",
                        //     "sec-fetch-site": "same-origin",
                        //     "sec-fetch-user": "?1",
                        //     "sec-gpc": "1",
                        //     "upgrade-insecure-requests": "1",
                        //     "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
                        // },
                        // "referrer": friendDetails.interactUrl,
                        // "referrerPolicy": "strict-origin-when-cross-origin",
                        "body": friendDetails.formData,
                        "method": "POST",
                        // "mode": "cors",
                        // "credentials": "include"
                    }).then((response) => {
                        if (response.ok && response.status >= 200 && response.status < 300) {
                            succesCalls += 1;
                            return response.text();
                        }
                    }).then((html) => {
                        resolve(true);
                    });

                }, CALL_DELAY * friendIndex);
            });

            friendCallsPromisses.push(friendCallPromise);
        });

        let callDetails = await Promise.all(friendCallsPromisses);

        statusPElem.textContent = `Succesfully called ${succesCalls} friends out of ${callableFriends.length}.`

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