// The sentence each block page asks the user to type. Kept in session storage so it
// survives the background being unloaded while the user is typing.
import { browserApi } from "../shared/browser.js";
import { SENTENCE_PREFIX } from "../shared/constants.js";
import { generateRandomSentence, isTypedTextCorrect } from "../shared/sentence.js";

const sessionStorage = browserApi.storage.session;

function storageKeyFor(domain) {
  return `challenge:${domain}`;
}

async function readSentence(domain) {
  const key = storageKeyFor(domain);
  const stored = await sessionStorage.get(key);
  return stored[key];
}

/** The full text to type: the fixed prefix followed by this domain's random sentence. */
export async function getOrCreateExpectedText(domain) {
  const existingSentence = await readSentence(domain);
  const sentence = existingSentence ?? generateRandomSentence();
  if (!existingSentence) await sessionStorage.set({ [storageKeyFor(domain)]: sentence });
  return SENTENCE_PREFIX + sentence;
}

export async function discardChallenge(domain) {
  await sessionStorage.remove(storageKeyFor(domain));
}

export async function isChallengeAnswered(domain, typedText) {
  const sentence = await readSentence(domain);
  if (!sentence) return false;
  return isTypedTextCorrect(typedText, SENTENCE_PREFIX + sentence);
}
