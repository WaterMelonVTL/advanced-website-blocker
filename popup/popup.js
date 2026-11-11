// Toolbar popup: the status of the current site, a "Block this site" button,
// and the sites that are unlocked right now.
import { isBlockPageAddress, parseBlockPageAddress } from "../shared/block-page-address.js";
import { browserApi } from "../shared/browser.js";
import { UNLOCK_PHASE } from "../shared/constants.js";
import { byId, createButton, createElement, setVisible } from "../shared/dom.js";
import { formatClockTime, formatCountdown, formatDayAndTime } from "../shared/format.js";
import { askBackground, MESSAGE } from "../shared/messages.js";

const REFRESH_INTERVAL_MS = 1000;
const LOCK_CONFIRMATION_TIMEOUT_MS = 4000;

const popupState = {
  activeTabUrl: "",
  isConfirmingBlock: false,
  domainsAwaitingLockConfirmation: new Set(),
};

async function render() {
  await renderActiveSite();
  await renderUnlockedSites();
}

// ---------------------------------------------------------------------------
// The site in the active tab
// ---------------------------------------------------------------------------
async function getActiveTabUrl() {
  const [activeTab] = await browserApi.tabs.query({ active: true, currentWindow: true });
  return activeTab?.url ?? "";
}

/** On the block page, talk about the blocked site rather than the extension page. */
function addressToDescribe(tabUrl) {
  if (!isBlockPageAddress(tabUrl)) return tabUrl;
  const { domain } = parseBlockPageAddress(new URL(tabUrl).search);
  return domain ? `https://${domain}/` : tabUrl;
}

async function renderActiveSite() {
  popupState.activeTabUrl = await getActiveTabUrl();
  const { hostname, domain, site } = await askBackground(MESSAGE.DESCRIBE_URL, {
    url: addressToDescribe(popupState.activeTabUrl),
  });

  const canBeBlocked = Boolean(hostname) && !site;
  setVisible(byId("block-form"), canBeBlocked && !popupState.isConfirmingBlock);
  setVisible(byId("block-confirmation"), canBeBlocked && popupState.isConfirmingBlock);

  byId("site-name").textContent = site?.domain ?? (domain || hostname || "This page can't be blocked");
  byId("site-status").textContent = describeActiveSiteStatus(hostname, site);
  byId("confirmation-domain").textContent = domain || hostname;
}

function describeActiveSiteStatus(hostname, site) {
  if (!hostname) return "";
  if (!site) return "Not blocked";
  if (site.removeAt) return `On your list until ${formatDayAndTime(site.removeAt)}`;
  if (site.unlock.phase === UNLOCK_PHASE.OPEN) return `Unlocked until ${formatClockTime(site.unlock.closesAt)}`;
  if (site.unlock.phase === UNLOCK_PHASE.WAITING) return `Unlocks at ${formatClockTime(site.unlock.opensAt)}`;
  if (!site.inBlockPeriod) return "On your list, outside scheduled hours";
  return "Blocked";
}

function showBlockError(message) {
  byId("block-error").textContent = message;
  setVisible(byId("block-error"), Boolean(message));
}

async function blockActiveSite() {
  popupState.isConfirmingBlock = false;
  const result = await askBackground(MESSAGE.BLOCK_SITE_NOW, {
    address: popupState.activeTabUrl,
    mode: byId("block-mode").value,
  });
  showBlockError(result.ok ? "" : result.error);
  render();
}

function setConfirmingBlock(isConfirming) {
  popupState.isConfirmingBlock = isConfirming;
  render();
}

// ---------------------------------------------------------------------------
// Unlocked sites, with a two-click "Lock now"
// ---------------------------------------------------------------------------
async function renderUnlockedSites() {
  const { sites } = await askBackground(MESSAGE.GET_OVERVIEW);
  const unlockedSites = sites.filter((site) => site.unlock.phase !== UNLOCK_PHASE.NONE);
  setVisible(byId("unlocked-section"), unlockedSites.length > 0);
  byId("unlocked-sites").replaceChildren(...unlockedSites.map(createUnlockedSiteRow));
}

function createUnlockedSiteRow(site) {
  const label = createElement("span", { className: "unlocked-site-label" },
    createElement("strong", { textContent: site.domain }),
    createElement("br"),
    createElement("span", { className: "small muted", textContent: describeTimeLeft(site.unlock) }));
  return createElement("li", {}, label, createLockButton(site));
}

function describeTimeLeft(unlock) {
  if (unlock.phase === UNLOCK_PHASE.OPEN) return `${formatCountdown(unlock.closesAt - Date.now())} left`;
  return `opens in ${formatCountdown(unlock.opensAt - Date.now())}`;
}

function createLockButton(site) {
  const isAwaitingConfirmation = popupState.domainsAwaitingLockConfirmation.has(site.domain);
  const idleLabel = site.unlock.phase === UNLOCK_PHASE.OPEN ? "Lock now" : "Cancel";
  return createButton(
    isAwaitingConfirmation ? "Sure?" : idleLabel,
    isAwaitingConfirmation ? "primary" : "",
    () => onLockButtonClicked(site.domain),
  );
}

async function onLockButtonClicked(domain) {
  const awaitingConfirmation = popupState.domainsAwaitingLockConfirmation;
  if (!awaitingConfirmation.has(domain)) {
    askForLockConfirmation(domain);
    return;
  }
  awaitingConfirmation.delete(domain);
  await askBackground(MESSAGE.LOCK_NOW, { domain });
  render();
}

function askForLockConfirmation(domain) {
  const awaitingConfirmation = popupState.domainsAwaitingLockConfirmation;
  awaitingConfirmation.add(domain);
  setTimeout(() => {
    awaitingConfirmation.delete(domain);
    render();
  }, LOCK_CONFIRMATION_TIMEOUT_MS);
  render();
}

// ---------------------------------------------------------------------------
byId("block-site").addEventListener("click", () => setConfirmingBlock(true));
byId("cancel-block").addEventListener("click", () => setConfirmingBlock(false));
byId("confirm-block").addEventListener("click", blockActiveSite);
byId("open-options").addEventListener("click", () => {
  browserApi.runtime.openOptionsPage();
  window.close();
});

render();
setInterval(render, REFRESH_INTERVAL_MS);
