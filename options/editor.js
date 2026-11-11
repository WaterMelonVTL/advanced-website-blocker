import { askBackground, MESSAGE } from "../shared/browser.js";
import { buildDraft, planChanges } from "../shared/change-plan.js";

/**
 * Shared state of the options page.
 * `config` is what the background has confirmed; `draft` is what the user edits until "Confirm".
 */
export const editor = {
  config: null,
  draft: null,
};

const structureListeners = [];
const valueListeners = [];

export function onStructureChanged(listener) {
  structureListeners.push(listener);
}

export function onValueEdited(listener) {
  valueListeners.push(listener);
}

/** Rows were added or removed: every section re-renders. */
export function notifyStructureChanged() {
  structureListeners.forEach((listener) => listener());
}

/** A value was edited in place: only what depends on values re-renders, so the focused input keeps focus. */
export function notifyValueEdited() {
  valueListeners.forEach((listener) => listener());
}

export function plannedChanges() {
  if (!editor.config || !editor.draft) return [];
  return planChanges(editor.config, editor.draft);
}

export function hasUnconfirmedChanges() {
  return plannedChanges().length > 0;
}

export async function reloadConfig({ keepUnconfirmedEdits }) {
  editor.config = await askBackground(MESSAGE.GET_OVERVIEW);
  if (!keepUnconfirmedEdits || !hasUnconfirmedChanges()) editor.draft = buildDraft(editor.config);
  notifyStructureChanged();
}

export function discardDraft() {
  editor.draft = buildDraft(editor.config);
  notifyStructureChanged();
}
