// We allow access to session storage also in content scripts
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.hasOwnProperty('type')) {
        if (request.type === 'cmd') {
            if (request.payload === 'open-options') {
                chrome.runtime.openOptionsPage();
            }
        }
    }
});
