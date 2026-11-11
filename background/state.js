import { browserApi } from "../shared/browser.js";
import { DEFAULT_SETTINGS } from "../shared/constants.js";

/**
 * In-memory copy of the extension's state, persisted in storage.local.
 * The background can be unloaded at any moment, so everything that matters is saved.
 *
 * @typedef {{ domain: string, mode: string, addedAt: number, removeAt: number | null }} Site
 * @typedef {{ opensAt: number, closesAt: number }} Unlock
 * @typedef {{ name: string, url: string }} Alternative
 * @typedef {{
 *   schedules: { schedules: object[], applyAt: number } | null,
 *   settings: Object<string, { value: number, applyAt: number }>,
 *   siteModes: Object<string, { mode: string, applyAt: number }>,
 * }} PendingChanges confirmed changes waiting for their cooldown
 */
function createEmptyState() {
  return {
    /** @type {Site[]} */ sites: [],
    schedules: [],
    settings: { ...DEFAULT_SETTINGS },
    /** @type {Object<string, Unlock>} */ unlocks: {},
    blockCounts: { date: "", countsByDomain: {} },
    /** @type {Alternative[]} */ alternatives: [],
    /** @type {PendingChanges} */ pendingChanges: { schedules: null, settings: {}, siteModes: {} },
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

/** Resolves once the state is loaded. Await it before reading `state`. */
export const stateReady = loadStateFromStorage();

/** Keeps the in-memory copy in step when storage is changed elsewhere (e.g. from developer tools). */
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

/** Takes a site off the list, with its unlock and pending mode switch. */
export function removeSite(domain) {
  state.sites = state.sites.filter((site) => site.domain !== domain);
  delete state.unlocks[domain];
  delete state.pendingChanges.siteModes[domain];
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
