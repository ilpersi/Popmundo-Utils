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
        'popperOptions': {
            'modifiers': [
                {
                    'name': 'preventOverflow',
                    'options': {
                        'boundary': 'viewport',
                        'padding': 8,
                    },
                },
                {
                    'name': 'flip',
                    'options': {
                        'fallbackPlacements': ['top', 'bottom', 'left', 'right'],
                    },
                },
            ],
        },

        'onCreate': function (instance) {
            // Setup our own custom state properties
            instance._isFetching = false;
            instance._src = null;
            instance._error = null;
        },

        'onShow': function (instance) {
            // We make sure to show the popup only on characters links. This is requirede because
            // in the character page there are many links matching the css selector.
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
                .then(async (html) => {
                    html = html
                        .replace(Utils.starsJSRE, Utils.createStarCount)
                        .replace(Utils.progressBarJSRE, Utils.createProgressBar)
                        .replace(Utils.plusMinusBarJSRE, Utils.createPlusMinusBar);
                    
                    // Initialize the DOM parser
                    let parser = new DOMParser();

                    // Parse the text
                    let doc = parser.parseFromString(html, "text/html");

                    // we appry bar percentages
                    let scoring = new Scoring();
                    await scoring.applyBarPercentage(doc);

                    // We use CSS Selectors instead of slow XPaths to fix Firefox freezing.
                    let infoHTML = '';
                    let allDivs = new CssSelectorHelper('#ppm-content > div', doc).getAll();
                    
                    // We only want the first two div elements like the original xpath position()<3
                    let divNodes = Array.from(allDivs).slice(0, 2); 

                    if (divNodes.length > 0) {

                        for (let i = 0; i < divNodes.length; i++) {
                            let divNode = divNodes[i];

                            // Let's fix images src when required
                            let imgNodes = new CssSelectorHelper('img[src*="../"]', divNode).getAll();
                            for (let j = 0; j < imgNodes.length; j++) {
                                let imgNode = imgNodes[j];
                                imgNode.setAttribute('src', '/' + imgNode.getAttribute('src').replaceAll('../', '') );
                            }

                            // We hard-code the styles to make sure that the tool tip is correctly rendered 
                            divNode.setAttribute('style', `font-size: ${popupTheme.FONT_SIZE}; color:${popupTheme.COLOR};`);
   
                            infoHTML += divNode.outerHTML;
                        }

                        // We make sure that everything is https. Sometimes old characters still have http:// portraits
                        infoHTML = infoHTML.replaceAll('http://', 'https://')

                    } else {
                        // No character info is present
                        infoHTML = `<span style="color: ${popupTheme.COLOR};">No information available.</span>`;
                        theme = popupTheme.NO_DATA_THEME;
                    }

                    instance._src = infoHTML;
                    instance.setProps({ 'theme': theme });
                    instance.setContent(infoHTML);

                }).catch((error) => {
                    console.log(error.stack);
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