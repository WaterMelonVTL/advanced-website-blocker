import { SETTING_KEYS } from "../shared/change-plan.js";
import { byId, createButton } from "../shared/dom.js";
import { formatDayAndTime } from "../shared/format.js";
import { editor, notifyStructureChanged, notifyValueEdited } from "./editor.js";

const INPUT_ID_BY_SETTING = Object.freeze({
  waitMinutes: "wait-minutes",
  unlockMinutes: "unlock-minutes",
});

export function initSettingsSection() {
  for (const key of SETTING_KEYS) {
    const input = byId(INPUT_ID_BY_SETTING[key]);
    input.addEventListener("input", () => setDraftSetting(key, input.value));
  }
}

export function renderSettingsSection() {
  SETTING_KEYS.forEach(renderSetting);
}

function setDraftSetting(key, typedValue) {
  const minutes = Math.round(Number(typedValue));
  if (typedValue === "" || !Number.isFinite(minutes)) return;
  editor.draft.settings[key] = minutes;
  notifyValueEdited();
}

function keepConfirmedValue(key) {
  editor.draft.settings[key] = editor.config.settings[key];
  notifyStructureChanged();
}

function renderSetting(key) {
  const inputId = INPUT_ID_BY_SETTING[key];
  const input = byId(inputId);
  const isBeingTypedIn = document.activeElement === input;
  if (!isBeingTypedIn) input.value = editor.draft.settings[key];

  byId(`${inputId}-pending`).replaceChildren(...describePendingSetting(key));
}

/** "10 min is confirmed and takes effect Thu 14:00. Until then: 5 min. [Keep the current value]" */
function describePendingSetting(key) {
  const pendingChange = editor.config.pendingChanges.settings[key];
  const isStillWanted = pendingChange && editor.draft.settings[key] === pendingChange.value;
  if (!isStillWanted) return [];

  const confirmedValue = editor.config.settings[key];
  const explanation = `${pendingChange.value} min is confirmed and takes effect ${formatDayAndTime(pendingChange.applyAt)}. ` +
    `Until then: ${confirmedValue} min. `;
  return [explanation, createButton("Keep the current value", "link", () => keepConfirmedValue(key))];
}
