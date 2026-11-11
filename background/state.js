// The extension's state, cached in memory and persisted in storage.local.
// The background can be unloaded at any moment, so everything that matters is saved.
import { browserApi } from "../shared/browser.js";
import { DEFAULT_SETTINGS } from "../shared/constants.js";

function createEmptyState() {
  return {
    sites: [],                       // [{ domain, mode, addedAt, removeAt | null }]
    schedules: [],                   // [{ id, days: [0-6], start: "HH:MM", end: "HH:MM" }]
    settings: { ...DEFAULT_SETTINGS },
    unlocks: {},                     // { [domain]: { opensAt, closesAt } }
    blockCounts: { date: "", countsByDomain: {} },
    alternatives: [],                // [{ name, url }] shown on the block page
    pendingChanges: {                // confirmed changes waiting for their cooldown
      schedules: null,               // { schedules, applyAt } | null
      settings: {},                  // { [settingKey]: { value, applyAt } }
      siteModes: {},                 // { [domain]: { mode, applyAt } }
    },
  };
}

export const state = createEmptyState();

const STORAGE_KEYS = Object.keys(state);

async function loadStateFromStorage() {
  const storedState = await browserApi.storage.local.get(STORAGE_KEYS);
  Object.assign(state, storedState);
  state.settings = { ...DEFAULT_SETTINGS, ...state.settings };
  state.pendingChanges = { ...createEmptyState().pendingChanges, ...state.pendingChanges };
}

/** Resolves once the state has been read from storage. Await it before touching `state`. */
export const stateReady = loadStateFromStorage();

/** Keeps the in-memory copy in step when storage is changed from elsewhere (e.g. developer tools). */
function adoptExternalChanges(changes, areaName) {
  if (areaName !== "local") return;
  for (const [key, { newValue }] of Object.entries(changes)) {
    if (STORAGE_KEYS.includes(key) && newValue !== undefined) state[key] = newValue;
  }
}

browserApi.storage.onChanged.addListener(adoptExternalChanges);

export function saveState(...keys) {
  const entries = keys.map((key) => [key, state[key]]);
  return browserApi.storage.local.set(Object.fromEntries(entries));
}

export function findSiteByDomain(domain) {
  return state.sites.find((site) => site.domain === domain);
}

export function currentConfig() {
  return {
    sites: state.sites,
    schedules: state.schedules,
    settings: state.settings,
    pendingChanges: state.pendingChanges,
  };
}
