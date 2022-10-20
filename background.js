/*chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab && tab.url.includes("popmundo.com") && changeInfo.status === 'complete') {
        //debugger;
        console.log("onUpdated: " + tab.url);
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['global-content-script.js']
          });
    }
});*/

