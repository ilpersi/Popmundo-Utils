const charPopupOptionsValues = { 'character_popup': true };

var showCharacterPopUp = false;

/**
 * The main logic for the skill pop-up. This relies on the tippy.js library.
 *
 */
function manageCharacterTooltips() {

    let popupTheme = Utils.getPopupTheme();
    let fetcher = new TimedFetch();

    // Initialization of the tippy element
    tippy('a[href^="/World/Popmundo.aspx/Character/"]', {
        'arrow': false,
        'content': showCharacterPopUp ? `<span style="color: ${popupTheme.COLOR};">Loading...</span>` : '',
        'allowHTML': true,
        'followCursor': true,
        'maxWidth': 600,
        // 'delay': [0, 500000], // Uncomment if you need to debug the tippy tooltip
        'theme': popupTheme.LOADING_THEME,

        'onCreate': function (instance) {
            // Setup our own custom state properties
            instance._isFetching = false;
            instance._src = null;
            instance._error = null;
        },

        'onShow': function (instance) {
            // We make sure to show the popup only on characters links
            let charHref = instance.reference.getAttribute('href');
            if (!/\/World\/Popmundo.aspx\/Character\/\d+/gm.test(charHref)) return false;

            if (!showCharacterPopUp) {
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
                    // Initialize the DOM parser
                    let parser = new DOMParser();

                    // Parse the text
                    let doc = parser.parseFromString(html, "text/html");
                    let divXpathHelper = new XPathHelper('//*[@id="ppm-content"]/div[position()<3]');
                    let imgSrcXpathHelper = new XPathHelper("//img[contains(@src, '../')]");

                    let infoHTML = '';
                    let divNodes = divXpathHelper.getOrderedSnapshot(doc);
                    if (divNodes.snapshotLength > 0) {

                        for (let i = 0; i < divNodes.snapshotLength; i++) {
                            let divNode = divNodes.snapshotItem(i);

                            let imgNodes = imgSrcXpathHelper.getOrderedSnapshot(divNode);
                            for (let j = 0; j < imgNodes.snapshotLength; j++) {
                                let imgNode = imgNodes.snapshotItem(j);

                                imgNode.setAttribute('src', '/' + imgNode.getAttribute('src').replaceAll('../', '') );
                            }

                            // We hard-code of the styles to make sure that the tool tip is correctly rendered 
                            divNode.setAttribute('style', `font-size: ${popupTheme.FONT_SIZE}; color:${popupTheme.COLOR};`);
   
                            infoHTML += divNode.outerHTML.replace(Utils.progressBarJSRE, Utils.createProgressBar);
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
            instance.setContent(showCharacterPopUp ? `<span style="color: ${popupTheme.COLOR};">Loading...</span>` : '',);
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
            if (key == 'character_popup') showCharacterPopUp = newValue;
        }
    }

});

// When page is loaded we get value from settings and se start the tippy logic.
chrome.storage.sync.get(charPopupOptionsValues, items => {
    showCharacterPopUp = items.character_popup;

    manageCharacterTooltips();
});