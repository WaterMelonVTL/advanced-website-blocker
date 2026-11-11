// Rules only apply to new page loads. Tabs already showing a site that just became blocked
// (a schedule period starting, an unlock closing...) are sent to the block page here.
import { browserApi } from "../shared/browser.js";
import { buildBlockPageAddress } from "../shared/block-page-address.js";
import { findSiteBlockingUrl } from "./blocking.js";
import { stateReady } from "./state.js";

function sendTabToBlockPageIfBlocked(tab) {
  const blockingSite = tab.url && findSiteBlockingUrl(tab.url);
  if (!blockingSite) return;

  const blockPageAddress = buildBlockPageAddress(blockingSite.domain, tab.url, { isRedirectedOpenTab: true });
  browserApi.tabs.update(tab.id, { url: blockPageAddress }).catch(() => { /* the tab was closed meanwhile */ });
}

export async function sendBlockedTabsToBlockPage() {
  await stateReady;
  const openTabs = await browserApi.tabs.query({});
  openTabs.forEach(sendTabToBlockPageIfBlocked);
}
