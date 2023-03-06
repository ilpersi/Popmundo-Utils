const songOptionsValues = { 'song_popup': true };

var showSongPopUp = false;

function manageSongTooltips() {

    let popupTheme = Utils.getPopupTheme();

    // Initialization of the tippy element
    tippy('a[href^="/World/Popmundo.aspx/Character/Song"]', {
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
            fetch(href)
                .then(response => {
                    if (response.ok && response.status >= 200 && response.status < 300) {
                        return response.text();
                    }
                }).then(html => {
                    // Initialize the DOM parser
                    let parser = new DOMParser();

                    // Parse the text
                    let doc = parser.parseFromString(html, "text/html");
                    xpathHelper = new XPathHelper('//div[@class="box"]/table/tbody/tr/td');

                    let infoHTML = '';
                    let trNodes = xpathHelper.getOrderedSnapshot(doc);
                    if (trNodes.snapshotLength > 0) {
                        let tdNode = trNodes.snapshotItem(0);

                        let divNode = tdNode.parentNode.parentNode.parentNode.parentNode;

                        // We hard-code of the styles to make sure that the tool tip is correctly rendered 
                        divNode.setAttribute('style', `font-size: ${popupTheme.FONT_SIZE}; color:${popupTheme.COLOR};`);

                        // we make sure to correctly render the stars
                        infoHTML = divNode.outerHTML.replace(Utils.scriptRE, Utils.createStarCount);

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

// When page is loaded we get value from settings and se start the tippy logic.
chrome.storage.sync.get(songOptionsValues, items => {
    showSongPopUp = items.song_popup;

    manageSongTooltips();
});
