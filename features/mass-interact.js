async function onSubmitClick() {

    const optionsGet = {
        "mass_interact_greet": true,
        "mass_interact_smile": true,
        "mass_interact_wink": false,
        "mass_interact_insult": false,
        "mass_interact_share_opinions": false,
        "mass_interact_gossip": false,
        "mass_interact_have_profound_discussion": false,
        "mass_interact_comfort": false,
        "mass_interact_talk_to": true,
        "mass_interact_tease": false,
        "mass_interact_fraternize": false,
        "mass_interact_offer_advice": false,
        "mass_interact_please_stop_flirting_with_me": false,
        "mass_interact_say_im_sorry": false,
        "mass_interact_compliment": false,
        "mass_interact_hey_sexy_how_you_doin": false,
        "mass_interact_praise": false,
        "mass_interact_tell_naughty_joke": false,
        "mass_interact_say_i_love_you": false,
        "mass_interact_i_dont_want_to_be_friends": false,
        "mass_interact_share_secrets": false,
        "mass_interact_hang_out": false,
        "mass_interact_play_with": false,
        "mass_interact_pat_on_back": false,
        "mass_interact_braid_hair": false,
        "mass_interact_shake_hands": false,
        "mass_interact_rub_elbows": false,
        "mass_interact_hug": false,
        "mass_interact_tickle": false,
        "mass_interact_buy_a_drink": false,
        "mass_interact_stroll_hand_in_hand": false,
        "mass_interact_flex_biceps": false,
        "mass_interact_caress": false,
        "mass_interact_ask_for_a_dance": false,
        "mass_interact_high_five": false,
        "mass_interact_arm_wrestle": false,
        "mass_interact_kiss_cheeks": false,
        "mass_interact_embrace": false,
        "mass_interact_kiss": false,
        "mass_interact_kiss_passionately": false,
        "mass_interact_enjoy_kobe_sutra": false,
        "mass_interact_5_minute_quickie": false,
        "mass_interact_tantric_sex": false,
        "mass_interact_make_love": false,
        "mass_interact_give_massage": false,
        "mass_interact_bless": false,
        "mass_interact_do_funny_magic": false,
        "mass_interact_tell_joke": false,
        "mass_interact_seek_apprenticeship": false,
        "mass_interact_sing_to": false,
        "mass_interact_serenade": false,
        'mass_interact_exclude_id': [],
        'mass_interact_max_chars': 99,
        'mass_interact_ignore_acquaintance': false,
    };

    let optionsMap = {
        "mass_interact_greet": 1,
        "mass_interact_smile": 54,
        "mass_interact_wink": 161,
        "mass_interact_insult": 15,
        "mass_interact_share_opinions": 62,
        "mass_interact_gossip": 65,
        "mass_interact_have_profound_discussion": 34,
        "mass_interact_comfort": 51,
        "mass_interact_talk_to": 3,
        "mass_interact_tease": 5,
        "mass_interact_fraternize": 57,
        "mass_interact_offer_advice": 68,
        "mass_interact_please_stop_flirting_with_me": 154,
        "mass_interact_say_im_sorry": 166,
        "mass_interact_compliment": 14,
        "mass_interact_hey_sexy_how_you_doin": 71,
        "mass_interact_praise": 75,
        "mass_interact_tell_naughty_joke": 76,
        "mass_interact_say_i_love_you": 77,
        "mass_interact_i_dont_want_to_be_friends": 156,
        "mass_interact_share_secrets": 69,
        "mass_interact_hang_out": 70,
        "mass_interact_play_with": 18,
        "mass_interact_pat_on_back": 63,
        "mass_interact_braid_hair": 66,
        "mass_interact_shake_hands": 55,
        "mass_interact_rub_elbows": 59,
        "mass_interact_hug": 8,
        "mass_interact_tickle": 12,
        "mass_interact_buy_a_drink": 7,
        "mass_interact_stroll_hand_in_hand": 129,
        "mass_interact_flex_biceps": 89,
        "mass_interact_caress": 30,
        "mass_interact_ask_for_a_dance": 35,
        "mass_interact_high_five": 60,
        "mass_interact_arm_wrestle": 67,
        "mass_interact_kiss_cheeks": 56,
        "mass_interact_embrace": 64,
        "mass_interact_kiss": 9,
        "mass_interact_kiss_passionately": 10,
        "mass_interact_enjoy_kobe_sutra": 164,
        "mass_interact_5_minute_quickie": 13,
        "mass_interact_tantric_sex": 19,
        "mass_interact_make_love": 11,
        "mass_interact_give_massage": 44,
        "mass_interact_bless": 39,
        "mass_interact_do_funny_magic": 33,
        "mass_interact_tell_joke": 4,
        "mass_interact_seek_apprenticeship": 29,
        "mass_interact_sing_to": 21,
        "mass_interact_serenade": 78
    };

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

    // XPATH used to search character id in the present characters page
    const PRESENT_CHARS_XPATH = '//tr[contains(@id, "ctl00_cphLeftColumn_ctl00_repCharactersPresent") and contains(@id, "trCharacterRow")]';
    // Additional XPATH to make sure that the interact link is present for a specific character
    const INTERACT_A_XPATH = './td[@class="right"]/a[contains(@href, "/World/Popmundo.aspx/Interact/")]';
    // XPATH to get the character a element from the present character list
    const CHAR_A_XPATH = './td[2]/a';
    // XPATH used to check i the interact select box is present
    const INTERACT_SELECT_XPATH = '//select[@id="ctl00_cphTopColumn_ctl00_ddlInteractionTypes"]/option';
    // Regex to extract the character id from the href of a elems
    const CHAR_ID_RE = /\/World\/Popmundo.aspx\/Character\/(\d+)/g
    // Delaty between each fetch() call
    const INTERACT_DELAY = 1000;

    // We'll use this to log progression and give feedback to the user
    const statusPElem = document.getElementById('mass-interact-status-p');

    // We'll use this to save the list of current friends
    let = currentFriendsIDs = [];
    if (savedOptions.mass_interact_ignore_acquaintance) {
        // XPATH for the Relations link in the Character Page
        const RELATIONS_A_XPATH = "//a[contains(@href, '/World/Popmundo.aspx/Character/Relations/')]";
        let relationAXpathHelp = new XPathHelper(RELATIONS_A_XPATH);

        // Status update
        statusPElem.textContent = `Ignore new acquaintances is enabled, checking relations URL...`;

        // We get the content of the Character page
        let charURL = Utils.getServerLink('/World/Popmundo.aspx/Character');
        let charHTML = await fetch(charURL, {
            "method": "GET"
        }).then(response => {
            return response.text();
        }).then(html => {
            return html;
        });

        // We sleep to avoid disconnections
        await Utils.sleep(INTERACT_DELAY);

        // We parse the character page
        let parser = new DOMParser();
        let doc = parser.parseFromString(charHTML, "text/html");
        let relationANode = relationAXpathHelp.getFirstOrderedNode(doc);
        let relationURL = Utils.getServerLink(relationANode.singleNodeValue.getAttribute('href'));

        // We assume relations are one page only
        let isNextPage = false;

        // XPATH used to search friend id in the relationship page
        const RELATIONS_XPATH = '//td/a[contains(@href, "/World/Popmundo.aspx/Character/")]';
        // XPATH to check if there is another relations page
        const RELATIONS_NEXT_XPATH = "//a[contains(@href, 'btnGoNext')]";

        // Regex to extract the character friend id from the href of a elems
        const RELATIONS_ID_RE = /\/World\/Popmundo.aspx\/Character\/(\d+)/g
        const RELATIONS_NEXT_RE = /javascript:__doPostBack\('([^']+?)',''\)/gm;

        let relPageCnt = 1;
        let eventTarget = '';
        do {

            // We update the status message
            statusPElem.textContent = `Analyzing relations page ${relPageCnt} to get current acquaintances...`;

            // If there is more than one page, the logic is doing a postBack, so we save current form info
            let docForm = doc.getElementById('aspnetForm');
            let formDataOrig = new FormData(docForm);

            // Standard options
            let fetchOptions = {
                "method": "POST"
            };

            // We mimick the doPostBack call
            if (isNextPage) {
                formDataOrig.set('__EVENTTARGET', eventTarget);
                formDataOrig.set('__EVENTARGUMENT', '');

                fetchOptions.body = formDataOrig;
            }

            // We finally perform the real fetch
            let relHTML = await fetch(relationURL, fetchOptions)
                .then(response => {
                    return response.text();
                }).then(html => {
                    return html;
                });

            // We sleep to avoid disconnections
            await Utils.sleep(INTERACT_DELAY);

            doc = parser.parseFromString(relHTML, "text/html");

            // We search for friend ID in the relationship page
            let relationsXPathHelp = new XPathHelper(RELATIONS_XPATH);
            let relationsNodes = relationsXPathHelp.getOrderedSnapshot(doc);

            for (let i = 0; i < relationsNodes.snapshotLength; i++) {
                let relNode = relationsNodes.snapshotItem(i);
                let href = relNode.getAttribute('href');

                let friendMatch = RELATIONS_ID_RE.exec(href);
                if (friendMatch) {
                    // We convert the friend id to integer and add to the total list
                    currentFriendsIDs.push(parseInt(friendMatch[1]));
                }

                // We make sure the regex is working in the next iteration
                RELATIONS_ID_RE.lastIndex = 0;
            }

            // We search for next page link
            let relationsNextXPathHelp = new XPathHelper(RELATIONS_NEXT_XPATH);
            let relationsNextNode = relationsNextXPathHelp.getFirstOrderedNode(doc);

            // Next page element is found
            if (relationsNextNode.singleNodeValue) {
                // console.log('rel next ' + relationsNextNode.singleNodeValue.getAttribute('href'));
                let nextPageHref = relationsNextNode.singleNodeValue.getAttribute('href');

                // href matches the expected regex
                let goNextMatch = RELATIONS_NEXT_RE.exec(nextPageHref);
                if (goNextMatch) {
                    relPageCnt += 1;
                    eventTarget = goNextMatch[1];
                    isNextPage = true;

                    // We make sure the regex is working in the next iteration
                    RELATIONS_NEXT_RE.lastIndex = 0;
                }

            } else {
                isNextPage = false;
            }

        } while (isNextPage);

        // console.log('Ignore acquitance ' + relationURL);
    }

    // XPath Helpers to search for characters
    let presentCharsTRXPathHelp = new XPathHelper(PRESENT_CHARS_XPATH);
    let interactAXpathHelp = new XPathHelper(INTERACT_A_XPATH);
    let charAXpathHelp = new XPathHelper(CHAR_A_XPATH);

    //let charsTRNodes = presentCharsTRXPathHelp.getUnorderedNodeIterator (document);
    let charsTRNodes = presentCharsTRXPathHelp.getOrderedSnapshot(document);

    let charsInfo = [];
    let charTRNode = null;

    for (let charCnt = 0; charCnt < charsTRNodes.snapshotLength; charCnt++) {
        //while (charTRNode = charsTRNodes.iterateNext()) {
        charTRNode = charsTRNodes.snapshotItem(charCnt);
        // For some characters (including yourself) the Interact link is not present. When this is the case we skip that character.
        let aNodeSnapshot = interactAXpathHelp.getUnorderedNodeSnapshot(charTRNode);

        if (aNodeSnapshot.snapshotLength == 1) {
            let interactANode = aNodeSnapshot.snapshotItem(0);

            let charNode = charAXpathHelp.getAnyUnorderedNode(charTRNode);
            let charANode = charNode.singleNodeValue

            let href = charANode.getAttribute('href');

            let charMatch = CHAR_ID_RE.exec(href);
            if (charMatch) {
                // We convert the char id to integer
                let charID = parseInt(charMatch[1]);

                let charData = {
                    'id': charID,
                    'name': charANode.textContent,
                    'href': interactANode.getAttribute('href'),
                }

                // We check if we allow new acquaintances
                if (savedOptions.mass_interact_ignore_acquaintance) {
                    if (!currentFriendsIDs.includes(charID)) {
                        statusPElem.textContent = `Skipping ${charData.name} as new acquaintances are not allowed...`;

                        // We make sure the regex is working in the next iteration
                        CHAR_ID_RE.lastIndex = 0;

                        continue;
                    }
                }

                // We make sure not to include ids in the exclusion list
                if (!savedOptions.mass_interact_exclude_id.includes(charData.id)) {
                    charsInfo.push(charData);
                } else {
                    statusPElem.textContent = `Skipping ${charData.name} as the ID is in the ignore list...`;
                }
            }

            // We make sure the regex is working in the next iteration
            CHAR_ID_RE.lastIndex = 0;
        }
    }

    // We save the current host so that we can build correct urls to fetch later on
    const hostName = window.location.hostname;

    // The list of fields that we will include in the fetch call payload when actually interacting with a character.
    const bodyFields = ['__EVENTTARGET', '__EVENTARGUMENT', '__VIEWSTATE', '__VIEWSTATEGENERATOR', '__EVENTVALIDATION', 'ctl00$cphTopColumn$ctl00$ddlInteractionTypes',
        'ctl00$cphTopColumn$ctl00$btnInteract'];

    // This XPATH makes sure that the Interact Select is is there
    let interactSelectXpathHelper = new XPathHelper(INTERACT_SELECT_XPATH);

    // How many characters did we actually interact with? This is the counter for it. It is only increased when at least one interaction is available
    let totalCharactersCnt = 0;

    // The total counter of interactions performed
    let totalInteractionsCnt = 0;

    // We have to manage async requests in sequence, so it is not possible to use forEach: we go old style for :)
    // To avoid any issue with server throtling, the logic is performed in a synchronous serial way with sleep delays.
    for (charIndex = 0; charIndex < charsInfo.length; charIndex++) {
        let charDict = charsInfo[charIndex];

        if (totalCharactersCnt < savedOptions['mass_interact_max_chars']) {
            statusPElem.textContent = `Checking character ${charIndex + 1} out of ${charsInfo.length} (${charDict.name}).`;

            let interactUrl = `https://${hostName}${charDict.href}`;
            let response = await fetch(interactUrl, { "method": "GET", });
            let html = await response.text();

            // We wait to avoid server throtle limits
            await Utils.sleep(INTERACT_DELAY);

            // Initialize the DOM parser
            let parser = new DOMParser();

            // Parse the text
            let doc = parser.parseFromString(html, "text/html");

            let interactOptionsNodeSnapshot = interactSelectXpathHelper.getOrderedSnapshot(doc);

            // If interactions are available for this char, we are going to use them so we increment the counter of total characters we interacted with
            if (interactOptionsNodeSnapshot.snapshotLength > 0)
                totalCharactersCnt += 1;

            // Random interaction is an empty array by default, if interactions are available, it is randomly filled
            let randomInteraction = 1; // Greet

            // The interaction counter for the current character, mainly used to give feedback on the form page.
            let interactionCnt = 1;

            while (interactOptionsNodeSnapshot.snapshotLength > 0) {
                let availableInteractions = [];

                // We loop and we push possible values in availableInteractions
                for (let i = 0; i < interactOptionsNodeSnapshot.snapshotLength; i++) {
                    let interactionOption = interactOptionsNodeSnapshot.snapshotItem(i);
                    let value = parseInt(interactionOption.getAttribute('value'));
                    let dataGroup = interactionOption.hasAttribute('data-group') ? String(interactionOption.getAttribute('data-group')) : '';

                    if (value !== 0 && dataGroup !== 'Phone') {
                        availableInteractions.push(value);
                    }

                }

                // We intersect possible available interactions with possible ones
                let possibleInteractions = availableInteractions.filter(value => INTERACTIONS.includes(value));

                // We finally choose a random interaction
                if (possibleInteractions.length > 0)
                    randomInteraction = possibleInteractions.sort(() => 0.5 - Math.random())[0];
                else
                    break;

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

                statusPElem.textContent = `Interacting with friend ${charIndex + 1} out of ${charsInfo.length} (${charDict.name}). Interaction # ${interactionCnt} ...`;

                // Synchronous fetch request
                response = await fetch(interactUrl, { "body": formDataNew, "method": "POST", });
                html = await response.text();
                await Utils.sleep(INTERACT_DELAY);

                // We update the parser content so to make sure the while does not go in infinite loop
                parser = new DOMParser();
                doc = parser.parseFromString(html, "text/html");
                interactOptionsNodeSnapshot = interactSelectXpathHelper.getOrderedSnapshot(doc);

                // We increase the counters
                interactionCnt++;
                totalInteractionsCnt++;
            }
        }

    }

    // Final update message with some statistics
    if (totalInteractionsCnt > 0)
        statusPElem.textContent = `Interacted a total of ${totalInteractionsCnt} with ${totalCharactersCnt} characters!`;
    else
        statusPElem.textContent = `No interaction has been performed.`;
}

/**
 * This function will inject the required HTML elements to make the "Mass Interact" functionality available in the character present page
 *
 */
function injectMassInteractHTML() {
    const FIND_FRIENDS_XPATH = '//div[@id="ctl00_cphLeftColumn_ctl00_divFilters"]';

    let findFriendsXPathHelp = new XPathHelper(FIND_FRIENDS_XPATH);
    let findFriendsNode = findFriendsXPathHelp.getFirstOrderedNode(document);

    if (findFriendsNode.singleNodeValue) {

        let MassInteractDiv = document.createElement('div');
        MassInteractDiv.setAttribute('class', 'box');

        let MassInteractH2 = document.createElement('h2');
        MassInteractH2.textContent = 'Mass Interact with present characters';

        let MassInteractP1 = document.createElement('p');
        MassInteractP1.textContent = 'Perform interactions with characters present in this locale.';
        let MassInteractP3 = document.createElement('p');
        MassInteractP3.setAttribute('id', 'mass-interact-status-p');
        MassInteractP3.textContent = '';

        let MassInteractP2 = document.createElement('p');
        MassInteractP2.setAttribute('class', 'actionbuttons');

        let MassInteractSubmit = document.createElement('input');
        MassInteractSubmit.setAttribute('type', 'submit');
        MassInteractSubmit.setAttribute('value', 'Mass Interact');
        MassInteractSubmit.setAttribute('class', 'cns');
        MassInteractSubmit.onclick = () => { onSubmitClick(); return false; };

        MassInteractP2.appendChild(MassInteractSubmit);

        MassInteractDiv.appendChild(MassInteractH2);
        MassInteractDiv.appendChild(MassInteractP1);
        MassInteractDiv.appendChild(MassInteractP3);
        MassInteractDiv.appendChild(MassInteractP2);

        findFriendsNode.singleNodeValue.parentNode.insertBefore(MassInteractDiv, findFriendsNode.singleNodeValue.nextSibling);
    }
}

injectMassInteractHTML();