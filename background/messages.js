import { MESSAGE } from "../shared/browser.js";
import { saveAlternatives } from "./alternatives.js";
import { recordBlockedVisit } from "./block-counts.js";
import { syncBlockRules } from "./block-rules.js";
import { commitDraft } from "./commit-draft.js";
import { enforceBlocking } from "./enforcement.js";
import { applyDueChanges } from "./housekeeping.js";
import { blockSiteNow } from "./sites.js";
import { buildOverview, describeBlockedSite, describeUrl } from "./site-views.js";
import { stateReady } from "./state.js";
import { getOrCreateExpectedText, lockNow, replaceChallenge, startUnlock } from "./unlocks.js";

const HANDLERS = Object.freeze({
  [MESSAGE.GET_OVERVIEW]: () => buildOverview(),
  [MESSAGE.DESCRIBE_URL]: ({ url }) => describeUrl(url),
  [MESSAGE.GET_BLOCKED_SITE]: ({ domain }) => describeBlockedSite(domain),
  [MESSAGE.GET_CHALLENGE]: async ({ domain }) => ({ expectedText: await getOrCreateExpectedText(domain) }),
  [MESSAGE.REPLACE_CHALLENGE]: async ({ domain }) => ({ expectedText: await replaceChallenge(domain) }),
  [MESSAGE.RECORD_BLOCKED_VISIT]: ({ domain }) => recordBlockedVisit(domain),
  [MESSAGE.START_UNLOCK]: ({ domain, typedText }) => startUnlock(domain, typedText),
  [MESSAGE.LOCK_NOW]: ({ domain }) => lockNow(domain),
  [MESSAGE.SYNC_BLOCK_RULES]: () => syncBlockRules(),
  [MESSAGE.BLOCK_SITE_NOW]: ({ address, mode }) => blockSiteNow(address, mode),
  [MESSAGE.COMMIT_DRAFT]: ({ draft }) => commitDraft(draft),
  [MESSAGE.SAVE_ALTERNATIVES]: ({ alternatives }) => saveAlternatives(alternatives),
});

async function applyWhatIsDue() {
  const somethingWasDue = await applyDueChanges();
  if (somethingWasDue) await enforceBlocking();
}

/** Answers a page. Due changes are applied first, so cooldowns never depend on an alarm firing. */
export async function handleMessage(message) {
  await stateReady;
  await applyWhatIsDue();

  const handler = HANDLERS[message?.type];
  if (!handler) return { ok: false, error: `Unknown message: ${message?.type}` };

  const answer = await handler(message);
  return answer ?? { ok: true };
}
