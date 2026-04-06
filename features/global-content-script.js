'use strict';

const globalOptions = {
    'searchable_tables': true,
    'fast_character_switch': true,
    'band_popularity_shortcut': false,
    'band_popularity_shortcut_icon': '⭐',
    'band_upcoming_shows': false,
    'band_upcoming_shows_icon': '📅',
    'character_send_message': false,
    'character_send_message_icon': '✉️',
    'character_offer_an_item': false,
    'character_offer_an_item_icon': '📦',
    'character_call': false,
    'character_call_icon': '📱',
    'city_book_regular_flight': false,
    'city_book_regular_flight_icon': '✈️',
    'city_charter_vip_jet': false,
    'city_charter_vip_jet_icon': '🛩️',
    'city_other_vehicles': false,
    'city_other_vehicles_icon': '🚗',
    'city_find_locales': false,
    'city_find_locales_icon': '🔍',
    'locale_characters_present': false,
    'locale_characters_present_icon': '🧑‍🤝‍🧑',
    'move_to_shortcut': true,
    'move_to_shortcut_icon': '🚶',
    'crew_top_heist_shortcut': false,
    'crew_top_heist_shortcut_icon': '⭐',
    'locale_show_reconnaissance': false,
    'locale_show_reconnaissance_icon': '👀',
    'enhanced_links_font_size': 16,
    'log_level': Logger.ERROR,
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
function checkCharLinks(aElem, elemID) {
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
 * Advanced call back to check when to display icons on artist links (Popmundo)
 *
 * @param {Node} aElem - The node that contains the link to which we want to add one or more icons
 * @param {Number} elemID - The id of the element (can be the char id, a city id, a locale id and so on...)
 * @return {Boolean} - This will return true if additional icons should be rendered, false otherwise
 */
function checkBandLinks(aElem, elemID) {
    let isGH = Utils.isGreatHeist();

    return !isGH;
}

/**
 * Advanced call back to check when to display icons on crew links (The Great Heist)
 *
 * @param {Node} aElem - The node that contains the link to which we want to add one or more icons
 * @param {Number} elemID - The id of the element (can be the char id, a city id, a locale id and so on...)
 * @return {Boolean} - This will return true if additional icons should be rendered, false otherwise
 */
function checkCrewLinks(aElem, elemID) {
    let isGH = Utils.isGreatHeist();

    return isGH;
}

/**
 * Takes care of creating all the icon links whenever is is possible
 *
 * @param {option} object - A key/value object with saved options
 */
function handleIconLink(options) {
    let linkDB = [
        // Band links
        { 'option': 'band_upcoming_shows', 'xpath': "//a[contains(@href, 'Artist/')]", 're': /\/Artist\/(\d+)/m, 'urlCheck': '/Artist/UpcomingPerformances/', 'advanceCheckCB': checkBandLinks, 'href': '/World/Popmundo.aspx/Artist/UpcomingPerformances/', 'icon': '📅', 'title': chrome.i18n.getMessage('linkUpcomingShows') },
        { 'option': 'band_popularity_shortcut', 'xpath': "//a[contains(@href, 'Artist/')]", 're': /\/Artist\/(\d+)/m, 'urlCheck': '/Artist/Popularity/', 'advanceCheckCB': checkBandLinks, 'href': '/World/Popmundo.aspx/Artist/Popularity/', 'icon': '⭐', 'title': chrome.i18n.getMessage('linkPopularity') },
        // Crew links
        { 'option': 'crew_top_heist_shortcut', 'xpath': "//a[contains(@href, 'Artist/')]", 're': /\/Artist\/(\d+)/m, 'urlCheck': '/Artist/Popularity/', 'advanceCheckCB': checkCrewLinks, 'href': '/World/Popmundo.aspx/Artist/TopHeists/', 'icon': '⭐', 'title': chrome.i18n.getMessage('linkTopHeists') },
        // Character links
        { 'option': 'character_send_message', 'xpath': "//a[contains(@href, 'Character/')]", 're': /\/Character\/(\d+)/m, 'urlCheck': '/Conversation/', 'advanceCheckCB': checkCharLinks, 'href': '/World/Popmundo.aspx/Conversations/Conversation/', 'icon': '✉️', 'title': chrome.i18n.getMessage('linkSendMessage') },
        { 'option': 'character_offer_an_item', 'xpath': "//a[contains(@href, 'Character/')]", 're': /\/Character\/(\d+)/m, 'urlCheck': '/OfferItem/', 'advanceCheckCB': checkCharLinks, 'href': '/World/Popmundo.aspx/Character/OfferItem/', 'icon': '📦', 'title': chrome.i18n.getMessage('linkOfferItem') },
        { 'option': 'character_call', 'xpath': "//a[contains(@href, 'Character/')]", 're': /\/Character\/(\d+)/m, 'urlCheck': '/Phone/', 'advanceCheckCB': checkCharLinks, 'href': '/World/Popmundo.aspx/Interact/Phone/', 'icon': '📱', 'title': chrome.i18n.getMessage('linkCall') },
        // City links
        { 'option': 'city_other_vehicles', 'xpath': "//a[contains(@href, 'City/')]", 're': /\/City\/(\d+)/m, 'urlCheck': '/RoadTrip/', 'href': '/World/Popmundo.aspx/City/RoadTrip/', 'icon': '🚗', 'title': chrome.i18n.getMessage('linkOtherVehicles') },
        { 'option': 'city_find_locales', 'xpath': "//a[contains(@href, 'City/')]", 're': /\/City\/(\d+)/m, 'urlCheck': '/City/Locales/', 'href': '/World/Popmundo.aspx/City/Locales/', 'icon': '🔍', 'title': chrome.i18n.getMessage('linkFindLocales') },
        { 'option': 'city_charter_vip_jet', 'xpath': "//a[contains(@href, 'City/')]", 're': /\/City\/(\d+)/m, 'urlCheck': '/PrivateJet/', 'href': '/World/Popmundo.aspx/City/PrivateJet/', 'icon': '🛩️', 'title': chrome.i18n.getMessage('linkCharterJet') },
        { 'option': 'city_book_regular_flight', 'xpath': "//a[contains(@href, 'City/')]", 're': /\/City\/(\d+)/m, 'urlCheck': '/BookFlight/', 'href': '/World/Popmundo.aspx/City/BookFlight/', 'icon': '✈️', 'title': chrome.i18n.getMessage('linkBookFlight') },
        // Locale links
        { 'option': 'locale_show_reconnaissance', 'xpath': "//a[contains(@href, 'Locale/')]", 're': /\/Locale\/(\d+)/m, 'urlCheck': '/Locale/', 'advanceCheckCB': checkCrewLinks, 'href': '/World/Popmundo.aspx/Locale/Reconnaissance/', 'icon': '👀', 'title': chrome.i18n.getMessage('linkReconnaissance') },
        { 'option': 'move_to_shortcut', 'xpath': "//a[contains(@href, 'Locale/')]", 're': /\/Locale\/(\d+)/m, 'urlCheck': '/Locale/', 'href': '/World/Popmundo.aspx/Locale/MoveToLocale/', 'icon': '🚶', 'title': chrome.i18n.getMessage('linkMoveToLocale') },
        { 'option': 'locale_characters_present', 'xpath': "//a[contains(@href, 'Locale/')]", 're': /\/Locale\/(\d+)/m, 'urlCheck': '/Locale/', 'href': '/World/Popmundo.aspx/Locale/CharactersPresent/', 'icon': '🧑‍🤝‍🧑', 'title': chrome.i18n.getMessage('linkCharactersPresent') },
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

            // We don't want to add link on the top menu with shortcuts
            if (aElem.parentElement.tagName.toLowerCase() == 'div' && aElem.parentElement.id === 'character-tools-shortcuts') continue;

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
            newAElem.style.textDecoration = 'none';
            // moveAElem.textContent = ' ';

            // Icon span
            let iconElem = document.createElement('span');
            let iconOptionKey = linkInfo.option + '_icon';
            iconElem.textContent = (options[iconOptionKey] && options[iconOptionKey].trim()) ? options[iconOptionKey] : linkInfo.icon;
            iconElem.setAttribute('title', linkInfo.title);
            iconElem.style.cssText = `font-size:${options.enhanced_links_font_size}px; user-select:none;`;

            // Include icon in link
            newAElem.appendChild(iconElem);

            // Empty space between previous text/icon
            let pElem = document.createElement('span');
            pElem.textContent = ' ';

            // Append to popmundo page
            aElem.parentNode.insertBefore(newAElem, aElem.nextSibling);
            aElem.parentNode.insertBefore(pElem, aElem.nextSibling)
        }
    }


}

/**
 * This method will add a new onChange listner to the character select element. Whenever this is fired, the refers button is automatically clicked.
 *
 * @param {boolean} [autoClick=false]
 */
function fastCharSwitch(autoClick = false) {
    const CHAR_SELECT_XPATH = "//select[contains(@name, 'CurrentCharacter')]";
    const CHAR_SUBMIT_XPATH = "//input[@type = 'image' and contains(@name, 'ChangeCharacter')]";

    let xpathHelper = new XPathHelper(CHAR_SELECT_XPATH);
    let selectResult = xpathHelper.getFirstOrderedNode(document);
    if (selectResult.singleNodeValue) {
        selectResult.singleNodeValue.addEventListener('change', async (event) => {

            await chrome.runtime.sendMessage({
                'type': 'storage.session',
                'payload': 'remove',
                'param': 'my_char_id',
            });

            xpathHelper.xpath = CHAR_SUBMIT_XPATH;
            let submitResult = xpathHelper.getFirstOrderedNode(document);
            if (submitResult.singleNodeValue && autoClick) submitResult.singleNodeValue.click();
        });
    }
}

/**
 * This code will add a Popmundo menu inside the game. The idea is to have some options available in a handy place.
 * 
 * @param {string} install_type - The result of chrome.management.getSelf() method. Used to enable developer options.
 */
function renderIngameMenu(install_type) {
    const LAST_BOX_PATH = "//div[@id='ppm-sidemenu']//div[last()][contains(@class, 'box')]";

    let divBoxHelper = new XPathHelper(LAST_BOX_PATH);
    let divBoxResult = divBoxHelper.getUnorderedNodeSnapshot(document);

    if (divBoxResult.snapshotLength == 1) {
        // Last box Node
        let divNode = divBoxResult.snapshotItem(0);

        // New Box Node
        let newDiv = document.createElement('div');
        newDiv.setAttribute('class', 'box');

        // Box Title
        let newH2 = document.createElement('h2');
        newH2.textContent = chrome.i18n.getMessage('menuTitle');
        newDiv.appendChild(newH2);

        // Box Menu
        let newDivMenu = document.createElement('div');
        newDivMenu.setAttribute('class', 'menu');
        newDiv.appendChild(newDivMenu);

        // Menu UL
        let newUL = document.createElement('ul');
        newDivMenu.appendChild(newUL);

        // Developer Link - START
        if (install_type === 'development') {
            let newLIDeveloper = document.createElement('li');
            newUL.appendChild(newLIDeveloper);

            let newADeveloper = document.createElement('a');
            newADeveloper.setAttribute('href', '#');
            newADeveloper.textContent = chrome.i18n.getMessage('menuDeveloper');
            newADeveloper.addEventListener('click', (event) => {
                chrome.runtime.sendMessage(chrome.runtime.id, {
                    'type': 'cmd',
                    'payload': 'developer'
                });
                return false;
            });
            newLIDeveloper.appendChild(newADeveloper);
        }
        // Developer Link - END

        // Options Link - START
        let newLI = document.createElement('li');
        newUL.appendChild(newLI);

        let newA = document.createElement('a');
        newA.setAttribute('href', '#');
        newA.textContent = chrome.i18n.getMessage('menuOptions');
        newA.addEventListener('click', (event) => {
            chrome.runtime.sendMessage(chrome.runtime.id, {
                'type': 'cmd',
                'payload': 'open-options'
            });
            return false;
        });
        newLI.appendChild(newA);
        // Options Link - END

        // Report Issue Link - START
        let newLIIssue = document.createElement('li');
        newUL.appendChild(newLIIssue);

        let newAIssue = document.createElement('a');
        newAIssue.setAttribute('href', 'https://github.com/ilpersi/Popmundo-Utils/issues/new?assignees=&labels=&projects=&template=bug_report.md&title=');
        newAIssue.setAttribute('target', '_blank');
        newAIssue.textContent = chrome.i18n.getMessage('menuReportIssue');

        newLIIssue.appendChild(newAIssue);
        // Report Issue Link - END

        divNode.parentNode.insertBefore(newDiv, divNode.nextSibling);

    }

}

// We initially get the options from the sync storage
chrome.storage.sync.get(globalOptions, async (items) => {
    await Logger.init()
    if (items.log_level === Logger.DEBUG || Logger.debugMode) Logger.createDebugPanel();

    if (items.searchable_tables) searchableTables();
    handleIconLink(items);
    fastCharSwitch(items.fast_character_switch);

    let myCharID = Utils.getMyID();
    if (myCharID != 0) {
        await chrome.runtime.sendMessage({
            'type': 'storage.session',
            'payload': 'set',
            'param': { 'my_char_id': myCharID },
        });
    }

});

// This is the logic that takes care of performing the hot-reload of the extention
let localStorage = {
    'hot-reload': false, // check options/developer.js to understand how thi boolean toggle is managed
    'install_type': '', // check backgroud.js to see how the value is saved
}
chrome.storage.local.get(localStorage, (local) => {
    // When hot-reload is true, we open again the developer hot-reload page
    if (local['hot-reload']) {
        chrome.storage.local.set({ 'hot-reload': false }, () => {
            chrome.runtime.sendMessage(chrome.runtime.id, {
                'type': 'cmd',
                'payload': 'developer'
            });
        })
    }

    // In the local settings, we also store the install type. We use it to show additional links in game menu
    renderIngameMenu(local.install_type);
});

// We reload the pages once the hot-reload property is set to true
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName == 'local') {
        for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
            if (key == 'hot-reload' && newValue == true) {
                location.reload();
            }
        }
    }
})