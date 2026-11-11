// The bar at the bottom listing unconfirmed changes, with "Discard" and "Confirm".
import { byId, createElement, setVisible } from "../shared/dom.js";
import { askBackground, MESSAGE } from "../shared/messages.js";
import { discardDraft, editor, plannedChanges, reloadConfig } from "./editor.js";

export function initReviewBar() {
  byId("discard-draft").addEventListener("click", discardDraft);
  byId("confirm-draft").addEventListener("click", confirmDraft);
}

export function renderReviewBar() {
  const changes = plannedChanges();
  const hasChanges = changes.length > 0;
  setVisible(byId("review-bar"), hasChanges);
  document.body.classList.toggle("has-review-bar", hasChanges);

  renderChangeGroup("immediate", changes.filter((change) => !change.waitsForCooldown));
  renderChangeGroup("after-cooldown", changes.filter((change) => change.waitsForCooldown));
}

function renderChangeGroup(groupName, changes) {
  setVisible(byId(`${groupName}-changes`), changes.length > 0);
  const items = changes.map((change) => createElement("li", { textContent: change.description }));
  byId(`${groupName}-change-list`).replaceChildren(...items);
}

async function confirmDraft() {
  const confirmButton = byId("confirm-draft");
  confirmButton.disabled = true;
  try {
    await askBackground(MESSAGE.COMMIT_DRAFT, { draft: editor.draft });
    await reloadConfig({ keepUnconfirmedEdits: false });
  } finally {
    confirmButton.disabled = false;
  }
}
