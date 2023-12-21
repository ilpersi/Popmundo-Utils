const songOptionsValues = { 'song_popup': true };

let showSongPopUp = false;

function manageSongTooltips() {

    let popupTheme = Utils.getPopupTheme();
    let fetcher = new TimedFetch();

    // Initialization of the tippy element
    tippy('a[href^="/World/Popmundo.aspx/Character/Song/"]', {
        'arrow': false,
        'content': showSongPopUp ? `<span style="color: ${popupTheme.COLOR};">Loading...</span>` : '',
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

            if (!showSongPopUp) {
                instance.setContent('');
                return false
            };

            // Make sure fetch is not called multiple times
            if (instance._isFetching || instance._src || instance._error) {
                return;
            }
            instance._isFetching = true;

            // Tippy popup is triggered on mouse Over on song links. To understand the details,
            // we need to know the full of the page containing the song information
            let href = instance.reference.getAttribute('href');

            let theme = popupTheme.DATA_THEME;
            fetcher.fetch(href)
                .then(async (html) => {
                    html = html
                        .replace(Utils.starsJSRE, Utils.createStarCount) // star count
                        .replace(Utils.progressBarJSRE, Utils.createProgressBar) // progress bar
                        .replace(Utils.plusMinusBarJSRE, Utils.createPlusMinusBar); // plus/minus bar

                    // Initialize the DOM parser
                    let parser = new DOMParser();

                    // Parse the text
                    let doc = parser.parseFromString(html, "text/html");

                    let scoring = new Scoring();
                    await scoring.applyBarPercentage(doc);
                    await scoring.applyScoringNumbers(doc);

                    let xpathHelper = new XPathHelper('//div[@class="box"]/table/tbody/tr/td');
                    let checkMarketHelper = new XPathHelper("//p[count(a[contains(@href, 'BuySong')]) > 0]");

                    // The HTML content of the popup
                    let infoHTML = '';

                    // If fame is there, it means we do have song info to display
                    let trNodes = xpathHelper.getOrderedSnapshot(doc);
                    if (trNodes.snapshotLength > 0) {

                        // When song is part of song Market there is one additional div and we want to skip it
                        let isMaket = checkMarketHelper.getBoolean(doc, true);

                        // We get all the div with relevant information
                        let songInfoHelper = new XPathHelper("//div[@id='ppm-content']/div[@class='box']");

                        // Main song info
                        let divPositions = [0];
                        
                        // Dominant Instrument based on weater the song is on market or not
                        if (isMaket)
                            divPositions.push(2);
                        else
                            divPositions.push(1);

                        // We get all the divs to filter them later on
                        let divNodes = songInfoHelper.getOrderedSnapshot(doc)

                        // We only add to the popup the correct positions
                        divPositions.forEach(index => {
                            let infoNode = divNodes.snapshotItem(index);
                            // We hard-code some of the styles to make sure that the tool tip is correctly rendered 
                            infoNode.setAttribute('style', `font-size: ${popupTheme.FONT_SIZE}; color:${popupTheme.COLOR};`);

                            // we make sure to correctly render bars and stars
                            let newInnerHTML = infoNode.innerHTML;

                            // we apply the modifications to the original node
                            infoNode.innerHTML = newInnerHTML;

                            // We add HTML to popup content
                            infoHTML += infoNode.outerHTML;
                        })


                    } else {
                        // No song info is present
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
            instance.setContent(showSongPopUp ? `<span style="color: ${popupTheme.COLOR};">Loading...</span>` : '',);
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
            if (key == 'song_popup') showSongPopUp = newValue;
        }
    }

});

// When page is loaded we get value from settings and start the tippy logic.
chrome.storage.sync.get(songOptionsValues, items => {
    showSongPopUp = items.song_popup;

    manageSongTooltips();
});
