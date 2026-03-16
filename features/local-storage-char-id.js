// The main goal of this content script is to update the value of current character ID to the session storage

async function saveToSession(charID) {
    await chrome.runtime.sendMessage({
        'type': 'storage.session',
        'payload': 'set',
        'param': { 'my_char_id': charID },
    });
}

let myCharID = Utils.getMyID();
if (myCharID != 0) {
    saveToSession(myCharID);
}
