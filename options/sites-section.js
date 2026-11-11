import { UNLOCK_PHASE } from "../shared/constants.js";
import { byDomain, byId, createButton, createElement, setVisible } from "../shared/dom.js";
import { domainFromUserInput } from "../shared/domains.js";
import { formatClockTime, formatDayAndTime, pluralize } from "../shared/format.js";
import { editor, notifyStructureChanged } from "./editor.js";

export function initSitesSection() {
  byId("add-site-form").addEventListener("submit", addSiteToDraft);
}

export function renderSitesSection() {
  const confirmedSitesByDomain = new Map(editor.config.sites.map((site) => [site.domain, site]));
  const draftSites = [...editor.draft.sites].sort(byDomain);

  setVisible(byId("no-sites"), draftSites.length === 0);
  const rows = draftSites.map((draftSite) => createSiteRow(draftSite, confirmedSitesByDomain.get(draftSite.domain)));
  byId("site-list").replaceChildren(...rows);
}

function showAddSiteError(message) {
  byId("add-site-error").textContent = message;
  setVisible(byId("add-site-error"), Boolean(message));
}

function addSiteToDraft(event) {
  event.preventDefault();
  const domain = domainFromUserInput(byId("new-site-domain").value);
  showAddSiteError(domain ? "" : "That doesn't look like a valid domain.");
  if (!domain) return;

  const siteAlreadyInDraft = editor.draft.sites.find((site) => site.domain === domain);
  if (siteAlreadyInDraft) siteAlreadyInDraft.removing = false;
  else editor.draft.sites.push({ domain, mode: byId("new-site-mode").value, removing: false });

  byId("new-site-domain").value = "";
  notifyStructureChanged();
}

function dropFromDraft(draftSite) {
  editor.draft.sites = editor.draft.sites.filter((site) => site !== draftSite);
  notifyStructureChanged();
}

function setRemoving(draftSite, removing) {
  draftSite.removing = removing;
  notifyStructureChanged();
}

function setMode(draftSite, mode) {
  draftSite.mode = mode;
  notifyStructureChanged();
}

/** `confirmedSite` is undefined for a site that was added but not confirmed yet. */
function createSiteRow(draftSite, confirmedSite) {
  return createElement("li", {},
    createSiteLabel(draftSite, confirmedSite),
    createModeSelect(draftSite),
    createSiteActionButton(draftSite, confirmedSite));
}

function createSiteLabel(draftSite, confirmedSite) {
  const label = createElement("div", { className: "item-label" },
    createElement("strong", { textContent: draftSite.domain }),
    createStatusPill(draftSite, confirmedSite));

  const pendingSwitchNote = describePendingModeSwitch(draftSite, confirmedSite);
  if (pendingSwitchNote) {
    label.append(createElement("span", { className: "item-note small pending-note", textContent: pendingSwitchNote }));
  }
  const visitsNote = describeVisitsToday(confirmedSite);
  if (visitsNote) {
    label.append(createElement("span", { className: "item-note small muted", textContent: visitsNote }));
  }
  return label;
}

function createStatusPill(draftSite, confirmedSite) {
  const { text, variant } = describeStatus(draftSite, confirmedSite);
  return createElement("span", { className: `pill ${variant}`, textContent: text });
}

function describeStatus(draftSite, confirmedSite) {
  if (!confirmedSite) return { text: "New, not confirmed", variant: "draft" };

  const isRemovalConfirmed = Boolean(confirmedSite.removeAt);
  if (draftSite.removing && !isRemovalConfirmed) return { text: "Remove (not confirmed)", variant: "draft" };
  if (draftSite.removing) return { text: `Leaves list ${formatDayAndTime(confirmedSite.removeAt)}`, variant: "removing" };

  const { unlock } = confirmedSite;
  if (unlock.phase === UNLOCK_PHASE.OPEN) return { text: `Unlocked until ${formatClockTime(unlock.closesAt)}`, variant: "open" };
  if (unlock.phase === UNLOCK_PHASE.WAITING) return { text: `Unlocks at ${formatClockTime(unlock.opensAt)}`, variant: "" };
  if (confirmedSite.blockedNow) return { text: "Blocked now", variant: "blocked" };
  return { text: "Outside schedule", variant: "" };
}

function describePendingModeSwitch(draftSite, confirmedSite) {
  const modeSwitch = confirmedSite?.pendingModeSwitch;
  const isStillWanted = modeSwitch && draftSite.mode === modeSwitch.mode;
  if (!isStillWanted) return "";
  return `Switches to "On schedule" on ${formatDayAndTime(modeSwitch.applyAt)}`;
}

function describeVisitsToday(confirmedSite) {
  const visits = confirmedSite?.blockedVisitsToday ?? 0;
  return visits > 0 ? `Blocked ${pluralize(visits, "time")} today` : "";
}

function createModeSelect(draftSite) {
  const select = createElement("select", { ariaLabel: `When to block ${draftSite.domain}`, disabled: draftSite.removing },
    createElement("option", { value: "always", textContent: "Always" }),
    createElement("option", { value: "schedule", textContent: "On schedule" }));
  select.value = draftSite.mode;
  select.addEventListener("change", () => setMode(draftSite, select.value));
  return select;
}

function createSiteActionButton(draftSite, confirmedSite) {
  if (!confirmedSite) return createButton("Undo", "", () => dropFromDraft(draftSite));
  if (draftSite.removing) return createButton("Keep it", "", () => setRemoving(draftSite, false));
  return createButton("Remove", "danger", () => setRemoving(draftSite, true));
}
