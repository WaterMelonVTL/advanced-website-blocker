import { BLOCK_MODE } from "../shared/constants.js";
import { domainFromUserInput } from "../shared/domains.js";
import { enforceBlocking } from "./enforcement.js";
import { findSiteByDomain, saveState, state } from "./state.js";

export function toBlockMode(value) {
  return Object.values(BLOCK_MODE).includes(value) ? value : BLOCK_MODE.ALWAYS;
}

/** The popup only blocks: allowing a site goes through the options page and its cooldown. */
function toStrictBlockMode(value) {
  return value === BLOCK_MODE.ON_SCHEDULE ? BLOCK_MODE.ON_SCHEDULE : BLOCK_MODE.ALWAYS;
}

export function createSite(domain, mode) {
  return { domain, mode: toBlockMode(mode), addedAt: Date.now(), removeAt: null };
}

function listOrKeepSite(domain, mode) {
  const alreadyListedSite = findSiteByDomain(domain);
  if (!alreadyListedSite) {
    state.sites.push(createSite(domain, mode));
    return;
  }
  alreadyListedSite.removeAt = null;
}

/**
 * The popup's "Block this site". Blocking more is never delayed.
 * @param {string} address a full URL or a bare domain
 */
export async function blockSiteNow(address, mode) {
  const domain = domainFromUserInput(address);
  if (!domain) return { ok: false, error: "That doesn't look like a valid domain." };

  listOrKeepSite(domain, toStrictBlockMode(mode));
  await saveState("sites");
  await enforceBlocking();
  return { ok: true, domain };
}
