'use strict';

const JQ = jQuery.noConflict();
const globalOptions = {
    'searchable_tables': true,
    'move_to_shortcut': true,
};

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

chrome.storage.sync.get(globalOptions, items => {
    if (items.searchable_tables) searchableTables();
    if (items.move_to_shortcut) moveToLocaleLink();
});
