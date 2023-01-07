/**
 * A generic class containing misc utilities methods to be used in different content scripts
 *
 * @class Utils
 */
class Utils {
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
}