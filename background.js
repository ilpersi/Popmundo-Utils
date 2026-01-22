// We allow access to session storage also in content scripts
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });

// We save the installType in local options so it can be used across the whole extension to drive the logic
var install_type = '';
chrome.management.getSelf(info => {
    install_type = info.installType;
    chrome.storage.local.set({ 'install_type': install_type });
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

// This event listener is triggered when a item is used from the item list
chrome.webRequest.onBeforeRequest.addListener(
    async (details) => {
        if ('requestBody' in details && 'formData' in details.requestBody) {
            //debugger;

            let itemKey = '';
            for (const dataName in details.requestBody.formData) {
                if (dataName.toLowerCase().includes('use.x')) {
                    itemKey = dataName.replace('btnUse.x', 'hidItemIDstring')
                    // debugger;
                    break;
                }
            }

            if (itemKey in details.requestBody.formData) {
                let itemID = details.requestBody.formData[itemKey][0];
                await chrome.storage.session.set({ "lastUseditemID": itemID });
                // console.log("lastUseditemID: " + itemID);
            }

        }
    },
    { urls: ["https://*.popmundo.com/World/Popmundo.aspx/Character/Items/*"] },
    ["requestBody"]
);
