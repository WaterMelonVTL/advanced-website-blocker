// The page shown instead of a blocked site. It moves between three views:
// the typing challenge, the countdown, and (rarely) "this site isn't blocked anymore".
import { isWebAddress, parseBlockPageAddress } from "../shared/block-page-address.js";
import { browserApi } from "../shared/browser.js";
import { BLOCK_MODE, UNLOCK_PHASE } from "../shared/constants.js";
import { byId, setVisible } from "../shared/dom.js";
import { formatDayAndTime, pluralize } from "../shared/format.js";
import { askBackground, MESSAGE } from "../shared/messages.js";
import { renderAlternatives } from "./alternatives-grid.js";
import { startCountdown, stopCountdown } from "./countdown.js";
import { initTypingChallenge, prepareTypingChallenge } from "./typing-challenge.js";

const { domain, originalUrl, isRedirectedOpenTab } = parseBlockPageAddress(location.search);

const VIEW_IDS = ["typing-challenge", "countdown", "not-blocked"];

function showOnlyView(viewId) {
  for (const id of VIEW_IDS) setVisible(byId(id), id === viewId);
}

async function continueToOriginalPage() {
  if (!isWebAddress(originalUrl)) {
    showOnlyView("not-blocked");
    return;
  }
  // Make sure the blocking rules already know about the unlock, or we'd be redirected back here.
  await askBackground(MESSAGE.SYNC_BLOCK_RULES);
  location.replace(originalUrl);
}

function explainBlock(site) {
  byId("block-reason").textContent = site.mode === BLOCK_MODE.ALWAYS
    ? "This site is on your block list."
    : "This site is blocked during your scheduled focus time.";

  const visitsNote = site.blockedVisitsToday > 0
    ? `You've landed here ${pluralize(site.blockedVisitsToday, "time")} today.`
    : "";
  const removalNote = site.removeAt ? `It will leave your list on ${formatDayAndTime(site.removeAt)}.` : "";
  byId("visit-count").textContent = [visitsNote, removalNote].filter(Boolean).join(" ");
}

function showCountdown(unlock) {
  showOnlyView("countdown");
  byId("unlock-section").open = true;
  setVisible(byId("gave-up-message"), false);
  startCountdown({ domain, unlock, onFinished: continueToOriginalPage });
}

async function showTypingChallenge(settings) {
  await prepareTypingChallenge(settings);
  showOnlyView("typing-challenge");
}

async function showCurrentState() {
  const { site, settings, alternatives } = await askBackground(MESSAGE.GET_BLOCKED_SITE, { domain });
  renderAlternatives(alternatives);

  const isStillBlocked = site && site.inBlockPeriod && site.unlock.phase !== UNLOCK_PHASE.OPEN;
  if (!isStillBlocked) return continueToOriginalPage();

  explainBlock(site);
  if (site.unlock.phase === UNLOCK_PHASE.WAITING) return showCountdown(site.unlock);
  return showTypingChallenge(settings);
}

function onUnlockStarted(unlock) {
  if (unlock.phase === UNLOCK_PHASE.OPEN) return continueToOriginalPage();
  return showCountdown(unlock);
}

async function giveUp() {
  stopCountdown();
  await askBackground(MESSAGE.LOCK_NOW, { domain });
  await askBackground(MESSAGE.REPLACE_CHALLENGE, { domain });
  document.title = `Blocked · ${domain}`;
  await showCurrentState();
  setVisible(byId("gave-up-message"), true);
}

/** Counts real attempts only: not reloads, back/forward, or tabs we redirected ourselves. */
function recordVisitIfNew() {
  const navigation = performance.getEntriesByType("navigation")[0];
  const isRepeatView = navigation?.type === "reload" || navigation?.type === "back_forward";
  if (!domain || isRedirectedOpenTab || isRepeatView) return;
  askBackground(MESSAGE.RECORD_BLOCKED_VISIT, { domain });
}

byId("blocked-domain").textContent = domain || "This site";
document.title = `Blocked · ${domain}`;

initTypingChallenge({ domain, onUnlockStarted });
byId("give-up").addEventListener("click", giveUp);
byId("continue").addEventListener("click", continueToOriginalPage);
byId("set-up-alternatives").addEventListener("click", () => browserApi.runtime.openOptionsPage());

recordVisitIfNew();
showCurrentState();
