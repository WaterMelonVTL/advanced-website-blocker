import { syncBlockRules } from "./block-rules.js";
import { sendBlockedTabsToBlockPage } from "./open-tabs.js";

/** After anything that may block a site: update the rules for new page loads, then fix open tabs. */
export async function enforceBlocking() {
  await syncBlockRules();
  await sendBlockedTabsToBlockPage();
}
