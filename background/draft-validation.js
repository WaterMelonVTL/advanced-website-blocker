// Drafts come from a page, so they are checked and normalized before being planned.
import { buildDraft } from "../shared/change-plan.js";
import { SETTING_LIMITS } from "../shared/constants.js";
import { domainFromUserInput } from "../shared/domains.js";
import { toBlockMode } from "./sites.js";
import { currentConfig, state } from "./state.js";

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export function sanitizeDraft(draft) {
  return {
    sites: sanitizeSites(draft?.sites ?? []),
    schedules: sanitizeSchedules(draft?.schedules ?? []),
    settings: sanitizeSettings(draft?.settings ?? {}),
  };
}

function sanitizeSites(draftSites) {
  const sitesByDomain = new Map();
  for (const draftSite of draftSites) {
    const domain = domainFromUserInput(draftSite.domain);
    if (!domain || sitesByDomain.has(domain)) continue;
    sitesByDomain.set(domain, { domain, mode: toBlockMode(draftSite.mode), removing: Boolean(draftSite.removing) });
  }

  // A listed site missing from the draft stays as it is: removal only happens through "removing".
  const unchangedSites = buildDraft(currentConfig()).sites;
  for (const unchangedSite of unchangedSites) {
    if (!sitesByDomain.has(unchangedSite.domain)) sitesByDomain.set(unchangedSite.domain, unchangedSite);
  }
  return [...sitesByDomain.values()];
}

function sanitizeSchedules(draftSchedules) {
  return draftSchedules.filter(isWellFormedSchedule).map(normalizeSchedule);
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

function sanitizeSettings(draftSettings) {
  const sanitized = {};
  for (const [key, { min, max }] of Object.entries(SETTING_LIMITS)) {
    sanitized[key] = clampToWholeNumber(draftSettings[key], min, max, state.settings[key]);
  }
  return sanitized;
}

function clampToWholeNumber(value, min, max, fallback) {
  const wholeNumber = Math.round(Number(value));
  if (!Number.isFinite(wholeNumber)) return fallback;
  return Math.min(max, Math.max(min, wholeNumber));
}
