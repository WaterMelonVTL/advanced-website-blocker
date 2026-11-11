import { askBackground, MESSAGE } from "../shared/browser.js";
import { byId, createButton, createElement, setVisible } from "../shared/dom.js";
import { parseUrl } from "../shared/domains.js";
import { editor } from "./editor.js";

export function initAlternativesSection() {
  byId("add-alternative-form").addEventListener("submit", addAlternative);
}

export function renderAlternativesSection() {
  const rows = editor.config.alternatives.map(createAlternativeRow);
  byId("alternative-list").replaceChildren(...rows);
}

/** Saved immediately: these never weaken blocking, so no cooldown or confirmation. */
async function saveAlternatives(alternatives) {
  const result = await askBackground(MESSAGE.SAVE_ALTERNATIVES, { alternatives });
  editor.config.alternatives = result.alternatives;
  renderAlternativesSection();
}

function showAddAlternativeError(message) {
  byId("add-alternative-error").textContent = message;
  setVisible(byId("add-alternative-error"), Boolean(message));
}

/** Accepts "moodle.school.edu" as well as a full URL. */
function webAddressFromUserInput(input) {
  const trimmedInput = input.trim();
  const hasScheme = /^https?:\/\//i.test(trimmedInput);
  const address = parseUrl(hasScheme ? trimmedInput : `https://${trimmedInput}`);
  return address?.hostname.includes(".") ? address.href : "";
}

function addAlternative(event) {
  event.preventDefault();
  const url = webAddressFromUserInput(byId("alternative-address").value);
  showAddAlternativeError(url ? "" : "That doesn't look like a valid address.");
  if (!url) return;

  const name = byId("alternative-name").value.trim();
  byId("alternative-name").value = "";
  byId("alternative-address").value = "";
  saveAlternatives([...editor.config.alternatives, { name, url }]);
}

function moveUp(index) {
  const reordered = [...editor.config.alternatives];
  [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
  saveAlternatives(reordered);
}

function remove(index) {
  saveAlternatives(editor.config.alternatives.filter((_, position) => position !== index));
}

function createAlternativeRow(alternative, index) {
  const label = createElement("div", { className: "item-label" },
    createElement("strong", { textContent: alternative.name || new URL(alternative.url).hostname }),
    createElement("span", { className: "item-note small muted", textContent: alternative.url }));

  const moveUpButton = createButton("↑", "", () => moveUp(index));
  moveUpButton.title = "Move up";
  moveUpButton.disabled = index === 0;

  return createElement("li", {}, label, moveUpButton, createButton("Delete", "danger", () => remove(index)));
}
