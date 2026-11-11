import { isWebAddress } from "../shared/block-page-address.js";
import { saveState, state } from "./state.js";

const MAX_NAME_LENGTH = 40;

function sanitizeAlternative(alternative) {
  return {
    name: String(alternative.name ?? "").trim().slice(0, MAX_NAME_LENGTH),
    url: String(alternative.url ?? "").trim(),
  };
}

/** "Go there instead" sites never weaken blocking, so they save immediately, without a cooldown. */
export async function saveAlternatives(alternatives) {
  state.alternatives = (alternatives ?? [])
    .map(sanitizeAlternative)
    .filter((alternative) => isWebAddress(alternative.url));
  await saveState("alternatives");
  return { ok: true, alternatives: state.alternatives };
}
