/**
 * This function will take care of updating all of the characters id in the sync storage.
 * Important note: Popmundo is managing different IDs so to allow flexibility in querying data,
 * the information is redundated. And both IDs and names are used as keys and values.
 *
 */
async function updatePlayerDB() {
    const all_characters_details_default = {"id-name": {}, "name-id": {}, "uuid-name": {}, "name-uuid": {}};
    const { all_characters_details: charactersDB } = await chrome.storage.sync.get({ all_characters_details: all_characters_details_default });

    Logger.debug('Saved character DB: ' + JSON.stringify(charactersDB));

    let selector = new CssSelectorHelper('div.idHolder');

    selector.getAll().forEach(divNode => {
        let id = divNode.textContent || "0";

        let nameNode = new CssSelectorHelper('h2 > a', divNode.parentNode.parentNode).getSingle();
        if (nameNode) {
            let name = String(nameNode.textContent || '').trimEnd();

            if (id != 0 && name != '') {
                charactersDB['id-name'][id] = name;
                charactersDB['name-id'][name] = id;
            }
        }
    });

    Logger.debug('Updated character DB: ' + JSON.stringify(charactersDB));
    await chrome.storage.sync.set({ all_characters_details: charactersDB });
}

(async () => {
    await Logger.init();
    updatePlayerDB();
})()
