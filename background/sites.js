import { BLOCK_MODE } from "../shared/constants.js";
import { domainFromUserInput } from "../shared/domains.js";
import { enforceBlocking } from "./enforcement.js";
import { findSiteByDomain, saveState, state } from "./state.js";

export function toBlockMode(value) {
  return value === BLOCK_MODE.ON_SCHEDULE ? BLOCK_MODE.ON_SCHEDULE : BLOCK_MODE.ALWAYS;
}

export function createSite(domain, mode) {
  return { domain, mode: toBlockMode(mode), addedAt: Date.now(), removeAt: null };
}

/** The popup's "Block this site" (confirmed in the popup first). Blocking more is never delayed.
 *  `address` can be a full URL or a bare domain. */
export async function blockSiteNow(address, mode) {
  const domain = domainFromUserInput(address);
  if (!domain) return { ok: false, error: "That doesn't look like a valid domain." };

  const alreadyListedSite = findSiteByDomain(domain);
  if (alreadyListedSite) alreadyListedSite.removeAt = null;
  else state.sites.push(createSite(domain, mode));

  await saveState("sites");
  await enforceBlocking();
  return { ok: true, domain };
}
