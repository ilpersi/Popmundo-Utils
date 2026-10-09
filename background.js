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
        } else if (request.type === 'interaction-names') {
            // The collector found interaction names that were not sent yet
            if (request.payload === 'pending') scheduleInteractionNamesSubmission(TRANSLATIONS_DELAY_MINUTES);
        }


    }
});

// ---------------------------------------------------------------------------
// Community translations
//
// features/interaction-collector.js keeps the game's names of the interactions it has not sent yet in
// chrome.storage.local (interaction_names_pending) and tells us. We send them anonymously to a small Cloudflare
// Worker (see worker/), unless the user turned the contribute_translations option off.
// ---------------------------------------------------------------------------

// Full URL of the Worker /submit route. While it is empty nothing is ever sent.
const TRANSLATIONS_ENDPOINT = 'https://popmundo-utils-names.ilpersi.workers.dev/submit';
const TRANSLATIONS_ALARM = 'submit-interaction-names';
// Short delay, so that several Interact pages visited in a row go out as one batch (Chrome alarms honour 0.5 minutes at least)
const TRANSLATIONS_DELAY_MINUTES = 1;
const TRANSLATIONS_RETRY_MINUTES = 30;
// Maximum entries per request, the Worker refuses more
const TRANSLATIONS_CHUNK_SIZE = 80;
const TRANSLATIONS_SCHEMA = 1;
const TRANSLATIONS_KINDS = { names: 'name', groups: 'group' };

function scheduleInteractionNamesSubmission(delayInMinutes) {
    chrome.alarms.get(TRANSLATIONS_ALARM, alarm => {
        if (!alarm) chrome.alarms.create(TRANSLATIONS_ALARM, { delayInMinutes });
    });
}

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === TRANSLATIONS_ALARM) submitInteractionNames();
});

// Alarms may be lost when the browser restarts, so every time the service worker starts we make sure pending names are not forgotten
chrome.storage.local.get({ interaction_names_pending: {} }, ({ interaction_names_pending }) => {
    if (Object.keys(interaction_names_pending).length > 0) scheduleInteractionNamesSubmission(TRANSLATIONS_DELAY_MINUTES);
});

/**
 * Sends the pending interaction names to the Worker. Entries are removed from the pending ones and remembered as
 * sent only once the server answered. A network error or a server error keeps them pending and tries again later.
 * An answer in the 4xx range (apart from "too many requests") means the server refuses those entries: sending them again
 * would not help, so they are remembered as sent too.
 */
async function submitInteractionNames() {
    const { contribute_translations } = await chrome.storage.sync.get({ contribute_translations: true });
    if (!contribute_translations || !TRANSLATIONS_ENDPOINT) return;

    const local = await chrome.storage.local.get({ interaction_names_pending: {}, interaction_names_install_id: null });
    const pending = local.interaction_names_pending;
    if (Object.keys(pending).length === 0) return;

    // Random id, only used by the server to count how many different installs agree on a name
    let installId = local.interaction_names_install_id;
    if (!installId) {
        installId = crypto.randomUUID();
        await chrome.storage.local.set({ interaction_names_install_id: installId });
    }

    const handled = []; // [languageId, kind, id, value] done with, sent or refused
    const payloads = [];
    const responses = [];
    let sentCount = 0;
    let retryLater = false;

    languages:
    for (const [languageId, languageData] of Object.entries(pending)) {
        const entries = [];
        for (const [kind, serverKind] of Object.entries(TRANSLATIONS_KINDS)) {
            for (const [id, value] of Object.entries(languageData[kind] || {})) {
                entries.push({ kind: serverKind, id: Number(id), value });
            }
        }

        for (let i = 0; i < entries.length; i += TRANSLATIONS_CHUNK_SIZE) {
            const chunk = entries.slice(i, i + TRANSLATIONS_CHUNK_SIZE);
            const payload = { schema: TRANSLATIONS_SCHEMA, lang: Number(languageId), install: installId, entries: chunk };

            let response;
            try {
                response = await fetch(TRANSLATIONS_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (e) {
                console.warn('Unable to send the interaction names', e);
                retryLater = true;
                break languages;
            }

            const body = (await response.text()).slice(0, 500);
            const refused = response.status >= 400 && response.status < 500 && response.status !== 429 && response.status !== 408;
            if (!response.ok && !refused) {
                console.warn('The interaction names were not accepted', response.status, body);
                retryLater = true;
                break languages;
            }

            if (response.ok) {
                sentCount += chunk.length;
                payloads.push(payload);
                responses.push({ status: response.status, body });
            } else {
                console.warn('The interaction names were refused', response.status, body);
            }
            chunk.forEach(entry => handled.push([languageId, entry.kind === 'name' ? 'names' : 'groups', String(entry.id), entry.value]));
        }
    }

    if (handled.length > 0) {
        // The collector may have added pending names while we were sending: we read them again before writing
        const fresh = await chrome.storage.local.get({ interaction_names_pending: {}, interaction_names_sent: {} });
        for (const [languageId, kind, id, value] of handled) {
            const sentLanguage = fresh.interaction_names_sent[languageId] || (fresh.interaction_names_sent[languageId] = { names: {}, groups: {} });
            sentLanguage[kind][id] = value;

            const pendingLanguage = fresh.interaction_names_pending[languageId];
            if (pendingLanguage && pendingLanguage[kind][id] === value) delete pendingLanguage[kind][id];
            if (pendingLanguage && Object.keys(pendingLanguage.names).length === 0 && Object.keys(pendingLanguage.groups).length === 0) {
                delete fresh.interaction_names_pending[languageId];
            }
        }
        await chrome.storage.local.set(fresh);
    }

    if (sentCount > 0) {
        // What the options page shows as the last submission
        await chrome.storage.local.set({
            last_translation_submission: { time: Date.now(), count: sentCount, endpoint: TRANSLATIONS_ENDPOINT, payloads, responses }
        });
    }

    if (retryLater) scheduleInteractionNamesSubmission(TRANSLATIONS_RETRY_MINUTES);
}
