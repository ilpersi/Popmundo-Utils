// We save the installType in local options so it can be used across the whole extension to drive the logic
var install_type = '';
chrome.management.getSelf(info => {
    install_type = info.installType;
    chrome.storage.local.set({ 'install_type': install_type });
})

// On first install, seed log_level based on install type:
//   development → DEBUG (0), production → ERROR (3)
chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === 'install') {
        chrome.management.getSelf(info => {
            const logLevel = info.installType === 'development' ? 0 : 3;
            chrome.storage.sync.set({ log_level: logLevel });
        });
    }
    initDefaultReminders();
});

chrome.runtime.onStartup.addListener(() => {
    initDefaultReminders();
});

// ---------------------------------------------------------------------------
// Default reminders – seeded once on first initialization of the feature.
// BBCode tags are stored as-is and resolved at display time in the content script.
// ---------------------------------------------------------------------------
const REMINDER_DEFAULTS = [
    {
        id: 'default-pm-tgh-day-27',
        type: 'yearday',
        dayValue: 27,
        forPopmundo: true,
        forGreatHeist: true,
        active: true,
        text: 'Remember to visit [localeid=4141 name="Stockholm\'s Graveyard"] and use the [itemdetailsid=103487217 name="Frank Blomdahl Minneslund"] Monolith to get 3 experience points.',
        description: "Stockholm's Graveyard monolith for 3 XP",
    },
    {
        id: 'default-pm-tgh-day-28',
        type: 'yearday',
        dayValue: 28,
        forPopmundo: true,
        forGreatHeist: true,
        active: true,
        text: 'Is the Day of the Dead!',
        description: 'Day of the Dead',
    },
    {
        id: 'default-pm-tgh-day-40',
        type: 'yearday',
        dayValue: 40,
        forPopmundo: true,
        forGreatHeist: true,
        active: true,
        text: "Is St Kobe's Day! Investigate the Statues of Celestial Beauty in Johannesburg, Moscow, Singapore, and Troms\u00f8 to go on an adventurous quest for improved music genre skills.",
        description: "St Kobe's Day",
    },
    {
        id: 'default-pm-tgh-day-48',
        type: 'yearday',
        dayValue: 48,
        forPopmundo: true,
        forGreatHeist: true,
        active: true,
        text: 'Remember to use your Halloween Horror!',
        description: 'Halloween Horror',
    },
    {
        id: 'default-pm-tgh-day-52',
        type: 'yearday',
        dayValue: 52,
        forPopmundo: true,
        forGreatHeist: true,
        active: true,
        text: 'Is Christmas!',
        description: 'Christmas Day',
    },
    {
        id: 'default-pm-tgh-day-54',
        type: 'yearday',
        dayValue: 54,
        forPopmundo: true,
        forGreatHeist: true,
        active: true,
        text: 'Remember to wear your Marvin T-Shirt to increase your star quality and get one experience point.',
        description: 'Marvin T-Shirt day',
    },
    {
        id: 'default-tgh-thursday',
        type: 'weekday',
        dayValue: 4, // ISO Thursday
        forPopmundo: false,
        forGreatHeist: true,
        active: true,
        text: 'It is Thursday, remember to get your free cards!',
        description: 'Thursday free cards (The Great Heist)',
    },
];

/**
 * Seeds default reminders into sync storage on the first initialization of the
 * reminders feature. Safe for both new installs and upgrades: duplicate IDs are
 * skipped, and the reminders_initialized flag prevents repeated seeding.
 *
 * Uses callback-based storage API (not async/await) so Chrome can reliably
 * track the pending I/O and keep the service worker alive until completion.
 */
function initDefaultReminders() {
    chrome.storage.sync.get({ reminders_initialized: false, user_reminders: [] }, function (data) {
        if (chrome.runtime.lastError) return;
        // Guard: also check that reminders are actually present, in case a
        // previous run set the flag but the storage write for the reminders
        // was lost (e.g. service worker killed mid-flight).
        if (data.reminders_initialized && (data.user_reminders || []).length > 0) return;

        const existingIds = new Set((data.user_reminders || []).map(r => r.id));
        const toAdd = REMINDER_DEFAULTS.filter(r => !existingIds.has(r.id));
        const merged = [...(data.user_reminders || []), ...toAdd];
        chrome.storage.sync.set({ user_reminders: merged, reminders_initialized: true });
    });
}

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
        } else if (request.type === "storage.session") {
            if (request.payload === 'set') {
                return chrome.storage.session.set(request.param);
            }
            else if (request.payload === 'get') {
                chrome.storage.session.get(request.param)
                    .then((data) => {
                        // debugger;
                        // console.dir(data);
                        sendResponse(data);
                    });

                // Since session.set is asynchronous, must return an explicit `true`
                return true;
            } else if (request.payload === 'remove') {
                return chrome.storage.session.remove(request.param);
            }
        }


    }
});