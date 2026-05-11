---
name: Call All Friends / Mass Interact Issue
about: Report a problem with the Call All Friends or Mass Interact features
title: '[CAF/MI] '
labels: bug
assignees: ''

---

This bug has been hard to reproduce on our side, so we need a bit of detail to track it down. **The single most useful thing is the diagnostic blob in step 4** — please don't skip it. Fill in what you can; leave anything you don't know blank.

> **Before you start:** make sure you're on the latest version of Popmundo Utils.

---

## 1. Which feature(s) are broken right now?

- [ ] **Mass Interact** — the button on a "Characters Present" page
- [ ] **Call All Friends** — the box on your *own* character's "Relations" page

Tick (just type a 'x' character inside the square brackets) the closest match to what you see:

- [ ] The whole feature box / button is **not even visible** on the page
- [ ] The button appears but **clicking it does nothing**
- [ ] The button appears and shows a **red/error message** in the Popmundo notification bar (please screenshot it)
- [ ] Other:

## 2. When does it break and what brings it back?

Tick if it applies:

- [ ] It breaks after I **shut down / restart my computer**
- [ ] It breaks after I **close and reopen Chrome**
- [ ] It breaks after **leaving the browser open for a long time** (hours)
- [ ] It seems to break **at random**
- [ ] **Reloading the Popmundo page** (F5) brings it back
- [ ] **Clicking the reload icon on the extension card** at `chrome://extensions/` brings it back
- [ ] **Disabling and re-enabling Popmundo Utils** brings it back
- [ ] **Only fully uninstalling and reinstalling** brings it back
- [ ] Even reinstalling does not fix it

## 3. Profile / sync info

- Are you signed into **Chrome Sync** with a Google account? (Yes / No)
- Do you use **multiple Chrome profiles** with the same Google account? (Yes / No)
- If yes: does the issue happen on **all** profiles or only **some**? Which?
- Have you ever installed **Tampermonkey, Greasemonkey, Violentmonkey** or any **Popmundo userscript** (e.g. from greasyfork.org)? (Yes / No / Not sure)
- If yes, are any of those still installed/enabled now? Please list them:

## 4. Copy diagnostics *(the most important step)*

The extension has a button that gathers everything we need into one block of text — no DevTools required.

1. **Reproduce the bug first** so the most recent errors are captured in the log.
2. Right-click the **Popmundo Utils** icon in the Chrome toolbar → **Options**.
   (Or go to `chrome://extensions/`, find Popmundo Utils, and click **Details → Extension options**.)
3. Click the **Misc** tab in the left sidebar.
4. Scroll down to the **Diagnostics** card.
5. Click **Copy diagnostics**. You should see "Copied to clipboard."
6. Paste the result into the code block below:

```
paste here
```

> **What's in it?** Recent extension errors and warnings, sync/local storage usage, your current character's id and name, extension version, and the URL you were on. No passwords or personal data.

## 5. Screenshots *(if anything looked unusual on the Popmundo page)*

If the bug shows up visually on a Popmundo page (red banners, missing button, weird layout), please attach a screenshot of the whole browser window — make sure the URL bar is visible.

## 6. Page console *(optional — only if step 4 didn't work)*

If the Copy diagnostics button didn't work or the resulting blob looks empty:

1. Go to the Popmundo page where the feature is broken.
2. Press **F12** → click the **Console** tab.
3. Click the 🚫 icon to clear it.
4. Press **F5** to reload the page.
5. Click the broken button if there is one.
6. Screenshot the whole window (so the URL is visible) and attach it here.

## 7. System info

- Browser + version (menu → Help → About):
- Operating system:
- Approximate date the issue started:
- Last extension version that worked correctly (if known):

*(The Popmundo Utils version is already included in the diagnostic blob — no need to repeat.)*

## 8. Other extensions

1. At `chrome://extensions/`, **temporarily disable every extension except Popmundo Utils**.
2. Reload Popmundo and try again.
3. Did the bug still happen with everything else off? (Yes / No / Didn't try)

If "No" (turning others off fixed it), please list the other extensions you had on:

> _list here_
