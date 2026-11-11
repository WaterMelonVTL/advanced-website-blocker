/** Firefox exposes `browser`, Chromium browsers expose `chrome`. Both return promises in Manifest V3. */
export const browserApi = globalThis.browser ?? globalThis.chrome;

/** Every request the pages can send to the background. */
export const MESSAGE = Object.freeze({
  GET_OVERVIEW: "getOverview",
  DESCRIBE_URL: "describeUrl",
  GET_BLOCKED_SITE: "getBlockedSite",
  GET_CHALLENGE: "getChallenge",
  REPLACE_CHALLENGE: "replaceChallenge",
  RECORD_BLOCKED_VISIT: "recordBlockedVisit",
  START_UNLOCK: "startUnlock",
  LOCK_NOW: "lockNow",
  SYNC_BLOCK_RULES: "syncBlockRules",
  BLOCK_SITE_NOW: "blockSiteNow",
  COMMIT_DRAFT: "commitDraft",
  SAVE_ALTERNATIVES: "saveAlternatives",
});

export function askBackground(type, payload = {}) {
  return browserApi.runtime.sendMessage({ type, ...payload });
}
