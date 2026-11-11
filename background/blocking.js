import { BLOCK_MODE, UNLOCK_PHASE } from "../shared/constants.js";
import { findMostSpecificSite, webHostnameOf } from "../shared/domains.js";
import { isAnyScheduleActive } from "../shared/schedules.js";
import { state } from "./state.js";

export function findSiteForHostname(hostname) {
  return findMostSpecificSite(state.sites, hostname);
}

/** While a schedule change waits for its cooldown, the old and the new schedules both block. */
export function isInBlockPeriod(site, date = new Date()) {
  if (site.mode === BLOCK_MODE.NEVER) return false;
  if (site.mode === BLOCK_MODE.ALWAYS) return true;

  const pendingSchedules = state.pendingChanges.schedules?.schedules ?? [];
  return isAnyScheduleActive(state.schedules, date) || isAnyScheduleActive(pendingSchedules, date);
}

export function getUnlock(domain, now = Date.now()) {
  const unlock = state.unlocks[domain];
  if (!unlock || now >= unlock.closesAt) return { phase: UNLOCK_PHASE.NONE };

  const phase = now < unlock.opensAt ? UNLOCK_PHASE.WAITING : UNLOCK_PHASE.OPEN;
  return { phase, ...unlock };
}

export function isBlockedNow(site) {
  return isInBlockPeriod(site) && getUnlock(site.domain).phase !== UNLOCK_PHASE.OPEN;
}

export function findSiteBlockingUrl(url) {
  const site = findSiteForHostname(webHostnameOf(url));
  return site && isBlockedNow(site) ? site : null;
}
