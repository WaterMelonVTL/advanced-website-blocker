// Applies everything whose time has come: pending changes after their cooldown, scheduled
// removals, closed unlocks. All of these are timestamps, so it doesn't matter whether this
// runs from the alarm or lazily when the user opens a page: the result is the same.
import { browserApi } from "../shared/browser.js";
import { enforceBlocking } from "./enforcement.js";
import { findSiteByDomain, saveState, state, stateReady } from "./state.js";

const HOUSEKEEPING_ALARM = "housekeeping";
const HOUSEKEEPING_PERIOD_MINUTES = 0.5; // the shortest period Chrome allows

export async function ensureHousekeepingAlarm() {
  // Creating an alarm again resets its timer, so only create it when it's missing.
  const existingAlarm = await browserApi.alarms.get(HOUSEKEEPING_ALARM);
  if (!existingAlarm) browserApi.alarms.create(HOUSEKEEPING_ALARM, { periodInMinutes: HOUSEKEEPING_PERIOD_MINUTES });
}

export async function runHousekeeping() {
  await applyDueChanges();
  await enforceBlocking(); // also catches schedule periods starting and ending
}

/** Returns true when something changed. */
export async function applyDueChanges(now = Date.now()) {
  await stateReady;
  const changedKeys = new Set([
    ...applyDueScheduleChange(now),
    ...applyDueSettingChanges(now),
    ...applyDueModeSwitches(now),
    ...removeSitesDueForRemoval(now),
    ...forgetClosedUnlocks(now),
  ]);
  if (changedKeys.size === 0) return false;

  await saveState(...changedKeys);
  return true;
}

// Each step below returns the state keys it changed.

function applyDueScheduleChange(now) {
  const pendingSchedules = state.pendingChanges.schedules;
  if (!pendingSchedules || pendingSchedules.applyAt > now) return [];

  state.schedules = pendingSchedules.schedules;
  state.pendingChanges.schedules = null;
  return ["schedules", "pendingChanges"];
}

function applyDueSettingChanges(now) {
  const pendingSettings = state.pendingChanges.settings;
  const dueSettingKeys = Object.keys(pendingSettings).filter((key) => pendingSettings[key].applyAt <= now);

  for (const key of dueSettingKeys) {
    state.settings[key] = pendingSettings[key].value;
    delete pendingSettings[key];
  }
  return dueSettingKeys.length > 0 ? ["settings", "pendingChanges"] : [];
}

function applyDueModeSwitches(now) {
  const pendingModes = state.pendingChanges.siteModes;
  const dueDomains = Object.keys(pendingModes).filter((domain) => pendingModes[domain].applyAt <= now);

  for (const domain of dueDomains) {
    const site = findSiteByDomain(domain);
    if (site) site.mode = pendingModes[domain].mode;
    delete pendingModes[domain];
  }
  return dueDomains.length > 0 ? ["sites", "pendingChanges"] : [];
}

function removeSitesDueForRemoval(now) {
  const isDueForRemoval = (site) => site.removeAt && site.removeAt <= now;
  const removedDomains = state.sites.filter(isDueForRemoval).map((site) => site.domain);
  if (removedDomains.length === 0) return [];

  state.sites = state.sites.filter((site) => !isDueForRemoval(site));
  for (const domain of removedDomains) {
    delete state.unlocks[domain];
    delete state.pendingChanges.siteModes[domain];
  }
  return ["sites", "unlocks", "pendingChanges"];
}

function forgetClosedUnlocks(now) {
  const closedDomains = Object.keys(state.unlocks).filter((domain) => state.unlocks[domain].closesAt <= now);
  for (const domain of closedDomains) delete state.unlocks[domain];
  return closedDomains.length > 0 ? ["unlocks"] : [];
}
