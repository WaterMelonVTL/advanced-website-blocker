import { askBackground, browserApi, MESSAGE } from "../shared/browser.js";
import { byId, setVisible } from "../shared/dom.js";
import { initAlternativesSection, renderAlternativesSection } from "./alternatives-section.js";
import { hasUnconfirmedChanges, onStructureChanged, onValueEdited, reloadConfig } from "./editor.js";
import { initReviewBar, renderReviewBar } from "./review-bar.js";
import { initSchedulesSection, renderSchedulesSection } from "./schedules-section.js";
import { initSettingsSection, renderSettingsSection } from "./settings-section.js";
import { initSitesSection, renderSitesSection } from "./sites-section.js";

const STATUS_REFRESH_INTERVAL_MS = 15 * 1000;
const ALL_SITES = Object.freeze({ origins: ["<all_urls>"] });

function renderAllSections() {
  renderSitesSection();
  renderSchedulesSection();
  renderSettingsSection();
  renderAlternativesSection();
  renderReviewBar();
}

function renderValueDependentParts() {
  renderSettingsSection();
  renderReviewBar();
}

function warnBeforeLeavingWithUnconfirmedChanges(event) {
  if (hasUnconfirmedChanges()) event.preventDefault();
}

/** Keeps statuses (unlocks, schedule periods) fresh, but never while the user is typing in a field. */
function refreshStatusesUnlessEditing() {
  const isEditingAField = document.activeElement?.matches("input, select");
  if (!isEditingAField) reloadConfig({ keepUnconfirmedEdits: true });
}

/** Firefox can install Manifest V3 add-ons without the host access that blocking needs. */
async function renderPermissionNotice() {
  const hasAccess = await browserApi.permissions.contains(ALL_SITES);
  setVisible(byId("permission-notice"), !hasAccess);
}

async function requestAllSitesAccess() {
  await browserApi.permissions.request(ALL_SITES);
  await renderPermissionNotice();
  askBackground(MESSAGE.SYNC_BLOCK_RULES);
}

initSitesSection();
initSchedulesSection();
initSettingsSection();
initAlternativesSection();
initReviewBar();
byId("grant-permission").addEventListener("click", requestAllSitesAccess);

onStructureChanged(renderAllSections);
onValueEdited(renderValueDependentParts);
window.addEventListener("beforeunload", warnBeforeLeavingWithUnconfirmedChanges);

reloadConfig({ keepUnconfirmedEdits: false });
renderPermissionNotice();
setInterval(refreshStatusesUnlessEditing, STATUS_REFRESH_INTERVAL_MS);
