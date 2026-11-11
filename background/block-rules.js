// Translates the state into declarativeNetRequest rules: the browser redirects matching
// page loads to the block page by itself, even while the background is asleep.
import { browserApi } from "../shared/browser.js";
import { buildBlockPageAddress, MATCHED_URL_PLACEHOLDER } from "../shared/block-page-address.js";
import { isBlockedNow } from "./blocking.js";
import { state, stateReady } from "./state.js";

const MAX_RULE_PRIORITY = 1000;

function urlPatternFor(domain) {
  const escapedDomain = domain.replaceAll(".", "\\.");
  return `^https?://([^/?#]*\\.)?${escapedDomain}(:[0-9]+)?([/?#].*)?$`;
}

/** Longer domains are more specific, so they get a higher priority and win, like findSiteForHostname(). */
function priorityFor(domain) {
  return Math.min(MAX_RULE_PRIORITY, domain.length + 1);
}

function redirectToBlockPage(domain) {
  return {
    type: "redirect",
    redirect: { regexSubstitution: buildBlockPageAddress(domain, MATCHED_URL_PLACEHOLDER) },
  };
}

/** Listed sites that aren't blocked right now get an "allow" rule, so an unlocked
 *  music.youtube.com still opens while youtube.com stays blocked. */
function ruleFor(site, ruleId) {
  return {
    id: ruleId,
    priority: priorityFor(site.domain),
    condition: {
      regexFilter: urlPatternFor(site.domain),
      resourceTypes: ["main_frame"],
      isUrlFilterCaseSensitive: false,
    },
    action: isBlockedNow(site) ? redirectToBlockPage(site.domain) : { type: "allow" },
  };
}

function buildRules() {
  return state.sites.map((site, index) => ruleFor(site, index + 1));
}

function ruleSignature(rule) {
  return JSON.stringify([rule.priority, rule.condition.regexFilter, rule.action.type,
    rule.action.redirect?.regexSubstitution]);
}

function haveSameRules(wantedRules, installedRules) {
  return wantedRules.length === installedRules.length &&
    wantedRules.every((rule, index) => ruleSignature(rule) === ruleSignature(installedRules[index]));
}

async function replaceRulesIfOutdated() {
  await stateReady;
  const wantedRules = buildRules();
  const installedRules = await browserApi.declarativeNetRequest.getDynamicRules();
  if (haveSameRules(wantedRules, installedRules)) return;

  await browserApi.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: installedRules.map((rule) => rule.id),
    addRules: wantedRules,
  });
}

function reportSyncFailure(error) {
  console.error("Friction Blocker: could not update the blocking rules", error);
}

let queuedSync = Promise.resolve();

/** Brings the browser's rules in line with the state. Calls are queued so they never overlap. */
export function syncBlockRules() {
  queuedSync = queuedSync.then(replaceRulesIfOutdated).catch(reportSyncFailure);
  return queuedSync;
}
