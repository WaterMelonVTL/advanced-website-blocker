/** Firefox exposes `browser`, Chrome/Brave/Edge expose `chrome`. Both return promises in Manifest V3. */
export const browserApi = globalThis.browser ?? globalThis.chrome;
