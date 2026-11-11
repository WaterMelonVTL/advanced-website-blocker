// Answers the requests sent by the popup, the options page and the block page.
import { MESSAGE } from "../shared/messages.js";
import { saveAlternatives } from "./alternatives.js";
import { recordBlockedVisit } from "./block-counts.js";
import { syncBlockRules } from "./block-rules.js";
import { discardChallenge, getOrCreateExpectedText } from "./challenges.js";
import { commitDraft } from "./commit-draft.js";
import { applyDueChanges } from "./housekeeping.js";
import { blockSiteNow } from "./sites.js";
import { buildOverview, describeBlockedSite, describeUrl } from "./site-views.js";
import { stateReady } from "./state.js";
import { lockNow, startUnlock } from "./unlocks.js";

async function replaceChallenge(domain) {
  await discardChallenge(domain);
  return { expectedText: await getOrCreateExpectedText(domain) };
}

const HANDLERS = Object.freeze({
  [MESSAGE.GET_OVERVIEW]: () => buildOverview(),
  [MESSAGE.DESCRIBE_URL]: ({ url }) => describeUrl(url),
  [MESSAGE.GET_BLOCKED_SITE]: ({ domain }) => describeBlockedSite(domain),
  [MESSAGE.GET_CHALLENGE]: async ({ domain }) => ({ expectedText: await getOrCreateExpectedText(domain) }),
  [MESSAGE.REPLACE_CHALLENGE]: ({ domain }) => replaceChallenge(domain),
  [MESSAGE.RECORD_BLOCKED_VISIT]: ({ domain }) => recordBlockedVisit(domain),
  [MESSAGE.START_UNLOCK]: ({ domain, typedText }) => startUnlock(domain, typedText),
  [MESSAGE.LOCK_NOW]: ({ domain }) => lockNow(domain),
  [MESSAGE.SYNC_BLOCK_RULES]: () => syncBlockRules(),
  [MESSAGE.BLOCK_SITE_NOW]: ({ address, mode }) => blockSiteNow(address, mode),
  [MESSAGE.COMMIT_DRAFT]: ({ draft }) => commitDraft(draft),
  [MESSAGE.SAVE_ALTERNATIVES]: ({ alternatives }) => saveAlternatives(alternatives),
});

export async function handleMessage(message) {
  await stateReady;

  // Cooldowns are timestamps: check them on every request, so they never depend on an alarm firing.
  const somethingWasDue = await applyDueChanges();
  if (somethingWasDue) await syncBlockRules();

  const handler = HANDLERS[message?.type];
  if (!handler) return { ok: false, error: `Unknown message: ${message?.type}` };

  const answer = await handler(message);
  return answer ?? { ok: true };
}
