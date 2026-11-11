import { UNLOCK_PHASE } from "../shared/constants.js";
import { domainFromUserInput, webHostnameOf } from "../shared/domains.js";
import { findSiteForHostname, getUnlock, isInBlockPeriod } from "./blocking.js";
import { blockedVisitsToday } from "./block-counts.js";
import { findSiteByDomain, state } from "./state.js";

/** A site enriched with its current status, as the pages see it. */
function describeSite(site) {
  const inBlockPeriod = isInBlockPeriod(site);
  const unlock = getUnlock(site.domain);
  return {
    ...site,
    inBlockPeriod,
    blockedNow: inBlockPeriod && unlock.phase !== UNLOCK_PHASE.OPEN,
    unlock,
    pendingModeSwitch: state.pendingChanges.siteModes[site.domain] ?? null,
    blockedVisitsToday: blockedVisitsToday(site.domain),
  };
}

/** Everything the options page and the popup show. Also a valid `config` for `planChanges`. */
export function buildOverview() {
  const describedSites = state.sites.map(describeSite).sort((first, second) => first.domain.localeCompare(second.domain));
  return {
    sites: describedSites,
    schedules: state.schedules,
    settings: state.settings,
    alternatives: state.alternatives,
    pendingChanges: state.pendingChanges,
  };
}

/** For the popup: which listed site (if any) covers the page the user is on. */
export function describeUrl(url) {
  const hostname = webHostnameOf(url);
  const site = findSiteForHostname(hostname);
  return {
    hostname,
    domain: domainFromUserInput(hostname),
    site: site ? describeSite(site) : null,
  };
}

/** For the block page. */
export function describeBlockedSite(domain) {
  const site = findSiteByDomain(domain);
  return {
    site: site ? describeSite(site) : null,
    settings: state.settings,
    alternatives: state.alternatives,
  };
}
