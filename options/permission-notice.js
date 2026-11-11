// Firefox can install Manifest V3 add-ons without host access, which blocking needs.
import { browserApi } from "../shared/browser.js";
import { byId, setVisible } from "../shared/dom.js";
import { askBackground, MESSAGE } from "../shared/messages.js";

const ALL_SITES = Object.freeze({ origins: ["<all_urls>"] });

export function initPermissionNotice() {
  byId("grant-permission").addEventListener("click", requestAllSitesAccess);
  renderPermissionNotice();
}

async function renderPermissionNotice() {
  const hasAccess = await browserApi.permissions.contains(ALL_SITES);
  setVisible(byId("permission-notice"), !hasAccess);
}

async function requestAllSitesAccess() {
  await browserApi.permissions.request(ALL_SITES);
  await renderPermissionNotice();
  askBackground(MESSAGE.SYNC_BLOCK_RULES);
}
