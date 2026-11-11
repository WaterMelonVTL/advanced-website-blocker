# Friction Blocker

Blocks distracting sites, either all the time or during set periods, and makes unblocking take a deliberate effort without making it impossible.
One Manifest V3 codebase for **Firefox (128+), Chrome, Brave and Edge**.

## Features
- **Block list**: add domains from the options page or with the toolbar button ("Block this site", then Confirm). Subdomains are included.
- **Schedules**: each site is either *Always* blocked or blocked *On schedule* (days + time ranges, overnight ranges supported).
- **Block page**: a grumpy padlock, how often you landed there today, and a **"Go there instead"** grid of sites you'd rather be on (set up in the options page).
- **Unlock friction**: open "I really need this site" and type
  `I'm sure what I'm doing is worth it, that's why I will type the following sentence: <random sentence>`
  without pasting. After a wait (default 5 min) the site unlocks for a window (default 20 min). When the window ends, open tabs go back to the block page. You can re-lock early from the popup.
- **24-hour cooldown on anything that weakens blocking**: removing a site, switching it from *Always* to *On schedule*, removing schedule time, a shorter wait, or a longer unlock all take effect 24 hours after you confirm. You can take them back before then. Changes that make blocking stricter apply right away. While a schedule change is pending, the old and new schedules both block.

## Install
### Chrome / Brave / Edge
1. Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`).
2. Turn on **Developer mode** and click **Load unpacked**, then select this folder.
3. In the extension's details, enable **Allow in Incognito** (otherwise incognito gets around the block).

It stays installed across restarts. If you move or delete the folder, the extension breaks.

### Firefox
- **Testing:** `about:debugging#/runtime/this-firefox` → "Load Temporary Add-on…" → pick `manifest.json`. It's removed when Firefox restarts.
- **Permanent:** sign it for free as an *unlisted* add-on with `npx web-ext sign --channel=unlisted --api-key=... --api-secret=...` (keys from addons.mozilla.org → Developer Hub → API keys), then open the `.xpi`.
- In `about:addons` → Friction Blocker, allow **Run in Private Windows**.
- If the options page shows "needs access to all sites", click **Allow**.

## How it works
Plain ES modules, no build step. One concern per file.

**`shared/`**: used by the background and the pages
- `change-plan.js`: compares a draft with the confirmed configuration and lists the changes, marking the ones that wait for the cooldown. The options page uses it to preview and the background uses it to apply, so the two always agree.
- `schedules.js`: whether a period is active, and whether a new schedule blocks at least as much as the old one (checked minute by minute over the week).
- `domains.js`, `sentence.js`, `format.js`, `block-page-address.js`, `dom.js`, `messages.js`, `constants.js`, `browser.js`

**`background/`**
- `main.js`: entry point, registers the listeners
- `state.js`: in-memory state, persisted to storage
- `blocking.js`: is this site blocked right now?
- `block-rules.js`: turns the state into `declarativeNetRequest` redirect rules
- `open-tabs.js`, `enforcement.js`: send already-open tabs to the block page
- `unlocks.js`, `challenges.js`: the typed sentence and the unlock window
- `commit-draft.js`, `draft-validation.js`: apply a confirmed draft
- `housekeeping.js`: apply what's due (cooldowns, removals, closed unlocks). It runs every 30 seconds and before answering any page, so nothing depends on the background staying alive.
- `messages.js`: answers the pages' requests

**`blocked/`, `popup/`, `options/`**: the block page, toolbar popup and settings page. Each section of a page is its own module.

## License
[MIT No Attribution (MIT-0)](LICENSE), an OSI-approved open-source license. Use, copy, modify, sell or redistribute it for any purpose, without crediting anyone or keeping the license notice.
