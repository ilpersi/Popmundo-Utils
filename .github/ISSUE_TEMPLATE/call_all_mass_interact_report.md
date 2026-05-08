---
name: Call All Friends / Mass Interact Issue
about: Report a problem with the Call All Friends or Mass Interact features
title: '[CAF/MI] '
labels: bug
assignees: ''

---

This bug has been hard to reproduce on our side, so we need a bit of detail to track it down. **The single most useful thing is the screenshot from step 4** — please don't skip it even if the rest is too technical. Fill in what you can; leave anything you don't know blank.

> **Before you start:** make sure you're on the latest version of Popmundo Utils (check `chrome://extensions/` and click "Update" at the top, then verify the version on the card).

---

## 1. Which feature(s) are broken right now?

- [ ] **Mass Interact** — the button on a "Characters Present" page
- [ ] **Call All Friends** — the box on your *own* character's "Relations" page

Tick the closest match to what you see:

- [ ] The whole feature box / button is **not even visible** on the page
- [ ] The button appears but **clicking it does nothing**
- [ ] The button appears and shows a **red/error message** in the Popmundo notification bar (please screenshot it)
- [ ] Other:

## 2. When does it break and what brings it back?

| Trigger | Tick if it applies |
|---|---|
| It breaks after I **shut down / restart my computer** | [ ] |
| It breaks after I **close and reopen Chrome** | [ ] |
| It breaks after **leaving the browser open for a long time** (hours) | [ ] |
| It seems to break **at random** | [ ] |
| **Reloading the Popmundo page** (F5) brings it back | [ ] |
| **Clicking the reload icon on the extension card** at `chrome://extensions/` brings it back | [ ] |
| **Disabling and re-enabling Popmundo Utils** brings it back | [ ] |
| **Only fully uninstalling and reinstalling** brings it back | [ ] |
| Even reinstalling does not fix it | [ ] |

## 3. Profile / sync info

- Are you signed into **Chrome Sync** with a Google account? (Yes / No)
- Do you use **multiple Chrome profiles** with the same Google account? (Yes / No)
- If yes: does the issue happen on **all** profiles or only **some**? Which?
- Have you ever installed **Tampermonkey, Greasemonkey, Violentmonkey** or any **Popmundo userscript** (e.g. from greasyfork.org)? (Yes / No / Not sure)
- If yes, are any of those still installed/enabled now? Please list them:

## 4. Service-worker console *(the screenshot we really need)*

This is the extension's own log and it almost certainly contains the cause.

1. Reproduce the bug first — make sure the feature is broken right now.
2. Open `chrome://extensions/`.
3. Top-right corner: turn on **Developer mode**.
4. On the **Popmundo Utils** card, click the blue link **"service worker"**.
5. A new DevTools window opens. Click the **Console** tab.
6. **Take a full screenshot of that window** and attach it here.
7. If there are red lines, please also copy-paste them as text:

```
paste here
```

## 5. Quick diagnostic snapshot

Stay in the **same console window** you opened in step 4. Copy the entire block below, paste it into the console, press Enter, then copy whatever it prints into the code block under it.

> ⚠️ **Heads up:** The first time you paste code into the DevTools console, Chrome blocks it as a security measure and asks you to **type `allow pasting`** (without quotes) and press Enter. Do that once, then paste the command again — it will work normally from then on.

```js
Promise.all([
  chrome.storage.sync.getBytesInUse(null),
  chrome.storage.sync.get(['mass_interact_exclude_id', 'call_exclude_id']),
  chrome.storage.session.get('current_char_details'),
  chrome.storage.local.get(['install_type'])
]).then(([bytes, sync, session, local]) => console.log(JSON.stringify({
  sync_bytes_used: bytes,
  sync_bytes_max: 102400,
  mass_interact_exclude_bytes: JSON.stringify(sync.mass_interact_exclude_id || {}).length,
  call_exclude_bytes: JSON.stringify(sync.call_exclude_id || {}).length,
  session_char: session,
  local: local
}, null, 2)));
```

Paste the result here:

```
paste output here
```

> If you had to reload the extension before getting to this step, please re-trigger the bug and run the snapshot again — some values reset on reload.

## 6. Page console (only if you have time after the above)

1. Go to the Popmundo page where the feature is broken.
2. Press **F12** → click the **Console** tab.
3. Click the 🚫 icon to clear it.
4. Press **F5** to reload the page.
5. Click the broken button if there is one.
6. Screenshot the whole window (so the URL is visible) and attach it.

## 7. System info

| | |
|---|---|
| Browser + version (menu → Help → About) | |
| Operating system | |
| Popmundo Utils version (from `chrome://extensions/`) | |
| Approximate date the issue started | |
| Last extension version that worked correctly (if known) | |

## 8. Other extensions

1. At `chrome://extensions/`, **temporarily disable every extension except Popmundo Utils**.
2. Reload Popmundo and try again.
3. Did the bug still happen with everything else off? (Yes / No / Didn't try)

If "No" (turning others off fixed it), please list the other extensions you had on:

> _list here_
