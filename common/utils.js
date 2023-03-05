/**
 * A generic class containing misc utilities methods to be used in different content scripts
 *
 * @class Utils
 */
class Utils {

    /**
     * Regular expression to find the javascript code used to draw stars in the game
     *
     * @readonly
     * @static
     * @memberof Utils
     */
    static get scriptRE() {
        const returnRE = /<script type="text\/javascript">drawStarCount\((?<goldStars>[0-5]),\s*(?<whiteStars>[0-5]),\s*(?<greyStars>[0-5]),\s*"(?<starTXT>[^"]+?)",\s*"(?<starClass>[^"]*?)",\s*"(?<imgPath>[^"]*?)",\s*(?<txtOnly>false|true)\s*\);*<\/script>/gm;
        return returnRE;
    } 

    /**
     * Get the id of your own character.
     *
     * @static
     * @return {int} The id of your character if found, otherwise 0
     * @memberof Utils
     */
    static getMyID() {
        let idHolderElem = document.querySelector('div.idHolder');

        return idHolderElem ? parseInt(idHolderElem.textContent) : 0;
    }

    /**
     * Get theme properties to coorectly dispay pop-ups in pages.
     *
     * @static
     * @param {*} [contextNode=document] The context node for the XPATH query
     * @return {object} An object containing the required properties to render the pop-up correctly 
     * @memberof Utils
     */
    static getPopupTheme(contextNode = document) {
        const SKIN_XPATH = '//link[@rel="stylesheet" and contains(@href,"Theme") and contains(@href,"css") and @type="text/css"]';

        let skinCSSResult = document.evaluate(SKIN_XPATH, contextNode, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null);

        // We initialize default values for all the properties
        var result = {
            DATA_THEME: 'transparent',
            NO_DATA_THEME: 'transparent',
            LOADING_THEME: 'transparent',
            COLOR: 'black',
            FONT_SIZE: '11px',
        }

        if (skinCSSResult.singleNodeValue) {
            let skinCSSNode = skinCSSResult.singleNodeValue;

            // Based on the used skin, we correctly set the properties
            if (skinCSSNode.getAttribute('href').includes('Dark')) { // Dark Theme
                result.DATA_THEME = 'transparent';
                result.NO_DATA_THEME = 'dark';
                result.LOADING_THEME = 'dark';
                result.COLOR = '#fff';
                result.FONT_SIZE = '11px';
            } else if (skinCSSNode.getAttribute('href').includes('Default')) { // Default Theme
                result.DATA_THEME = 'transparent';
                result.NO_DATA_THEME = 'retro';
                result.LOADING_THEME = 'retro';
                result.COLOR = '#000';
                result.FONT_SIZE = '11px';
            } else if (skinCSSNode.getAttribute('href').includes('Retro')) { // Default Theme
                result.DATA_THEME = 'retro';
                result.NO_DATA_THEME = 'retro';
                result.LOADING_THEME = 'retro';
                result.COLOR = '#000';
                result.FONT_SIZE = '11px';
            }
        }

        return result;

    }

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
    static createStarCount(match, goldStars, whiteStars, greyStars, starTXT, starClass, imgPath, txtOnly) {

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
}