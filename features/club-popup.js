const clubPopUpOptionsValues = { 'show_club_popup': true };

var showClubPopUp = false;

/**
 * The main logic for the club info pop-up. This relies on the tippy.js library.
 *
 */
function manageClubTooltips() {

    let popupTheme = Utils.getPopupTheme();
    let fetcher = new TimedFetch();

    // Initialization of the tippy element
    tippy('a[href^="/World/Popmundo.aspx/Locale/"]', {
        'arrow': false,
        'content': showClubPopUp ? `<span style="color: ${popupTheme.COLOR};">Loading...</span>` : '',
        'allowHTML': true,
        'followCursor': false,
        'hideOnClick': false,
        'interactive': true,
        'maxWidth': 500,
        // 'delay': [0, 500], // We wait a second to hide the tooltip because there may be interesting links to click
        'theme': popupTheme.LOADING_THEME,

        'onCreate': function (instance) {
            // Setup our own custom state properties
            instance._isFetching = false;
            instance._src = null;
            instance._error = null;
        },

        'onShow': function (instance) {

            if (!showClubPopUp) {
                instance.setContent('');
                return false
            };

            // Make sure fetch is not called multiple times
            if (instance._isFetching || instance._src || instance._error) {
                return;
            }
            instance._isFetching = true;

            // Tippy popup is triggered on mouse Over on club links. To understand the details,
            // we need to know the full of the page containing the club information
            let href = instance.reference.getAttribute('href');

            let theme = popupTheme.DATA_THEME;
            fetcher.fetch(href)
                .then(async (html) => {
                    html = html.replace(Utils.starsJSRE, Utils.createStarCount);

                    // Initialize the DOM parser
                    let parser = new DOMParser();

                    // Parse the text
                    let doc = parser.parseFromString(html, "text/html");

                    let scoring = new Scoring();
                    // await scoring.applyBarPercentage(doc);
                    await scoring.applyScoringNumbers(doc);

                    xpathHelper = new XPathHelper('//div[@class="box" and position() >1]');

                    let infoHTML = '';
                    let divNodes = xpathHelper.getOrderedSnapshot(doc);
                    
                    if (divNodes.snapshotLength > 0) {
                        for (let i = 0; i < divNodes.snapshotLength; i++) {
                            let divNode = divNodes.snapshotItem(i);

                            // We hard-code the styles to make sure that the tool tip is correctly rendered 
                            divNode.setAttribute('style', `font-size: ${popupTheme.FONT_SIZE}; color:${popupTheme.COLOR};`);

                            // we make sure to correctly render the stars
                            infoHTML += divNode.outerHTML;
                        }
                    } else {
                        // No club info is present
                        infoHTML = `<span style="color: ${popupTheme.COLOR};">No information available.</span>`;
                        theme = popupTheme.NO_DATA_THEME;
                    }

                    instance._src = infoHTML;
                    instance.setProps({ 'theme': theme });
                    instance.setContent(infoHTML);

                }).catch((error) => {
                    instance._error = error;
                    instance.setContent(`<span style="color: ${popupTheme.COLOR};">Request failed. ${error}</span>`);
                })
                .finally(() => {
                    instance._isFetching = false;
                });
        },

        'onHidden': function (instance) {
            instance.setProps({ 'theme': popupTheme.LOADING_THEME });
            instance.setContent(showClubPopUp ? `<span style="color: ${popupTheme.COLOR};">Loading...</span>` : '',);
            // Unset these properties so new network requests can be initiated
            instance._src = null;
            instance._error = null;
        },
    })
}

// When settings are changed, we update the global showClubPopUp varialbe
chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace == 'sync') {
        for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
            if (key == 'show_club_popup') showClubPopUp = newValue;
        }
    }

});

// When page is loaded we get value from settings and se start the tippy logic.
// We only apply the logic for popmundo, not for TGH
if (!Utils.isGreatHeist()) {
    chrome.storage.sync.get(clubPopUpOptionsValues, items => {
        showClubPopUp = items.show_club_popup;
    
        manageClubTooltips();
    });
}