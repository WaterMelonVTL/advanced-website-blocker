// Unlocking a site: after the sentence is typed, the site opens once the wait is over,
// and stays open until the unlock closes.
import { browserApi } from "../shared/browser.js";
import { MINUTE_MS, UNLOCK_PHASE } from "../shared/constants.js";
import { getUnlock } from "./blocking.js";
import { syncBlockRules } from "./block-rules.js";
import { discardChallenge, isChallengeAnswered } from "./challenges.js";
import { enforceBlocking } from "./enforcement.js";
import { findSiteByDomain, saveState, state } from "./state.js";

/** Small margin so the alarm fires just after the moment, not just before. */
const ALARM_MARGIN_MS = 250;

const alarmNames = (domain) => ({
  opens: `unlock-opens:${domain}`,
  closes: `unlock-closes:${domain}`,
});

function createUnlockWindow(startedAt) {
  const opensAt = startedAt + state.settings.waitMinutes * MINUTE_MS;
  const closesAt = opensAt + state.settings.unlockMinutes * MINUTE_MS;
  return { opensAt, closesAt };
}

/** Alarms wake the background at both moments; the housekeeping they trigger updates the rules. */
function scheduleUnlockAlarms(domain, { opensAt, closesAt }) {
  const names = alarmNames(domain);
  browserApi.alarms.create(names.opens, { when: opensAt + ALARM_MARGIN_MS });
  browserApi.alarms.create(names.closes, { when: closesAt + ALARM_MARGIN_MS });
}

function cancelUnlockAlarms(domain) {
  const names = alarmNames(domain);
  browserApi.alarms.clear(names.opens);
  browserApi.alarms.clear(names.closes);
}

export async function startUnlock(domain, typedText) {
  if (!findSiteByDomain(domain)) return { ok: false, error: "This site is not on your block list." };

  const existingUnlock = getUnlock(domain);
  if (existingUnlock.phase !== UNLOCK_PHASE.NONE) return { ok: true, unlock: existingUnlock };

  const isAnswered = await isChallengeAnswered(domain, typedText);
  if (!isAnswered) return { ok: false, error: "The text doesn't match. Check it and try again." };

  await discardChallenge(domain);
  state.unlocks[domain] = createUnlockWindow(Date.now());
  await saveState("unlocks");
  scheduleUnlockAlarms(domain, state.unlocks[domain]);
  await syncBlockRules(); // with a 0-minute wait the site is open right away

  return { ok: true, unlock: getUnlock(domain) };
}

/** Ends an unlock early, or cancels one that is still waiting. */
export async function lockNow(domain) {
  delete state.unlocks[domain];
  cancelUnlockAlarms(domain);
  await saveState("unlocks");
  await enforceBlocking();
}
