const showDetailsPopUpOptionsValues = { 'show_details_popup': true };

var showClubPopUp = false;

/**
 * The main logic for the skill pop-up. This relies on the tippy.js library.
 *
 */
function manageDetailsTooltips() {

    let popupTheme = Utils.getPopupTheme();
    let fetcher = new TimedFetch();

    // Initialization of the tippy element
    tippy('a[href^="/World/Popmundo.aspx/Artist/PerformanceDetails/"]', {
        'arrow': false,
        'content': showClubPopUp ? `<span style="color: ${popupTheme.COLOR};">Loading...</span>` : '',
        'allowHTML': true,
        'followCursor': true,
        'maxWidth': 500,
        //'delay': [0, 500000], // Uncomment if you need to debug the tippy tooltip
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

            // Tippy popup is triggered on mouse Over on skill links. To understand the details,
            // we need to know the full of the page containing the skill information
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

                    xpathHelper = new XPathHelper('//div[@class="box" and position() >1 and position() < 5]');

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
                        // No skill info is present
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

// When settings are changed, we update the global showPopUp varialbe
chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace == 'sync') {
        for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
            if (key == 'show_details_popup') showClubPopUp = newValue;
        }
    }

});

// When page is loaded we get value from settings and se start the tippy logic.
chrome.storage.sync.get(showDetailsPopUpOptionsValues, items => {
    showClubPopUp = items.show_details_popup;

    manageDetailsTooltips();
});