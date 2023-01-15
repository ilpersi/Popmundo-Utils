/**
 * Injected function to perform database management and redirect the user to the item page.
 * https://stackoverflow.com/a/9517879/1280443
 * https://stackoverflow.com/a/19312198/1280443
 * 
 * All the data are passed trough to a custom event handler
 *
 * @param {int} characterID The id of currently logged in character
 * @param {int} itemID The id of the item to delete from the saved storage
 * @return {boolean} Always return false to block event execution on link. 
 */
function deleteAndredirect(characterID, itemID, redirect = true) {

    var data = {
        characterID: characterID,
        itemID: itemID,
        redirect: redirect,
    };

    document.dispatchEvent(new CustomEvent('deleteAndredirect', { detail: data }));

    return false;
}