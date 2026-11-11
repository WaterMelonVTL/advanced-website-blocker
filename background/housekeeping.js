import { enforceBlocking } from "./enforcement.js";
import { findSiteByDomain, saveState, state, stateReady } from "./state.js";

/** Runs when the background wakes up: applies what's due, then enforces blocking. */
export async function runHousekeeping() {
  await applyDueChanges();
  await enforceBlocking();
}

/**
 * Applies everything whose time has come: pending changes, removals, closed unlocks.
 * All of these are timestamps, so running it from an alarm or lazily from a request gives the same result.
 * @returns {Promise<boolean>} whether anything changed
 */
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

/** @returns {string[]} the state keys it changed, like every step below */
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

function forgetSite(domain) {
  delete state.unlocks[domain];
  delete state.pendingChanges.siteModes[domain];
}

function removeSitesDueForRemoval(now) {
  const isDueForRemoval = (site) => site.removeAt && site.removeAt <= now;
  const removedDomains = state.sites.filter(isDueForRemoval).map((site) => site.domain);
  if (removedDomains.length === 0) return [];

  state.sites = state.sites.filter((site) => !isDueForRemoval(site));
  removedDomains.forEach(forgetSite);
  return ["sites", "unlocks", "pendingChanges"];
}

function forgetClosedUnlocks(now) {
  const closedDomains = Object.keys(state.unlocks).filter((domain) => state.unlocks[domain].closesAt <= now);
  for (const domain of closedDomains) delete state.unlocks[domain];
  return closedDomains.length > 0 ? ["unlocks"] : [];
}
