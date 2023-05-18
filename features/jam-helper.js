// Main XPaths
const SONGS_LEVELS_XPATH = '//tr[contains(@id, "ctl00_cphLeftColumn_ctl01_repArtistRepertoire")]/td[5]/div';
const BUTTON_TD_XPATH = '//p[@class="actionbuttons"][1]';
const BOOKING_ASSISTANT_XPATH = "boolean(count(//a[contains(@href, '/Artist/BookingAssistant')]) >= 1)";

/**
 * Callback function for the 'Check not 100% Jammed' button
 *
 */
function toggleNotFullyJamed() {
    // We read the completition from the bar DIV element
    var songNodesXpathHelper = new XPathHelper(SONGS_LEVELS_XPATH);
    var songNodes = songNodesXpathHelper.getOrderedNodeIterator(document);

    let i = 0;
    let songRow;
    while ((songRow = songNodes.iterateNext())) {
        i += 1;

        // We use a regex to get the completition percentage
        let percentJam = parseInt(songRow.getAttribute('title').match(/(\d{1,3})%/)[1]);
        
        // We dinamically build the XPath for the checkbox
        const checkBoxXPATH = '//tr[contains(@id, "ctl00_cphLeftColumn_ctl")][' + i + ']/td[1]/input';
        let checkBoxXpathHelper = new XPathHelper(checkBoxXPATH);
        let checkBoxResult = checkBoxXpathHelper.getFirstOrderedNode(document);

        checkBoxResult.singleNodeValue.checked = (percentJam < 100) ? true : false;

    }

}

// We only apply this content script to a band you
let isBandXpathHelper = new XPathHelper(BOOKING_ASSISTANT_XPATH);
let isBand = isBandXpathHelper.getBoolean(document, true);

if (isBand) {

    let btnXPathHelper = new XPathHelper(BUTTON_TD_XPATH);
    var buttonNodeResult = btnXPathHelper.getFirstOrderedNode(document);

    if (buttonNodeResult.singleNodeValue) {
        let buttonNode = buttonNodeResult.singleNodeValue;

        var toggleButton = document.createElement('input');
        toggleButton.setAttribute('type', 'button');
        toggleButton.setAttribute('value', 'Check not 100% Jammed');
        toggleButton.addEventListener('click', toggleNotFullyJamed, false);
        buttonNode.insertBefore(toggleButton, buttonNode.firstChild);
    }

}