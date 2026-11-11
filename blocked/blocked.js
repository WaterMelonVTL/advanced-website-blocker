import { isWebAddress, parseBlockPageAddress } from "../shared/block-page-address.js";
import { askBackground, browserApi, MESSAGE } from "../shared/browser.js";
import { BLOCK_MODE, UNLOCK_PHASE } from "../shared/constants.js";
import { byId, setVisible } from "../shared/dom.js";
import { formatClockTime, formatCountdown, formatDayAndTime, pluralize } from "../shared/format.js";
import { renderAlternatives } from "./alternatives-grid.js";
import { initTypingChallenge, prepareTypingChallenge } from "./typing-challenge.js";

const { domain, originalUrl, isRedirectedOpenTab } = parseBlockPageAddress(location.search);

const VIEW_IDS = ["typing-challenge", "countdown", "not-blocked"];
const COUNTDOWN_TICK_MS = 250;

let countdownTimer = null;

function showOnlyView(viewId) {
  VIEW_IDS.forEach((id) => setVisible(byId(id), id === viewId));
}

/** Syncs the rules first: otherwise the redirect could still send us back here. */
async function continueToOriginalPage() {
  if (!isWebAddress(originalUrl)) {
    showOnlyView("not-blocked");
    return;
  }
  await askBackground(MESSAGE.SYNC_BLOCK_RULES);
  location.replace(originalUrl);
}

function describeBlockReason(site) {
  if (site.mode === BLOCK_MODE.ALWAYS) return "This site is on your block list.";
  return "This site is blocked during your scheduled focus time.";
}

function describeVisits(site) {
  const visitsNote = site.blockedVisitsToday > 0
    ? `You've landed here ${pluralize(site.blockedVisitsToday, "time")} today.`
    : "";
  const removalNote = site.removeAt ? `It will leave your list on ${formatDayAndTime(site.removeAt)}.` : "";
  return [visitsNote, removalNote].filter(Boolean).join(" ");
}

function stopCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = null;
}

function tickCountdown(unlock) {
  const remainingMs = unlock.opensAt - Date.now();
  byId("countdown-clock").textContent = formatCountdown(remainingMs);
  document.title = `${formatCountdown(remainingMs)} · ${domain}`;
  if (remainingMs > 0) return;

  stopCountdown();
  continueToOriginalPage();
}

function showCountdown(unlock) {
  showOnlyView("countdown");
  byId("unlock-section").open = true;
  setVisible(byId("gave-up-message"), false);
  byId("unlock-window").textContent =
    `Open from ${formatClockTime(unlock.opensAt)} until ${formatClockTime(unlock.closesAt)}.`;

  stopCountdown();
  tickCountdown(unlock);
  countdownTimer = setInterval(() => tickCountdown(unlock), COUNTDOWN_TICK_MS);
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

  byId("block-reason").textContent = describeBlockReason(site);
  byId("visit-count").textContent = describeVisits(site);
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

/** Counts real attempts only: not reloads, back/forward, or tabs the extension redirected itself. */
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
