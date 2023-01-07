function deleteAndredirect(characterID, itemID) {

    var data = {
        characterID: characterID,
        itemID: itemID,
    };

    document.dispatchEvent(new CustomEvent('deleteAndredirect', { detail: data }));

    return false;
}