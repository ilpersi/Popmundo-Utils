const skillOptionsValues = { 'recent_progress_popup': true };

var showPopUp = false;

/**
 * Will take care of rendering the correct stars in the recent activity pop-up.
 * This is to be used a call back for a regex replace. The original logic is inspired
 * by the standard popmundo function createStarCount (hope they don't sue me :D)
 *
 * @param {string} match The full regex matched. Mostly unused
 * @param {number} goldStars How many gold stars should we draw?
 * @param {number} whiteStars How many white stars should we draw? This should always be equal to 1
 * @param {number} greyStars How many grey stars should we draw?
 * @param {string} starTXT The title that will be given to returned div string
 * @param {string} starClass The CSS class to apply to the generated dive string
 * @param {string} imgPath Where to find the images for the stars
 * @param {boolean} txtOnly If set to true, only text is contained in returned div element (no star images)
 * @return {string} The HTML for a div element to include in your DOM model
 */
function createStarCount(match, goldStars, whiteStars, greyStars, starTXT, starClass, imgPath, txtOnly) {

    // We make sure to cast string in boolean
    txtOnly = (txtOnly === 'true');

    // Result div tag
    var result = "<div";

    if (starClass && "" != starClass)
        result += ' class="' + starClass + '"';

    result += ' title="' + starTXT + '">';

    if (txtOnly) {
        result += starTXT;
    }
    else {
        for (var s = 0; s < goldStars; s++)
            result += '<img src="' + imgPath + 'TinyStar_Gold.png" />';
        for (s = 0; s < whiteStars; s++)
            result += '<img src="' + imgPath + 'TinyStar_White.png" />';
        for (s = 0; s < greyStars; s++)
            result += '<img src="' + imgPath + 'TinyStar_Grey.png" />'
    }

    result += "</div>"

    return result;
}

/**
 * The main logic for the skill pop-up. This relies on the tippy.js library.
 *
 */
function manageSkillTooltips() {
    // We use CSS path to understand what skin is currently used
    const SKIN_XPATH = '//link[@rel="stylesheet" and contains(@href,"Theme") and contains(@href,"css") and @type="text/css"]';
    let xpathHelper = new XPathHelper(SKIN_XPATH);
    let skinCSSNode = xpathHelper.getFirstOrderedNode(document).singleNodeValue;

    // We initialize default values for all the properties
    let DATA_THEME = 'transparent';
    let NO_DATA_THEME = 'transparent';
    let LOADING_THEME = 'transparent';
    let COLOR = 'black';
    let FONT_SIZE = '11px';

    // Based on the used skin, we correctly set the properties
    if (skinCSSNode.getAttribute('href').includes('Dark')) { // Dark Theme
        DATA_THEME = 'transparent';
        NO_DATA_THEME = 'dark';
        LOADING_THEME = 'dark';
        COLOR = '#fff';
        FONT_SIZE = '11px';
    } else if (skinCSSNode.getAttribute('href').includes('Default')) { // Default Theme
        DATA_THEME = 'transparent';
        NO_DATA_THEME = 'retro';
        LOADING_THEME = 'retro';
        COLOR = '#000';
        FONT_SIZE = '11px';
    } else if (skinCSSNode.getAttribute('href').includes('Retro')) { // Default Theme
        DATA_THEME = 'retro';
        NO_DATA_THEME = 'retro';
        LOADING_THEME = 'retro';
        COLOR = '#000';
        FONT_SIZE = '11px';
    }

    // Initialization of the tippy element
    tippy('a[href^="/World/Popmundo.aspx/Help/SkillType"]', {
        'arrow': false,
        'content': showPopUp ? `<span style="color: ${COLOR};">Loading...</span>` : '',
        'allowHTML': true,
        'followCursor': true,
        'maxWidth': 500,
        //'delay': [0, 500000], // Uncomment if you need to debug the tippy tooltip
        'theme': LOADING_THEME,

        'onCreate': function (instance) {
            // Setup our own custom state properties
            instance._isFetching = false;
            instance._src = null;
            instance._error = null;
        },

        'onShow': function (instance) {

            if (!showPopUp) {
                instance.setContent('');
                return false
            };

            // Make sure fetch is not called multiple times
            if (instance._isFetching || instance._src || instance._error) {
                return;
            }
            instance._isFetching = true;

            // Long Regex to find the script tags used to render the stars
            const scriptRE = /<script type="text\/javascript">drawStarCount\((?<goldStars>[0-5]),\s*(?<whiteStars>[0-5]),\s*(?<greyStars>[0-5]),\s*"(?<starTXT>[^"]+?)",\s*"(?<starClass>[^"]*?)",\s*"(?<imgPath>[^"]*?)",\s*(?<txtOnly>false|true)\s*\);*<\/script>/gm;

            // Tippy popup is triggered on mouse Over on skill links. To understand the details,
            // we need to know the full of the page containing the skill information
            let href = instance.reference.getAttribute('href');

            let theme = DATA_THEME;
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
                    xpathHelper = new XPathHelper('//div[@class="box"]/table/tbody/tr[@class="odd"]/td[4]');

                    let infoHTML = '';
                    let trNodes = xpathHelper.getOrderedSnapshot(doc);
                    if (trNodes.snapshotLength > 0) {
                        let tdNode = trNodes.snapshotItem(0);

                        let divNode = tdNode.parentNode.parentNode.parentNode.parentNode;

                        // We hard-code of the styles to make sure that the tool tip is correctly rendered 
                        divNode.setAttribute('style', `font-size: ${FONT_SIZE}; color:${COLOR};`);

                        // we make sure to correctly render the stars
                        infoHTML = divNode.outerHTML.replace(scriptRE, createStarCount);

                    } else {
                        // No skill info is present
                        infoHTML = `<span style="color: ${COLOR};">No information available.</span>`;
                        theme = NO_DATA_THEME;
                    }

                    instance._src = infoHTML;
                    instance.setProps({ 'theme': theme });
                    instance.setContent(infoHTML);

                }).catch((error) => {
                    instance._error = error;
                    instance.setContent(`<span style="color: ${COLOR};">Request failed. ${error}</span>`);
                })
                .finally(() => {
                    instance._isFetching = false;
                });
        },

        'onHidden': function (instance) {
            instance.setProps({ 'theme': LOADING_THEME });
            instance.setContent(showPopUp ? `<span style="color: ${COLOR};">Loading...</span>` : '',);
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
            if (key == 'recent_progress_popup') showPopUp = newValue;
        }
    }

});

// When page is loaded we get value from settings and se start the tippy logic.
chrome.storage.sync.get(skillOptionsValues, items => {
    showPopUp = items.recent_progress_popup;

    manageSkillTooltips();
});