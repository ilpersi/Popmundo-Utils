'use strict';

const globalOptions = {
    'searchable_tables': true,
    'fast_character_switch': true,
    'band_popularity_shortcut': false,
    'band_upcoming_shows': false,
    'character_send_message': false,
    'character_offer_an_item': false,
    'character_call': false,
    'city_book_regular_flight': false,
    'city_charter_vip_jet': false,
    'city_other_vehicles': false,
    'locale_characters_present': false,
    'move_to_shortcut': true,
};

// Let's be sure that there is no JQuery conflict
const JQ = jQuery.noConflict();


/**
 * Enables the DataTable plugin whenever is possible.
 *
 */
function searchableTables() {
    JQ(document).ready(function () {
        try {
            JQ('table.data').DataTable({
                "paging": false,
                "dom": "lfrt",
                "order": [],
            });
        } catch (error) {
            // Do nothing
        }
    });
}

/**
 * Advanced calback to perform checks on character pages. When we are in our character page, if we try to click on generated links to call ourselves or to give items
 * to ourselves, the server will raise an error and under some circumstances it will also log us out. To avoid this we make it so that we do not generate icon links for
 * orselves whenever it is possible.
 * 
 * There is no way to distinguish between your character and other characters, so this is applying to all the characters.
 *
 * @param {Node} aElem - The node that contains the link to which we want to add one or more icons
 * @param {Number} elemID - The id of the element (can be the char id, a city id, a locale id and so on...)
 * @return {Boolean} - This will return true if additional icons should be rendered, false otherwise
 */
function checkCharPage(aElem, elemID) {
    let result = true;

    // To avoid mangling the layout of the conversation page, we do not render char icons there
    if (window.location.href.endsWith('/Conversations')) result = false;

    // Filter links to self in interaction pages
    if (result && window.location.href.includes('/Interact/')) {
        const idHolderXPath = "//div[@id='topcolumn']/div[1]/div/div[@class='idHolder']";
        let idHelper = new XPathHelper(idHolderXPath);
        let myID = idHelper.getString(document, true);
        let aElemHref = aElem.getAttribute('href');
        if (aElemHref.includes(myID)) result = false;
    }

    // Filter link to self in character pages
    if (result && window.location.href.includes('/Character')) {
        let pageCharID = Utils.getMyID();
        if (pageCharID != 0 && pageCharID == elemID) {
            let aElemHref = aElem.getAttribute('href');
            if (aElemHref.includes(elemID)) result = false;
        }
    }

    return result;
}

/**
 * Takes care of creating all the icon links whenever is is possible
 *
 * @param {option} object - A key/value object with saved options
 */
function handleIconLink(options) {
    let linkDB = [
        // Bankd links
        { 'option': 'band_upcoming_shows', 'xpath': "//a[contains(@href, 'Artist/')]", 're': /\/Artist\/(\d+)/m, 'urlCheck': '/Artist/UpcomingPerformances/', 'href': '/World/Popmundo.aspx/Artist/UpcomingPerformances/', 'img': 'images/calendar-list.png', 'title': 'Upcoming Shows' },
        { 'option': 'band_popularity_shortcut', 'xpath': "//a[contains(@href, 'Artist/')]", 're': /\/Artist\/(\d+)/m, 'urlCheck': '/Artist/Popularity/', 'href': '/World/Popmundo.aspx/Artist/Popularity/', 'img': 'images/star.png', 'title': 'Popularity' },
        // Character links
        { 'option': 'character_send_message', 'xpath': "//a[contains(@href, 'Character/')]", 're': /\/Character\/(\d+)/m, 'urlCheck': '/Conversation/', 'advanceCheckCB': checkCharPage, 'href': '/World/Popmundo.aspx/Conversations/Conversation/', 'img': 'images/mail--arrow.png', 'title': 'Send Message' },
        { 'option': 'character_offer_an_item', 'xpath': "//a[contains(@href, 'Character/')]", 're': /\/Character\/(\d+)/m, 'urlCheck': '/OfferItem/', 'advanceCheckCB': checkCharPage, 'href': '/World/Popmundo.aspx/Character/OfferItem/', 'img': 'images/box--arrow.png', 'title': 'Offer an Item' },
        { 'option': 'character_call', 'xpath': "//a[contains(@href, 'Character/')]", 're': /\/Character\/(\d+)/m, 'urlCheck': '/Phone/', 'advanceCheckCB': checkCharPage, 'href': '/World/Popmundo.aspx/Interact/Phone/', 'img': 'images/mobile-phone.png', 'title': 'Call' },
        // City links
        { 'option': 'city_other_vehicles', 'xpath': "//a[contains(@href, 'City/')]", 're': /\/City\/(\d+)/m, 'urlCheck': '/RoadTrip/', 'href': '/World/Popmundo.aspx/City/RoadTrip/', 'img': 'images/car--arrow.png', 'title': 'Other Vehicles' },
        { 'option': 'city_charter_vip_jet', 'xpath': "//a[contains(@href, 'City/')]", 're': /\/City\/(\d+)/m, 'urlCheck': '/PrivateJet/', 'href': '/World/Popmundo.aspx/City/PrivateJet/', 'img': 'images/paper-plane--plus.png', 'title': 'Charter VIP Jet' },
        { 'option': 'city_book_regular_flight', 'xpath': "//a[contains(@href, 'City/')]", 're': /\/City\/(\d+)/m, 'urlCheck': '/BookFlight/', 'href': '/World/Popmundo.aspx/City/BookFlight/', 'img': 'images/paper-plane--arrow.png', 'title': 'Book Regular Flight' },
        // Locale links
        { 'option': 'move_to_shortcut', 'xpath': "//a[contains(@href, 'Locale/')]", 're': /\/Locale\/(\d+)/m, 'urlCheck': '/Locale/', 'href': '/World/Popmundo.aspx/Locale/MoveToLocale/', 'img': 'images/movetolocale.png', 'title': 'Move To Locale' },
        { 'option': 'locale_characters_present', 'xpath': "//a[contains(@href, 'Locale/')]", 're': /\/Locale\/(\d+)/m, 'urlCheck': '/Locale/', 'href': '/World/Popmundo.aspx/Locale/CharactersPresent/', 'img': 'images/users.png', 'title': 'Characters Present' },
    ];

    for (let linkInfo of linkDB) {

        // If option is not present or false, we continue.
        if (!options.hasOwnProperty(linkInfo.option)) continue;
        if (!options[linkInfo.option]) continue;

        // Let's get the link a nodes
        let xpathHelper = new XPathHelper(linkInfo.xpath);
        let linkNodes = xpathHelper.getOrderedSnapshot(document);

        for (let i = 0; i < linkNodes.snapshotLength; i++) {
            let aElem = linkNodes.snapshotItem(i);

            // We need aditional checks on the location url
            let linkHref = aElem.getAttribute('href');
            let linkMatch = linkInfo.re.exec(linkHref);

            // XPath is matching, but it is not exactly what we are looking for
            if (!linkMatch) continue;

            // We are looking at a link page and we do not want to add icon in there, as the move link is available
            if (window.location.href.includes(linkInfo.urlCheck + linkMatch[1])) continue;

            // Advanced checks are present
            if (linkInfo.hasOwnProperty('advanceCheckCB')) {
                if (!linkInfo.advanceCheckCB(aElem, linkMatch[1])) continue;
            }

            // New a elem
            var newAElem = document.createElement('a');
            newAElem.setAttribute('href', window.location.origin + linkInfo.href + linkMatch[1]);
            // moveAElem.textContent = ' ';

            // Icon img
            let imgElem = document.createElement('img');
            imgElem.setAttribute('src', chrome.runtime.getURL(linkInfo.img));
            imgElem.setAttribute('title', linkInfo.title);

            // Include incon in link
            newAElem.appendChild(imgElem);

            // Empty space between previous text/icon
            let pElem = document.createElement('span');
            pElem.textContent = ' ';

            // Append to popmundo page
            aElem.parentNode.insertBefore(newAElem, aElem.nextSibling);
            aElem.parentNode.insertBefore(pElem, aElem.nextSibling)
        }
    }


}

function fastCharSwitch(autoClick=false) {
    const CHAR_SELECT_XPATH = "//select[contains(@name, 'CurrentCharacter')]";
    const CHAR_SUBMIT_XPATH = "//input[@type = 'image' and contains(@name, 'ChangeCharacter')]";

    let xpathHelper = new XPathHelper(CHAR_SELECT_XPATH);
    let selectResult = xpathHelper.getFirstOrderedNode(document);
    if (selectResult.singleNodeValue) {
        selectResult.singleNodeValue.addEventListener('change', async (event) => {
            await chrome.storage.session.remove('my_char_id');
            xpathHelper.xpath = CHAR_SUBMIT_XPATH;
            let submitResult = xpathHelper.getFirstOrderedNode(document);
            if (submitResult.singleNodeValue && autoClick) submitResult.singleNodeValue.click();
        });
    }
}

// We initially get the options from the sync storage
chrome.storage.sync.get(globalOptions, items => {
    if (items.searchable_tables) searchableTables();
    handleIconLink(items);
    fastCharSwitch(items.fast_character_switch);
});
