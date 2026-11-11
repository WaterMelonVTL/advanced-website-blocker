import { buildDraft, CHANGE_TYPE, planChanges } from "../shared/change-plan.js";
import { COOLDOWN_MS, SETTING_LIMITS } from "../shared/constants.js";
import { domainFromUserInput } from "../shared/domains.js";
import { enforceBlocking } from "./enforcement.js";
import { createSite, toBlockMode } from "./sites.js";
import { currentConfig, findSiteByDomain, removeSite, saveState, state } from "./state.js";

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "Confirm" on the options page: each change applies now, or waits for the cooldown when it weakens blocking. */
export async function commitDraft(draft) {
  const changes = planChanges(currentConfig(), sanitizeDraft(draft));
  const cooldownEndsAt = Date.now() + COOLDOWN_MS;
  changes.forEach((change) => APPLY_CHANGE[change.type](change, cooldownEndsAt));

  await saveState("sites", "schedules", "settings", "unlocks", "pendingChanges");
  await enforceBlocking();
  return { ok: true, changes };
}

function sanitizeDraft(draft) {
  return {
    sites: sanitizeSites(draft?.sites ?? []),
    schedules: (draft?.schedules ?? []).filter(isWellFormedSchedule).map(normalizeSchedule),
    settings: sanitizeSettings(draft?.settings ?? {}),
  };
}

function draftSitesByDomain(draftSites) {
  const sitesByDomain = new Map();
  for (const draftSite of draftSites) {
    const domain = domainFromUserInput(draftSite.domain);
    if (!domain || sitesByDomain.has(domain)) continue;
    sitesByDomain.set(domain, { domain, mode: toBlockMode(draftSite.mode), removing: Boolean(draftSite.removing) });
  }
  return sitesByDomain;
}

/** A listed site missing from the draft stays as it is: removal only happens through `removing`. */
function sanitizeSites(draftSites) {
  const sitesByDomain = draftSitesByDomain(draftSites);
  const unchangedSites = buildDraft(currentConfig()).sites.filter((site) => !sitesByDomain.has(site.domain));
  return [...sitesByDomain.values(), ...unchangedSites];
}

function isWellFormedSchedule(schedule) {
  return Boolean(schedule) && TIME_OF_DAY.test(schedule.start) && TIME_OF_DAY.test(schedule.end);
}

function normalizeSchedule(schedule) {
  const isWeekday = (day) => Number.isInteger(day) && day >= 0 && day <= 6;
  const uniqueDays = [...new Set((schedule.days ?? []).map(Number))].filter(isWeekday).sort();
  return {
    id: String(schedule.id ?? crypto.randomUUID()),
    days: uniqueDays,
    start: schedule.start,
    end: schedule.end,
  };
}

function clampToWholeNumber(value, { min, max }, fallback) {
  const wholeNumber = Math.round(Number(value));
  if (!Number.isFinite(wholeNumber)) return fallback;
  return Math.min(max, Math.max(min, wholeNumber));
}

function sanitizeSettings(draftSettings) {
  const sanitizedEntries = Object.entries(SETTING_LIMITS)
    .map(([key, limits]) => [key, clampToWholeNumber(draftSettings[key], limits, state.settings[key])]);
  return Object.fromEntries(sanitizedEntries);
}

function addSite({ domain, mode, modeDuringCooldown, waitsForCooldown }, cooldownEndsAt) {
  if (findSiteByDomain(domain)) return;
  if (!waitsForCooldown) {
    state.sites.push(createSite(domain, mode));
    return;
  }
  state.sites.push(createSite(domain, modeDuringCooldown));
  state.pendingChanges.siteModes[domain] = { mode, applyAt: cooldownEndsAt };
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

function removeOrScheduleRemoval({ domain, waitsForCooldown }, cooldownEndsAt) {
  const site = findSiteByDomain(domain);
  if (!site || site.removeAt) return;
  if (waitsForCooldown) site.removeAt = cooldownEndsAt;
  else removeSite(domain);
}

function cancelRemoval({ domain }) {
  const site = findSiteByDomain(domain);
  if (site) site.removeAt = null;
}

/** A loosening edit restarts the cooldown, so a small change can't be used to sneak in a bigger one later. */
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

const APPLY_CHANGE = Object.freeze({
  [CHANGE_TYPE.ADD_SITE]: addSite,
  [CHANGE_TYPE.SET_MODE]: setMode,
  [CHANGE_TYPE.CANCEL_MODE_SWITCH]: cancelModeSwitch,
  [CHANGE_TYPE.REMOVE_SITE]: removeOrScheduleRemoval,
  [CHANGE_TYPE.CANCEL_REMOVAL]: cancelRemoval,
  [CHANGE_TYPE.SET_SCHEDULES]: setSchedules,
  [CHANGE_TYPE.SET_SETTING]: setSetting,
});
