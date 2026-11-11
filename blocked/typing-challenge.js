// The "type this sentence to unlock" form.
import { createElement, byId, setVisible } from "../shared/dom.js";
import { pluralize } from "../shared/format.js";
import { askBackground, MESSAGE } from "../shared/messages.js";
import { countCorrectlyTypedCharacters, isTypedTextCorrect } from "../shared/sentence.js";

const typedTextInput = byId("typed-text");
const expectedTextElement = byId("expected-text");
const startCountdownButton = byId("start-countdown");

const challenge = {
  domain: "",
  expectedText: "",
  onUnlockStarted: (_unlock) => {},
};

/** Input types that would bypass typing: pasting, dropping text, autocorrect replacements. */
const NON_TYPED_INPUT_TYPES = new Set(["insertFromPaste", "insertFromDrop", "insertReplacementText"]);

export function initTypingChallenge({ domain, onUnlockStarted }) {
  challenge.domain = domain;
  challenge.onUnlockStarted = onUnlockStarted;

  allowOnlyTyping(typedTextInput);
  typedTextInput.addEventListener("input", renderTypingProgress);
  typedTextInput.addEventListener("keydown", submitOnEnter);
  startCountdownButton.addEventListener("click", submitTypedText);
}

export async function prepareTypingChallenge(settings) {
  byId("wait-duration").textContent = pluralize(settings.waitMinutes, "minute");
  byId("unlock-duration").textContent = pluralize(settings.unlockMinutes, "minute");

  const { expectedText } = await askBackground(MESSAGE.GET_CHALLENGE, { domain: challenge.domain });
  challenge.expectedText = expectedText;
  renderTypingProgress();
}

function allowOnlyTyping(input) {
  const cancel = (event) => event.preventDefault();
  input.addEventListener("paste", cancel);
  input.addEventListener("drop", cancel);
  input.addEventListener("beforeinput", (event) => {
    if (NON_TYPED_INPUT_TYPES.has(event.inputType)) event.preventDefault();
  });
}

function renderTypingProgress() {
  const typedText = typedTextInput.value;
  const correctCount = countCorrectlyTypedCharacters(typedText, challenge.expectedText);
  const hasTypo = correctCount < typedText.length;
  const isComplete = isTypedTextCorrect(typedText, challenge.expectedText);

  renderExpectedText(correctCount, hasTypo);
  startCountdownButton.disabled = !isComplete;
  byId("typing-status").textContent = describeTypingProgress({ correctCount, hasTypo, isComplete });
}

/** Colors the expected text: typed part in green, the first typo in red, the rest grey. */
function renderExpectedText(correctCount, hasTypo) {
  const text = challenge.expectedText;
  const typoLength = hasTypo ? 1 : 0;
  const parts = [
    ["typed-correctly", text.slice(0, correctCount)],
    ["first-typo", hasTypo ? (text.charAt(correctCount) || " ") : ""],
    ["not-yet-typed", text.slice(correctCount + typoLength)],
  ];
  const spans = parts
    .filter(([, partText]) => partText.length > 0)
    .map(([className, partText]) => createElement("span", { className, textContent: partText }));
  expectedTextElement.replaceChildren(...spans);
}

function describeTypingProgress({ correctCount, hasTypo, isComplete }) {
  if (isComplete) return "Looks right.";
  if (hasTypo) return `Typo at character ${correctCount + 1}.`;
  const percentTyped = Math.round((correctCount / challenge.expectedText.length) * 100);
  return `${percentTyped}% typed`;
}

function submitOnEnter(event) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  if (!startCountdownButton.disabled) submitTypedText();
}

function showTypingError(message) {
  byId("typing-error").textContent = message;
  setVisible(byId("typing-error"), Boolean(message));
}

async function submitTypedText() {
  startCountdownButton.disabled = true;
  const result = await askBackground(MESSAGE.START_UNLOCK, {
    domain: challenge.domain,
    typedText: typedTextInput.value,
  });

  if (!result.ok) {
    showTypingError(result.error);
    renderTypingProgress();
    return;
  }

  showTypingError("");
  typedTextInput.value = "";
  challenge.onUnlockStarted(result.unlock);
}
