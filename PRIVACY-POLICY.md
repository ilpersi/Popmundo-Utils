# Popmundo Utils Privacy Policy

## Data Collection

Popmundo Utils is not collecting any data at all. Since no data is collected, it stands to reason, and is, indeed, the case, that none of your data can be sold to third parties.

That being said, there are a few other ways your data is used.

## Community translations (on by default, optional)

To translate Popmundo Utils into more languages with the names the game itself uses, the extension can share, anonymously, the names that the game shows for its interactions and interaction groups. This is turned on by default and you can turn it off at any time in Options > Misc > Community translations.

What is shared: your game language, the numbers that identify the interactions, the names the game shows for those interactions and for their groups, and a random identifier created by the extension on your device. The identifier is not linked to your account, your character or your browser, and is only used to count how many different installations agree on a name.

What is never shared: character names or ids, your account or login details, your relationships, or anything else from your game.

The data is sent to a small service hosted on Cloudflare and is used to produce the translations included in later versions of the extension. Like any web host, Cloudflare processes the connection itself, the project does not store IP addresses. You can see exactly what was last sent with "View last submission" in the same options card. To have your submissions removed, open an issue on the project's GitHub page and quote the random identifier shown there.

## Chrome Storage API

Popmundo Utils takes advantage of [Google Chrome's Storage API](https://developers.chrome.com/extensions/storage) to store user options whenever they are explicitly changed by the user. Popmundo Utils is making use of the [storage.sync](https://developer.chrome.com/docs/extensions/reference/storage/#property-sync) area. If syncing is enabled, the data is synced to any Chrome browser that the user is logged into. If disabled, it behaves like storage.local. When the browser is offline, Chrome stores the data locally and resumes syncing when it's back online.