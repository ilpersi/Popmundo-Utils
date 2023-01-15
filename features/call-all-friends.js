const myID = Utils.getMyID();

async function onSubmitClick() {
    // console.log('async onclick');
    const RELATIONS_XPATH = '//td/a[contains(@href, "/World/Popmundo.aspx/Character/")]';
    const RELATIONS_ID_RE = /\/World\/Popmundo.aspx\/Character\/(\d+)/g
    const CALL_DELAY = 400;

    let relationsXPathHelp = new XPathHelper(RELATIONS_XPATH);
    let relationsNodes = relationsXPathHelp.getOrderedSnapshot(document);

    let friendsID = [];
    for (let i = 0; i < relationsNodes.snapshotLength; i++) {
        let barNode = relationsNodes.snapshotItem(i);
        let href = barNode.getAttribute('href');

        var friendMatch = RELATIONS_ID_RE.exec(href);
        if (friendMatch) {
            friendsID.push(parseInt(friendMatch[1]));
        }

        // We make sure the regex is working in the next iteration
        RELATIONS_ID_RE.lastIndex = 0;
    }

    console.log(friendsID);

    let friendsDetailsPromises = [];
    const hostName = window.location.hostname;
    const interactPath = '/World/Popmundo.aspx/Interact/Details/';
    const bodyFields = ['__EVENTTARGET', '__EVENTARGUMENT', '__VIEWSTATE', '__VIEWSTATEGENERATOR', '__EVENTVALIDATION', 'ctl00$cphTopColumn$ctl00$ddlInteractionTypes',
        'ctl00$cphTopColumn$ctl00$btnInteract'];

    let notifications = new Notifications();
    notifications.deleteAll();
    let notificationBar = notifications.notifySuccess('call-all-friends', 'Calling all friends...')

    friendsID.forEach((friendID, friendIndex) => {

        let friendDetailsPromise = new Promise((resolve, reject) => {
            // To avoid being kicked out, we delay backgroud fetch calls
            setTimeout(() => {
                notificationBar.textContent = `Checking friend ${friendIndex + 1} out of ${friendsID.length}`;

                let interactUrl = `https://${hostName}${interactPath}${friendID}`;
                fetch(interactUrl, { "method": "GET", })
                    .then(response => {
                        if (response.ok && response.status >= 200 && response.status < 300) {
                            return response.text();
                        }
                    }).then(html => {
                        // Initialize the DOM parser
                        let parser = new DOMParser();

                        // Parse the text
                        let doc = parser.parseFromString(html, "text/html");

                        xpathHelper = new XPathHelper('//select[@id="ctl00_cphTopColumn_ctl00_ddlInteractionTypes"]/option[@value="24"]');
                        let optionNodes = xpathHelper.getOrderedSnapshot(doc);

                        // We get the form fields
                        let docForm = doc.getElementById('aspnetForm');
                        let formDataOrig = new FormData(docForm);

                        // We make sure to set the correct values
                        formDataOrig.set('__EVENTTARGET', '');
                        formDataOrig.set('__EVENTARGUMENT', '');
                        formDataOrig.set('ctl00$cphTopColumn$ctl00$btnInteract', 'Interact');
                        formDataOrig.set('ctl00$cphTopColumn$ctl00$ddlInteractionTypes', 24); // Whazzup call

                        // We don't need all the fields, so we make sure to only take the relevant ones
                        let formDataNew = new FormData();
                        bodyFields.forEach((key) => {
                            formDataNew.set(key, formDataOrig.get(key));
                        });

                        var result = {
                            'id': friendID,
                            'canCall': (optionNodes.snapshotLength > 0),
                            'formData': formDataNew,
                            'interactUrl': interactUrl,
                        }

                        resolve(result);
                    });
            }, CALL_DELAY * friendIndex);
        });

        friendsDetailsPromises.push(friendDetailsPromise);

    });

    let friendsDetails = await Promise.all(friendsDetailsPromises);
    let callableFriends = friendsDetails.filter(details => details.canCall)

    notificationBar.textContent = callableFriends.length == 0 ? `No friends to call.` : `Calling ${callableFriends.length} friends out of ${friendsID.length}...`;
    console.log(callableFriends);

    let succesCalls = 0;

    callableFriends.forEach((friendDetails, friendIndex) => {

        // To avoid being kicked out, we delay backgroud fetch calls
        setTimeout(() => {
            notificationBar.textContent = `Calling friend ${friendIndex + 1} out of ${callableFriends.length}...`;

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
                // debugger;
            });

        }, CALL_DELAY * friendIndex);
    });

    notificationBar.textContent = `Succesfully called ${succesCalls} out of {callableFriends.length}.`
};

function injectCallAllHTML() {
    // debugger;
    // console.log('My relations');
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
        callAllDiv.appendChild(callAllP2);

        endRelationsNode.singleNodeValue.parentNode.insertBefore(callAllDiv, endRelationsNode.singleNodeValue.nextSibling);
    }
}

if (window.location.href.includes(myID)) {
    injectCallAllHTML();
}