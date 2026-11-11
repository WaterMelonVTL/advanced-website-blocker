// Entry point of the options page: wires the sections to the shared editor state.
import { initAlternativesSection, renderAlternativesSection } from "./alternatives-section.js";
import { hasUnconfirmedChanges, onStructureChanged, onValueEdited, reloadConfig } from "./editor.js";
import { initPermissionNotice } from "./permission-notice.js";
import { initReviewBar, renderReviewBar } from "./review-bar.js";
import { initSchedulesSection, renderSchedulesSection } from "./schedules-section.js";
import { initSettingsSection, renderSettingsSection } from "./settings-section.js";
import { initSitesSection, renderSitesSection } from "./sites-section.js";

const STATUS_REFRESH_INTERVAL_MS = 15 * 1000;

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

initSitesSection();
initSchedulesSection();
initSettingsSection();
initAlternativesSection();
initReviewBar();
initPermissionNotice();

onStructureChanged(renderAllSections);
onValueEdited(renderValueDependentParts);
window.addEventListener("beforeunload", warnBeforeLeavingWithUnconfirmedChanges);

reloadConfig({ keepUnconfirmedEdits: false });
setInterval(refreshStatusesUnlessEditing, STATUS_REFRESH_INTERVAL_MS);
