# Permission justifications

Text for the "permission justification" fields of the Chrome Web Store and addons.mozilla.org (AMO) listings. Each block is under 1000 characters. Keep it in sync with `manifest.json` and `background.js`.

## alarms

Popmundo Utils can optionally share anonymous interaction names (in-game text such as "Greet") to help translate the extension. To avoid sending a request every time you open a page, the extension uses one alarm to wait about one minute, so that names read on several pages go out together as a single batch. If the network is down, the same alarm retries 30 minutes later. The alarm is needed because the background service worker can be stopped by the browser, and a plain timer would be lost. The alarm sets no schedule on its own, shows nothing, and does nothing when sharing is turned off in Options.

## storage

Used to save your settings and the data the features need. The sync area keeps your options (enabled features, colors, popup preferences), your reminders and item timers, and usage counters, so they follow you across devices. The local area keeps the list of your characters' names for quick selection, last-use times for items, interaction names waiting to be shared, and a diagnostic log. The session area temporarily holds the id of the item you just used, so a timer can be created on the next page. Nothing in storage is sold or shared, apart from the optional anonymous interaction names described in the privacy policy.

## webRequest

Used in read-only mode (no blocking, no changes to requests). The extension watches only one URL pattern, the Popmundo "My Items" page, and reads the submitted form to learn which item you clicked "Use" on. The game's reply page does not say which item it was, so this id is needed to start the correct item timer. The id is kept briefly in session storage and cleared after use. The extension does not observe other sites, does not read responses or headers, and does not send this data anywhere.

## Host permission (https://*.popmundo.com/*)

The extension only works on Popmundo, so access is limited to this single site (all its numbered servers, such as 75.popmundo.com). It is needed to run the content scripts that add features to game pages: popups, score highlighting, reminders, timers, search boxes, and bulk actions. It also lets the webRequest listener see item-use requests on that site. The extension requests no access to any other website, and loads no remotely hosted code.
