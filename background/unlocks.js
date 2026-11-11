import { browserApi } from "../shared/browser.js";
import { MINUTE_MS, SENTENCE_PREFIX, UNLOCK_PHASE } from "../shared/constants.js";
import { generateRandomSentence, isTypedTextCorrect } from "../shared/sentence.js";
import { getUnlock } from "./blocking.js";
import { enforceBlocking } from "./enforcement.js";
import { findSiteByDomain, saveState, state } from "./state.js";

/** Session storage keeps each block page's sentence alive if the background is unloaded while the user types. */
const sessionStorage = browserApi.storage.session;

function challengeKeyFor(domain) {
  return `challenge:${domain}`;
}

async function readSentence(domain) {
  const key = challengeKeyFor(domain);
  const stored = await sessionStorage.get(key);
  return stored[key];
}

/** The full text to type: the fixed prefix followed by this domain's random sentence. */
export async function getOrCreateExpectedText(domain) {
  const existingSentence = await readSentence(domain);
  const sentence = existingSentence ?? generateRandomSentence();
  if (!existingSentence) await sessionStorage.set({ [challengeKeyFor(domain)]: sentence });
  return SENTENCE_PREFIX + sentence;
}

async function discardChallenge(domain) {
  await sessionStorage.remove(challengeKeyFor(domain));
}

/** "Never mind": the next attempt gets a new sentence. */
export async function replaceChallenge(domain) {
  await discardChallenge(domain);
  return getOrCreateExpectedText(domain);
}

async function isChallengeAnswered(domain, typedText) {
  const sentence = await readSentence(domain);
  if (!sentence) return false;
  return isTypedTextCorrect(typedText, SENTENCE_PREFIX + sentence);
}

function createUnlockWindow(startedAt) {
  const opensAt = startedAt + state.settings.waitMinutes * MINUTE_MS;
  const closesAt = opensAt + state.settings.unlockMinutes * MINUTE_MS;
  return { opensAt, closesAt };
}

async function openUnlockWindow(domain) {
  await discardChallenge(domain);
  state.unlocks[domain] = createUnlockWindow(Date.now());
  await saveState("unlocks");
  await enforceBlocking();
}

export async function startUnlock(domain, typedText) {
  if (!findSiteByDomain(domain)) return { ok: false, error: "This site is not on your block list." };

  const existingUnlock = getUnlock(domain);
  if (existingUnlock.phase !== UNLOCK_PHASE.NONE) return { ok: true, unlock: existingUnlock };

  const isAnswered = await isChallengeAnswered(domain, typedText);
  if (!isAnswered) return { ok: false, error: "The text doesn't match. Check it and try again." };

  await openUnlockWindow(domain);
  return { ok: true, unlock: getUnlock(domain) };
}

/** Ends an unlock early, or cancels one that is still waiting. */
export async function lockNow(domain) {
  delete state.unlocks[domain];
  await saveState("unlocks");
  await enforceBlocking();
}
