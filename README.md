# Popmundo Utils

A Chrome extension that adds quality-of-life improvements to the [Popmundo](https://www.popmundo.com) browser game. Install it once and it works automatically in the background — no setup required to get started.

# Why Popmundo Utils?
Back in 2007, when it was initally released, I used to be an avid Popmundo player and I remember I always using an amazing extension for the Firefox browser (called popomungo)

After a very long break, I started playing popmundo again and I really missed some of the features that were originally available with the popmungo extension and the more close thing I could find is the [chromemundo](https://github.com/lahunoxnaakal/chromomundo) extension that has not been updated for many years and it is no longer working.

Rather that making chromemungo work again, I decided to create my own extension with a limited set of features that I like. This way I can have the features I miss and get some experience with Chrome Extension development eco-system.

---

## Installation

1. Search for "Popmundo Utils" in Chrome Web Store page and click **Add to Chrome**.
2. Navigate to any Popmundo page and the extension activates immediately.
3. To customise which features are on or off, open the in-game **Popmundo Utils** menu in the sidebar and click **Options**.

---

## Features

### Popups & Quick Information

Hover over a name or link anywhere in the game to see a summary without leaving the page.

| Popup | What it shows |
|---|---|
| **Character** | Status, location, and key stats for any character |
| **Song** | Composing progress, instruments, and band details |
| **Skill** | Recent learning history and current level |
| **Club / Venue** | Capacity, owner, rules, and other venue details |
| **Show** | Venue, date, time, audience size, and score requirement |

All popups automatically match your current game skin (light, dark, or retro).

---

### Enhanced Quick-Links

Small icon shortcuts appear next to character, band, city, locale, and crew links throughout the game, so you can jump straight to the action you want without navigating through extra pages.

**Characters:** Send a message · Call · Offer an item
**Bands:** Popularity page · Upcoming shows
**Cities:** Book a regular flight · Charter a VIP jet · Other vehicles · Find locales
**Locales:** Characters present · Move to locale · Reconnaissance
**Crew *(The Great Heist)*:** Top heists

Each shortcut can be enabled or disabled individually from Options.

---

### Score & Progress Display

- **Score highlight** — score values (e.g. 18/26) are colour-coded using a rainbow gradient so you can compare them at a glance.
- **Progress bar percentages** — every progress bar shows its numeric percentage as text so you no longer have to hover to read the value.
- Both work across character pages, artist pages, skill pages, locale pages, and charts.

---

### Searchable Tables

Any data table in the game gains a live search box. Type to filter rows instantly — useful on long repertoire lists, relations pages, charts, and anywhere else the game shows tabular data.

---

### Fast Character Switch

Selecting a different character from the dropdown automatically switches without requiring a click on the "Switch character" button.

---

### Autograph Collector

Automates collecting autographs from characters across the game.

- Automatically navigates to available characters and collects using your autograph book.
- Respects the 6-minute per-book cooldown.
- Colour-coded log keeps a record of every collection attempt.
- You can configure which book item to use and how many log rows to keep.

---

### Call All Friends

Calls all your friends on the Relations page in one click.

- Choose which interaction types to use: Wazzup, Prank, SMS Funny Pic, SMS Friendly Text, or Gossip.
- The extension randomly rotates through your selected options.
- Specific character IDs can be excluded.

---

### Mass Interact

Automatically performs interactions on every character present at a locale.

- Choose from over 50 interaction types across verbal, physical, romantic, and special categories.
- The extension randomly selects from your enabled interactions for each character.
- Set a maximum number of characters to interact with per run and maintain an exclusion list.
- Option to skip newly-acquainted characters.

---

### Mass Item Sender

Send multiple items to characters from the Offer Item page without repeating the process manually for each one.

- A checkbox list replaces the single-item dropdown, letting you select several items at once.
- Items that already have an active offer are automatically shown as unavailable.
- Progress is shown while the queue runs, and the list refreshes automatically when done.

---

### Tour Bus Helper

Fills in tour bus routes automatically based on your artist's schedule *(VIP accounts only)*.

- Analyses your existing schedule to suggest the next booking.
- Configurable: trigger after your previous event or your previous show, and set how many hours before it should book.

---

### Jam Helper

On the Repertoire page, one click selects all songs that are not yet at 100% jam level, so you can queue them all for jamming without scrolling through the full list.

---

### Item Timers

- On the Items page, a countdown shows how long until each item can be used again.
- When a cooldown expires, a browser notification reminds you the item is ready.

---

### Show Message Generator

On the Performance Details page, displays a suggested ticket price and a summary of the venue details (city, date, time, fame level, score requirement) to help you write your show announcement.

---

### Login Redirect

When the game logs you out and lands you on an awkward numbered login URL, the extension automatically redirects you to the standard login page — making password managers work reliably every time.

---

### Reminders

Displays a notification banner on your Character home page on specific in-game calendar days to remind you of recurring activities (e.g. visiting the Stockholm Graveyard monolith, The Great Heist card days).

---

## Configuration

Open the **Options** page from the Popmundo Utils menu in the game sidebar. Every feature can be toggled on or off, and the options sync automatically across your devices via your Chrome profile.

---

## Contributing

New feature ideas and pull requests are welcome. Please open an issue to discuss a feature before submitting a PR.
