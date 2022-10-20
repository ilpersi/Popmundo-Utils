const scoringOptionsValues = { 'score_highlight': true };

// Used by scoring system
const MAX_SCORED_ID = 26;
let rainbowBgColors = [];
let textColors = [];

/**
 * Get the rainbow color based on the score id. This is lousely based on chromemungo code by Tommi Rautava
 *
 * @param {number} scoreId The value of the score for which we want a color
 * @return {pm_TextColor} A pm_TextColor object that can be used to generate style definitions
 */
function getRainbowColor(scoreId) {
    var bgColor;
    var textColor;

    // Return previously calculated color.
    if (rainbowBgColors[scoreId]) {
        bgColor = rainbowBgColors[scoreId];
        textColor = textColors[bgColor];

        return new pm_TextColor(textColor, bgColor);
    }

    // Calculate background color.
    var hue = 360 - 330 * (scoreId / MAX_SCORED_ID);

    var rgbObj = pm_Color.convertHsvToRgb(hue, 1, 1);
    bgColor = rgbObj.toHex();

    // Calculate foreground color.
    textColor = pm_Color.idealTextColor(rgbObj.R, rgbObj.G, rgbObj.B);

    // Store colors.
    rainbowBgColors[scoreId] = bgColor;
    textColors[bgColor] = textColor;

    return new pm_TextColor(textColor, bgColor);

}

/**
 * The main logic to manage the scoring highlight. It will search for scoring nodes and
 * apply the proper formatting
 *
 */
function scoringNumbers() {

    // Regex used to get the score value from the a element title
    const TITLE_RE = /(\d{1,2})\/26/gm;

    // The XPATH to get scores from
    const SCORE_LINK_XPATH = '//a[contains(@href, "Scoring")]';

    // Let's get the scoring nodes
    let xpathHelper = new XPathHelper(SCORE_LINK_XPATH);
    let scoreNodes = xpathHelper.getOrderedSnapshot(document);

    for (let i = 0; i < scoreNodes.snapshotLength; i++) {
        let scoreNode = scoreNodes.snapshotItem(i);

        // Using the regex, we get the score value
        var titleMatch = TITLE_RE.exec(scoreNode.getAttribute('title'));
        if (titleMatch) {
            let scoreInt = parseInt(titleMatch[1]);
            let textColor = getRainbowColor(scoreInt);

            // Empty span element to make sure we have some space between the name of the score and the numeric value
            let spaceElem = document.createElement('span');
            spaceElem.textContent = ' ';

            // The span with the numbering value
            let scoreElem = document.createElement('span');
            scoreElem.innerHTML = '&nbsp;' + scoreInt + '&nbsp;';
            scoreElem.setAttribute('style', textColor.toString());
            scoreElem.setAttribute('style', scoreElem.getAttribute('style') + ' font-weight: bold;');

            // We append the created span elements
            scoreNode.parentNode.appendChild(spaceElem);
            scoreNode.parentNode.appendChild(scoreElem);
        }

        // We make sure the regex is working in the next iteration
        TITLE_RE.lastIndex = 0;
    }

}


// When page is loaded we get value from settings and we trigger the logic if the option is enabled
chrome.storage.sync.get(scoringOptionsValues, items => {
    if (items.score_highlight) scoringNumbers();
});
