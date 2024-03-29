const skillOptionsValues = { 'recent_progress_popup': true };

var showSkillPopUp = false;

/**
 * The main logic for the skill pop-up. This relies on the tippy.js library.
 *
 */
function manageSkillTooltips() {

    let popupTheme = Utils.getPopupTheme();
    let fetcher = new TimedFetch();

    // Initialization of the tippy element
    tippy('a[href^="/World/Popmundo.aspx/Help/SkillType"]', {
        'arrow': false,
        'content': showSkillPopUp ? `<span style="color: ${popupTheme.COLOR};">Loading...</span>` : '',
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

            if (!showSkillPopUp) {
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
                .then(html => {
                    html = html.replace(Utils.starsJSRE, Utils.createStarCount);

                    // Initialize the DOM parser
                    let parser = new DOMParser();

                    // Parse the text
                    let doc = parser.parseFromString(html, "text/html");
                    xpathHelper = new XPathHelper('//div[@class="box"]/table/tbody/tr[@class="odd"]/td[4]');

                    let infoHTML = '';
                    let trNodes = xpathHelper.getOrderedSnapshot(doc);
                    if (trNodes.snapshotLength > 0) {
                        let tdNode = trNodes.snapshotItem(0);

                        let divNode = tdNode.parentNode.parentNode.parentNode.parentNode;

                        // We hard-code of the styles to make sure that the tool tip is correctly rendered 
                        divNode.setAttribute('style', `font-size: ${popupTheme.FONT_SIZE}; color:${popupTheme.COLOR};`);

                        // we make sure to correctly render the stars
                        infoHTML = divNode.outerHTML;

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
            instance.setContent(showSkillPopUp ? `<span style="color: ${popupTheme.COLOR};">Loading...</span>` : '',);
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
            if (key == 'recent_progress_popup') showSkillPopUp = newValue;
        }
    }

});

// When page is loaded we get value from settings and se start the tippy logic.
chrome.storage.sync.get(skillOptionsValues, items => {
    showSkillPopUp = items.recent_progress_popup;

    manageSkillTooltips();
});