// We allow access to session storage also in content scripts
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

var install_type = '';
chrome.management.getSelf(info => {
    install_type = info.installType;
    chrome.storage.local.set({'install_type': install_type});
})

// We listen to messages incoming messages from the extension.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.hasOwnProperty('type')) {
        if (request.type === 'cmd') {
            // We open the options page
            if (request.payload === 'open-options') {
                // This API is not available in content scripts.
                chrome.runtime.openOptionsPage();
            }
            // We open the developer hot-reoad page
            else if (request.payload == 'developer') {
                if (install_type == 'development') {
                    chrome.tabs.create({
                        active: false,
                        url: chrome.runtime.getURL('options/developer.html')
                    }, null);
                }
            }
        }
    }
});
