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
    static get starsJSRE() {
        const returnRE = /<script type="text\/javascript">drawStarCount\((?<goldStars>[0-5]),\s*(?<whiteStars>[0-5]),\s*(?<greyStars>[0-5]),\s*"(?<starTXT>[^"]+?)",\s*"(?<starClass>[^"]*?)",\s*"(?<imgPath>[^"]*?)",\s*(?<txtOnly>false|true)\s*\);*<\/script>/gm;
        return returnRE;
    }

    /**
     * Regular expression to find the javascript code used to draw progress bars in the game
     *
     * @readonly
     * @static
     * @memberof Utils
     */
    static get progressBarJSRE() {
        // <script type="text/javascript">drawProgressBar(0, false, "0%", "progressBar", false, "0%");</script>
        const returnRE = /<script type="text\/javascript">drawProgressBar\((?<progressInt>[0-9]{1,3}),\s*(?<bool1>false|true),\s*"(?<progressStr>[^"]+?)",\s*"(?<style>[^"]+?)",\s*(?<bool2>false|true),\s*"(?<progressStr2>[^"]+?)"s*\);<\/script>/gm;
        return returnRE;
    }

    /**
     * Regular expression to find the javascript code used to draw plus-minus bars in the game
     *
     * @readonly
     * @static
     * @memberof Utils
     */
    static get plusMinusBarJSRE() {
        // <script type="text/javascript">drawPlusMinusBar(0, "0%", "plusMinusBar", false, "0%");</script>
        const returnRE = /<script type="text\/javascript">drawPlusMinusBar\((?<progressInt>[0-9]{1,3}),\s*"(?<progressStr>[^"]+?)",\s*"(?<style>[^"]+?)",\s*(?<bool1>false|true),\s*"(?<progressStr2>[^"]+?)"s*\);<\/script>/gm;
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
        const SKIN_XPATH = '//link[@rel="stylesheet" and contains(@href,"Theme") and contains(@href,"css") and @type="text/css" and not(contains(@href,"jquery"))]';

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

            let cssHref = skinCSSNode.getAttribute('href').toLowerCase();

            // Based on the used skin, we correctly set the properties
            if (cssHref.includes('dark')) { // Dark Theme
                result.DATA_THEME = 'dark';
                result.NO_DATA_THEME = 'dark';
                result.LOADING_THEME = 'dark';
                result.COLOR = '#fff';
                result.FONT_SIZE = '11px';
            } else if (cssHref.includes('default')) { // Default Theme
                result.DATA_THEME = 'default';
                result.NO_DATA_THEME = 'retro';
                result.LOADING_THEME = 'retro';
                result.COLOR = '#000';
                result.FONT_SIZE = '11px';
            } else if (cssHref.includes('retro')) { // Default Theme
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
     * Will take care of rendering the correct stars from a regex match.
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
        let result = "<div";

        if (starClass && "" != starClass)
            result += ' class="' + starClass + '"';

        result += ' title="' + starTXT + '">';

        if (txtOnly) {
            result += starTXT;
        }
        else {
            let s;
            for (s = 0; s < goldStars; s++)
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
     * Will take care of rendering progress bars from a regex match.
     * This is to be used a call back for a regex replace. The original logic is inspired
     * by the standard popmundo function createStarCount (yes, this is one more reason to sue me)
     *
     * @static
     * @param {string} match The full regex matched, unused and only present as this is the explected signature
     * @param {number} progressInt The numeric value of the progress bar
     * @param {boolean} bool1 When true, the class of the bar is reverted
     * @param {string} progressStr The string value of the bar progression 
     * @param {string} style Additional styles for the outer dive element
     * @param {boolean} bool2 If true an additional inner div is present
     * @param {string} progressStr2 Only used whe bool2 is true
     * @return {string} The correct HTML to render the progress bar 
     * @memberof Utils
     */
    static createProgressBar(match, progressInt, bool1, progressStr, style, bool2, progressStr2) {

        // We make sure that boolean values are correctly casted
        bool1 = (bool1 === 'true');
        bool2 = (bool2 === 'true');

        let result = "<div";

        if (style && "" != style)
            result += ' class="' + style + '"';

        result += ' title="' + progressStr + '">';

        if (progressInt > 0) {
            result += '<div class="';

            if (bool1) {
                if (progressInt < 31) {
                    result += "full";
                } else if (progressInt < 71) {
                    result += "high";
                } else if (progressInt < 100) {
                    result += "med";
                } else {
                    result += "low";
                }
            } else {
                if (progressInt < 31) {
                    result += "low";
                } else if (progressInt < 71) {
                    result += "med";
                } else if (progressInt < 100) {
                    result += "high";
                } else {
                    result += "full";
                }
            }

            result += '" style="width: ' + progressInt + '%;">';

            if (bool2)
                result += "<div>" + progressStr2 + "</div>";

            result += "</div>";

        }

        result += "</div>";

        return result;
    }

    /**
     * Will take care of rendering plus-minus bar starting from a regex match
     *
     * @static
     * @param {string} match The full regex matched, unused and only present as this is the explected signature
     * @param {number} progressInt The integer value of the plus-minus bar percentage
     * @param {string} progressStr The string representation of the plus-minus bar percentage
     * @param {string} style Additional class details for the outer div element
     * @param {boolean} bool1 If true and additional inner DIV element is created
     * @param {string} progressStr2 Only used whe bool1 is true
     * @return {string} The exepcted HTML to render the plus-minus bar
     * @memberof Utils
     */
    static createPlusMinusBar(match, progressInt, progressStr, style, bool1, progressStr2) {

        // We make sure that boolean values are correctly casted
        bool1 = (bool1 === 'true');

        let result = "<div";

        if (style && "" != style)
            result += ' class="' + style + '"';

        result += ' title="' + progressStr + '">';

        result += '<div class="negholder">';
        if (progressInt < 0) {
            result += '<div class="neg" style="width: ' + -progressInt + '%">';

            if (bool1)
                result += "<div>" + progressStr2 + "</div>";

            result += "</div>";
        }
        result += "</div>";

        result += '<div class="posholder">';
        if (progressInt > 0) {
            result += '<div class="pos" style="width: ' + progressInt + '%">';

            if (bool1)
                result += "<div>" + progressStr2 + "</div>";

            result += "</div>"

        } else if (0 == progressInt) {
            result += '<div class="zero">';

            if (bool1)
                result += "<div>" + progressStr2 + "</div>";

            result += "</div>"
        }

        result += "</div></div>";

        return result;
    }

    /**
     * Get a link path with the correct server number.
     *
     * @static
     * @param {String} urlPath The link path
     * @return {String} The string with the correct url according to the current server 
     * @memberof Utils
     */
    static getServerLink(urlPath) {
        // We make sure to have the trailing slash
        if (!urlPath.endsWith('/')) urlPath += '/';

        return `https://${window.location.hostname}${urlPath}`
    }

    /**
     * The old ever-green sleep method implemente using promises
     *
     * @static
     * @param {number} delay
     * @memberof Utils
     */
    static async sleep(delay) {
        await new Promise(r => setTimeout(r, delay));
    }

    /**
     * Make an iterator returning elements from the iterable
     * cycle('ABCD') --> A B C D A B C D A B C D ...
     *
     * @static
     * @param {Iterable} iterable Any iterable items that can be looped using the iteration protocol
     * @memberof Utils
     */
    static * cycle(iterable) {
        while (true) {
            for (let element of iterable)
                yield element
        }
    }

    /**
     * Randomly sort the elements of an input array. 
     * Original code frome https://stackoverflow.com/a/2450976/1280443
     *
     * @static
     * @param {Array} inputArray The input array to shuffle
     * @param {boolean} [deepCopy=true] If set to false, the array will be sorted in place, otherwise a deep copy will be crated
     * @return {Array} 
     * @memberof Utils
     */
    static shuffle(inputArray, deepCopy=true) {
        // We copy the original array either shallow or deep
        let result = deepCopy ? JSON.parse(JSON.stringify(inputArray)) : inputArray;

        let currentIndex = result.length, randomIndex;

        // While there remain elements to shuffle.
        while (currentIndex != 0) {

            // Pick a remaining element.
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            [result[currentIndex], result[randomIndex]] = [
                result[randomIndex], result[currentIndex]];
        }

        return result;
    }
}

/**
 * This class is a wrapper around the standard fetch method. Popmundo servers are throttling the requests and if you
 * perform too many requests, you get disconnected. Unders some circumstances (e.g. when showing pop-ups), this can
 * lead to unexpected log-outs. To avoid this, this class is able to delay the fetch calls and it also has a built-in
 * cache logic to minimize the impact on the popmundo servers.
 *
 * @class TimedFetch
 */
class TimedFetch {
    #delay = 750;
    #lastCall = Date.now() - this.#delay;
    #cache = {};
    #useCache = true;

    /**
     * Creates an instance of TimedFetch.
     * @param {boolean} [useCache=true] Should we use the built-in cache?
     * @memberof TimedFetch
     */
    constructor(useCache = true) {
        this.#useCache = useCache;
    }

    /**
     * @param {number} delay The desired value for the fetch call delay
     */
    set delay(delay) {
        this.#delay = delay;
    }

    /**
     * The getter method for the fetch delay
     *
     * @memberof TimedFetch
     */
    get delay() {
        return this.#delay;
    }

    /**
     * The main logic around the standard fetch method. This method is also centralizing the logic to manage
     * the status checks and it will either resolve with the html content or reject with an error message.
     * 
     * For more details on the parameters, check the offical fetch documentation: https://developer.mozilla.org/en-US/docs/Web/API/fetch
     *
     * @param {string} resource The resource to fetch
     * @param {*} [options={}] An object containing any custom settings that you want to apply to the request.
     * @return {string} The HTML content of the desired page
     * @memberof TimedFetch
     */
    async fetch(resource, options = {}) {

        // We can use a cached response, let's go for it!
        if (this.#useCache && this.#cache.hasOwnProperty(resource)) {
            var result = new Promise((resolve) => {
                resolve(this.#cache[resource]);
            });

            return result;
        } else {

            while (true) {
                // let's check if it is the right moment to perform another fetch
                let timeDiff = Date.now() - this.#lastCall;

                if (timeDiff >= this.#delay) {
                    this.#lastCall = Date.now();

                    var result = new Promise((resolve, reject) => {
                        fetch(resource, options)
                            .then(response => {
                                if (response.ok && response.status >= 200 && response.status < 300) {
                                    return response.text();
                                } else {
                                    reject('Bad response status: ' + response.status);
                                }
                            }).then(html => {
                                if (this.#useCache) {
                                    this.#cache[resource] = html;
                                }
                                resolve(html);
                            }).catch((error) => {
                                reject(error);
                            })
                    });

                    return result;

                } else {
                    // If it is not the right moment, we wait 250 milliseconds
                    await Utils.sleep(250);
                }

            }
        }

    }
}