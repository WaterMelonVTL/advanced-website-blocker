// The "Go there instead" grid.
import { createElement, byId, setVisible } from "../shared/dom.js";
import { parseUrl } from "../shared/domains.js";

let renderedListSignature = "";

export function renderAlternatives(alternatives) {
  // Re-rendering would reload every icon, so only do it when the list actually changed.
  const listSignature = JSON.stringify(alternatives);
  if (listSignature === renderedListSignature) return;
  renderedListSignature = listSignature;

  const tiles = alternatives.map(createTile).filter(Boolean);
  byId("alternatives-grid").replaceChildren(...tiles);
  setVisible(byId("no-alternatives"), tiles.length === 0);
}

function createTile(alternative) {
  const address = parseUrl(alternative.url);
  if (!address) return null;

  const label = alternative.name || address.hostname.replace(/^www\./, "");
  const icon = createElement("span", { className: "tile-icon", textContent: label.charAt(0).toUpperCase() });
  showSiteIconIfAvailable(icon, address.origin);

  const name = createElement("span", { className: "tile-name", textContent: label });
  return createElement("a", { className: "alternative-tile", href: alternative.url }, icon, name);
}

/** Replaces the letter with the site's own favicon, if it has one. */
function showSiteIconIfAvailable(iconElement, origin) {
  const favicon = new Image();
  favicon.alt = "";
  favicon.onload = () => iconElement.replaceChildren(favicon);
  favicon.src = `${origin}/favicon.ico`;
}
