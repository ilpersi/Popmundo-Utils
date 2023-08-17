'use strict';

const globalOptions = {
    'searchable_tables': true,
    'move_to_shortcut': true,
    'fast_character_switch': true,
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
 * Takes care of creating all the "Move to locale" links whenever is is possible
 *
 */
function moveToLocaleLink() {
    const LOCALE_A_ELEMM = "//a[contains(@href, 'Locale/')]";
    const LOCALE_LINK_RE = /\/Locale\/(\d+)/gm;

    // Let's get the locales a nodes
    let xpathHelper = new XPathHelper(LOCALE_A_ELEMM);
    let localeNodes = xpathHelper.getOrderedSnapshot(document);

    for (let i = 0; i < localeNodes.snapshotLength; i++) {
        let aElem = localeNodes.snapshotItem(i);
        LOCALE_LINK_RE.lastIndex = 0;

        // We need aditional checks on the location url
        let localeHref = aElem.getAttribute('href');
        let localeMatch = LOCALE_LINK_RE.exec(localeHref);

        // XPath is matching, but it is not exactly a locale url
        if (!localeMatch) continue;

        // We are looking at a locale page and we do not want to add icon in there, as the move link is available
        if (window.location.href.includes('/Locale/' + localeMatch[1])) continue;

        // New a elem
        var moveAElem = document.createElement('a');
        moveAElem.setAttribute('href', window.location.origin + '/World/Popmundo.aspx/Locale/MoveToLocale/' + localeMatch[1]);
        moveAElem.textContent = ' ';

        // Move to icon
        let imgElem = document.createElement('img');
        imgElem.setAttribute('src', chrome.runtime.getURL('images/Gnome-application-exit.png'));
        imgElem.setAttribute('title', 'Move To Locale');

        // Include incon in link
        moveAElem.appendChild(imgElem);

        // Append to popmundo page
        aElem.parentNode.insertBefore(moveAElem, aElem.nextSibling);
    }
}

function fastCharSwitch() {
    const CHAR_SELECT_XPATH = "//select[contains(@name, 'CurrentCharacter')]";
    const CHAR_SUBMIT_XPATH = "//input[@type = 'image' and contains(@name, 'ChangeCharacter')]";

    let xpathHelper = new XPathHelper(CHAR_SELECT_XPATH);
    let selectResult = xpathHelper.getFirstOrderedNode(document);
    if (selectResult.singleNodeValue) {
        selectResult.singleNodeValue.addEventListener('change', event => {
            xpathHelper.xpath = CHAR_SUBMIT_XPATH;
            let submitResult = xpathHelper.getFirstOrderedNode(document);
            if (submitResult.singleNodeValue) submitResult.singleNodeValue.click();
        });
    }
}

chrome.storage.sync.get(globalOptions, items => {
    if (items.searchable_tables) searchableTables();
    if (items.move_to_shortcut) moveToLocaleLink();
    if (items.fast_character_switch) fastCharSwitch();
});
