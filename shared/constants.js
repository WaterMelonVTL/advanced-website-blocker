export const BLOCK_MODE = Object.freeze({
  ALWAYS: "always",
  ON_SCHEDULE: "schedule",
});

/** NONE: no unlock. WAITING: sentence typed, delay running. OPEN: site open until the unlock closes. */
export const UNLOCK_PHASE = Object.freeze({
  NONE: "none",
  WAITING: "waiting",
  OPEN: "open",
});

export const DEFAULT_SETTINGS = Object.freeze({
  waitMinutes: 5,
  unlockMinutes: 20,
});

export const SETTING_LIMITS = Object.freeze({
  waitMinutes: { min: 0, max: 120 },
  unlockMinutes: { min: 1, max: 240 },
});

export const MINUTE_MS = 60 * 1000;

/** How long a change that weakens blocking waits before it takes effect. */
export const COOLDOWN_MS = 24 * 60 * MINUTE_MS;

export const SENTENCE_PREFIX =
  "I'm sure what I'm doing is worth it, that's why I will type the following sentence: ";

/** Indexed like `Date#getDay()`: 0 is Sunday. */
export const DAY_NAMES = Object.freeze(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
export const MONDAY_FIRST_DAYS = Object.freeze([1, 2, 3, 4, 5, 6, 0]);

export const BLOCK_PAGE_PATH = "blocked/blocked.html";
