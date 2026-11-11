import { buildBlockPageAddress } from "../shared/block-page-address.js";
import { browserApi } from "../shared/browser.js";
import { findSiteBlockingUrl } from "./blocking.js";
import { syncBlockRules } from "./block-rules.js";
import { stateReady } from "./state.js";
import { scheduleNextWakeUp } from "./wake-up.js";

function ignoreClosedTab() {}

function sendTabToBlockPageIfBlocked(tab) {
  const blockingSite = tab.url && findSiteBlockingUrl(tab.url);
  if (!blockingSite) return;

  const blockPageAddress = buildBlockPageAddress(blockingSite.domain, tab.url, { isRedirectedOpenTab: true });
  browserApi.tabs.update(tab.id, { url: blockPageAddress }).catch(ignoreClosedTab);
}

/** Redirect rules only apply to new page loads; tabs already showing a newly blocked site are moved here. */
async function sendBlockedTabsToBlockPage() {
  await stateReady;
  const openTabs = await browserApi.tabs.query({});
  openTabs.forEach(sendTabToBlockPageIfBlocked);
}

/** Call after any state change: updates the rules, moves blocked open tabs, and plans the next wake-up. */
export async function enforceBlocking() {
  await syncBlockRules();
  await sendBlockedTabsToBlockPage();
  await scheduleNextWakeUp();
}
