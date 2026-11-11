export function byId(id) {
  return document.getElementById(id);
}

export function setVisible(element, isVisible) {
  element.classList.toggle("hidden", !isVisible);
}

/** createElement("a", { href, className }, child1, "text", ...) */
export function createElement(tagName, properties = {}, ...children) {
  const element = document.createElement(tagName);
  Object.assign(element, properties);
  element.append(...children);
  return element;
}

export function createButton(label, className, onClick) {
  const button = createElement("button", { type: "button", textContent: label, className });
  button.addEventListener("click", onClick);
  return button;
}

export function byDomain(first, second) {
  return first.domain.localeCompare(second.domain);
}
