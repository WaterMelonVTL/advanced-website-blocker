// Shared state of the options page.
//   editor.config: what the background has confirmed (an overview, see background/site-views.js)
//   editor.draft:  what the user is editing; nothing reaches the background until "Confirm"
//
// Sections re-render through two notifications:
//   notifyStructureChanged(): rows were added or removed, so every section re-renders.
//   notifyValueEdited(): a value was edited in place, so only the parts that depend on
//   values re-render, and the input the user is typing in keeps its focus.
import { buildDraft, planChanges } from "../shared/change-plan.js";
import { askBackground, MESSAGE } from "../shared/messages.js";

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

export function notifyStructureChanged() {
  structureListeners.forEach((listener) => listener());
}

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

/** Reloads the confirmed config. Unconfirmed edits are kept unless asked otherwise. */
export async function reloadConfig({ keepUnconfirmedEdits }) {
  editor.config = await askBackground(MESSAGE.GET_OVERVIEW);
  if (!keepUnconfirmedEdits || !hasUnconfirmedChanges()) editor.draft = buildDraft(editor.config);
  notifyStructureChanged();
}

export function discardDraft() {
  editor.draft = buildDraft(editor.config);
  notifyStructureChanged();
}
