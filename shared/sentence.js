const WORDS = Object.freeze({
  counts: ["Three", "Seven", "Twelve", "Several", "Many", "Two", "Nine", "A few", "Four", "Eleven"],
  adjectives: ["quiet", "orange", "patient", "rusty", "clever", "sleepy", "tiny", "ancient", "silver",
    "curious", "muddy", "gentle", "stubborn", "hollow", "golden", "brave", "dusty", "velvet"],
  subjects: ["otters", "lanterns", "teapots", "pilots", "pebbles", "violins", "beetles", "sailors",
    "radishes", "comets", "llamas", "librarians", "kettles", "pigeons", "umbrellas", "walruses"],
  verbs: ["whisper", "wander", "argue", "dance", "drift", "hum", "tumble", "gossip", "march",
    "glide", "giggle", "wobble", "linger", "stroll"],
  adverbs: ["slowly", "loudly", "nervously", "politely", "quietly", "proudly", "lazily", "eagerly"],
  prepositions: ["beneath", "behind", "beside", "across", "around", "inside", "near", "above"],
  places: ["bridge", "garden", "lighthouse", "bakery", "harbor", "library", "volcano",
    "orchard", "staircase", "train station", "windmill", "cathedral"],
});

function pickRandom(words) {
  const [randomNumber] = crypto.getRandomValues(new Uint32Array(1));
  return words[randomNumber % words.length];
}

/** e.g. "Seven quiet lanterns drift slowly beneath the copper bridge." */
export function generateRandomSentence() {
  return [
    pickRandom(WORDS.counts),
    pickRandom(WORDS.adjectives),
    pickRandom(WORDS.subjects),
    pickRandom(WORDS.verbs),
    pickRandom(WORDS.adverbs),
    pickRandom(WORDS.prepositions),
    "the",
    pickRandom(WORDS.adjectives),
    pickRandom(WORDS.places) + ".",
  ].join(" ");
}

const CURLY_APOSTROPHES = /[‘’]/g;
const RUNS_OF_WHITESPACE = /\s+/g;

function straightenApostrophes(text) {
  return text.replace(CURLY_APOSTROPHES, "'");
}

/** Only whitespace and curly apostrophes are forgiven; every other character must match. */
export function isTypedTextCorrect(typedText, expectedText) {
  const normalize = (text) => straightenApostrophes(String(text)).replace(RUNS_OF_WHITESPACE, " ").trim();
  return normalize(typedText) === normalize(expectedText);
}

/** How many characters from the start of `typedText` match `expectedText`. */
export function countCorrectlyTypedCharacters(typedText, expectedText) {
  const typed = straightenApostrophes(typedText);
  const expected = straightenApostrophes(expectedText);
  let correctCount = 0;
  while (correctCount < typed.length && typed[correctCount] === expected[correctCount]) correctCount++;
  return correctCount;
}
