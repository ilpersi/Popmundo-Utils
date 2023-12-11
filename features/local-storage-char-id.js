// The main goal of this content script is to update the value of current character ID to the session storage

async function saveToSession() {
    let toSave = {'my_char_id': myCharID};
    await chrome.storage.session.set(toSave);
}

let myCharID = Utils.getMyID();
if (myCharID != 0) {
    saveToSession();
}
