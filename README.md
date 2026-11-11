# Advanced Website Blocker

Blocks distracting sites, either all the time or during set periods, and makes unblocking take a deliberate effort without making it impossible.
One Manifest V3 codebase for **Firefox (128+), Chrome, Brave and Edge**.

## Features
- **Block list**: add domains from the options page or with the toolbar button ("Block this site", then Confirm). Subdomains are included.
- **Schedules**: each site is either *Always* blocked or blocked *On schedule* (days + time ranges, overnight ranges supported).
- **Allowed subdomains**: set a site to *Never (allow)* to make it an exception, e.g. `music.youtube.com` stays open while `youtube.com` is blocked. The most specific listed domain wins.
- **Block page**: a grumpy padlock, how often you landed there today, and a **"Go there instead"** grid of sites you'd rather be on (set up in the options page).
- **Unlock friction**: open "I really need this site" and type
  `I'm sure what I'm doing is worth it, that's why I will type the following sentence: <random sentence>`
  without pasting. After a wait (default 5 min) the site unlocks for a window (default 20 min). When the window ends, open tabs go back to the block page. You can re-lock early from the popup.
- **24-hour cooldown on anything that weakens blocking**: removing a site, switching it to a less strict mode (*Always* → *On schedule* → *Never*), allowing a subdomain of a blocked site, removing schedule time, a shorter wait, or a longer unlock all take effect 24 hours after you confirm. You can take them back before then. Changes that make blocking stricter apply right away. While a schedule change is pending, the old and new schedules both block.

## Install
### Chrome / Brave / Edge
Soon

### Firefox
Download and install the following : https://addons.mozilla.org/firefox/downloads/file/5239837/585a92a8e3bb4a70a2b7-2.2.0.xpi

## How it works
**`shared/`**: used by the background and the pages
- `change-plan.js`: compares a draft with the confirmed configuration and lists the changes, marking the ones that wait for the cooldown. The options page uses it to preview and the background uses it to apply, so the two always agree.
- `schedules.js`: whether a period is active, when the next one starts or ends, and whether a new schedule blocks at least as much as the old one (checked minute by minute over the week).
- `attempt.js`: the `[error, value]` wrapper used instead of try/catch.
- `browser.js` (browser API and messages to the background), `domains.js`, `sentence.js`, `format.js`, `block-page-address.js`, `dom.js`, `constants.js`

**`background/`**
- `main.js`: entry point, registers the listeners
- `state.js`: in-memory state, persisted to storage
- `blocking.js`: is this site blocked right now?
- `block-rules.js`: turns the state into `declarativeNetRequest` redirect rules
- `enforcement.js`: after any change, updates the rules, sends already-open tabs to the block page, and plans the next wake-up
- `unlocks.js`: the typed sentence and the unlock window
- `commit-draft.js`: checks and applies a confirmed draft
- `housekeeping.js`: apply what's due (cooldowns, removals, closed unlocks). It runs when the background wakes up and before answering any page.
- `wake-up.js`: no polling. The background sleeps until the next moment something can change (a schedule period starting or ending, an unlock opening or closing, a cooldown or removal becoming due) and sets one alarm for exactly that time. A 30-minute safety check catches anything missed, like a change of system clock.
- `messages.js`: answers the pages' requests

**`blocked/`, `popup/`, `options/`**: the block page, toolbar popup and settings page. Each section of a page is its own module.

## License
[MIT No Attribution (MIT-0)](LICENSE), an OSI-approved open-source license. Use, copy, modify, sell or redistribute it for any purpose, without crediting anyone or keeping the license notice.
