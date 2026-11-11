// "Confirm" on the options page: plan the draft against the confirmed configuration and apply
// each change, either right away or as a pending change that waits for the cooldown.
import { CHANGE_TYPE, planChanges } from "../shared/change-plan.js";
import { COOLDOWN_MS } from "../shared/constants.js";
import { sanitizeDraft } from "./draft-validation.js";
import { enforceBlocking } from "./enforcement.js";
import { createSite } from "./sites.js";
import { currentConfig, findSiteByDomain, saveState, state } from "./state.js";

export async function commitDraft(draft) {
  const changes = planChanges(currentConfig(), sanitizeDraft(draft));
  const cooldownEndsAt = Date.now() + COOLDOWN_MS;
  for (const change of changes) APPLY_CHANGE[change.type](change, cooldownEndsAt);

  await saveState("sites", "schedules", "settings", "pendingChanges");
  await enforceBlocking();
  return { ok: true, changes };
}

const APPLY_CHANGE = Object.freeze({
  [CHANGE_TYPE.ADD_SITE]: addSite,
  [CHANGE_TYPE.SET_MODE]: setMode,
  [CHANGE_TYPE.CANCEL_MODE_SWITCH]: cancelModeSwitch,
  [CHANGE_TYPE.SCHEDULE_REMOVAL]: scheduleRemoval,
  [CHANGE_TYPE.CANCEL_REMOVAL]: cancelRemoval,
  [CHANGE_TYPE.SET_SCHEDULES]: setSchedules,
  [CHANGE_TYPE.SET_SETTING]: setSetting,
});

function addSite({ domain, mode }) {
  if (findSiteByDomain(domain)) return;
  state.sites.push(createSite(domain, mode));
}

function setMode({ domain, mode, waitsForCooldown }, cooldownEndsAt) {
  const site = findSiteByDomain(domain);
  if (!site) return;

  if (waitsForCooldown) {
    state.pendingChanges.siteModes[domain] = { mode, applyAt: cooldownEndsAt };
    return;
  }
  site.mode = mode;
  delete state.pendingChanges.siteModes[domain];
}

function cancelModeSwitch({ domain }) {
  delete state.pendingChanges.siteModes[domain];
}

function scheduleRemoval({ domain }, cooldownEndsAt) {
  const site = findSiteByDomain(domain);
  if (site && !site.removeAt) site.removeAt = cooldownEndsAt;
}

function cancelRemoval({ domain }) {
  const site = findSiteByDomain(domain);
  if (site) site.removeAt = null;
}

/** A loosening schedule edit restarts the cooldown, so a small change can't sneak in a big one later. */
function setSchedules({ schedules, waitsForCooldown }, cooldownEndsAt) {
  if (waitsForCooldown) {
    state.pendingChanges.schedules = { schedules, applyAt: cooldownEndsAt };
    return;
  }
  state.schedules = schedules;
  state.pendingChanges.schedules = null;
}

function setSetting({ key, value, waitsForCooldown }, cooldownEndsAt) {
  if (waitsForCooldown) {
    state.pendingChanges.settings[key] = { value, applyAt: cooldownEndsAt };
    return;
  }
  state.settings[key] = value;
  delete state.pendingChanges.settings[key];
}
