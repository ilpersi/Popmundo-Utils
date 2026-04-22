/**
 * This function will take care of updating all of the characters id in the sync storage.
 * Important note: Popmundo is managing different IDs so to allow flexibility in querying data,
 * the information is redundated. And both IDs and names are used as keys and values.
 *
 */
async function updatePlayerDB() {
    // all_characters_details is stored in local (not sync) storage because its size can exceed
    // the 8192 byte per-item quota imposed by chrome.storage.sync. Character data is tied to
    // game sessions and does not need to roam across devices.
    const all_characters_details_default = {"id-name": {}, "name-id": {}, "uuid-name": {}, "name-uuid": {}};
    const { all_characters_details: charactersDB } = await chrome.storage.local.get({ all_characters_details: all_characters_details_default });

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
    await chrome.storage.local.set({ all_characters_details: charactersDB });
}

(async () => {
    await Logger.init();
    updatePlayerDB();
})()
