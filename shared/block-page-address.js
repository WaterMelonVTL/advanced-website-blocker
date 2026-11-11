import { attempt } from "./attempt.js";
import { browserApi } from "./browser.js";
import { BLOCK_PAGE_PATH } from "./constants.js";

export const BLOCK_PAGE_URL = browserApi.runtime.getURL(BLOCK_PAGE_PATH);

/** declarativeNetRequest replaces this with the whole matched URL. */
export const MATCHED_URL_PLACEHOLDER = "\\0";

const ORIGINAL_URL_PARAMETER = "url=";
const OPEN_TAB_FLAG = "tab";
const ENCODED_WEB_ADDRESS = /^https?%3A/i;
const WEB_ADDRESS = /^https?:\/\//i;

/**
 * `blocked.html?domain=<domain>[&tab=1]&url=<original url>`
 * The original URL comes last and unencoded, because that's all a declarativeNetRequest redirect can produce.
 * `isRedirectedOpenTab` marks tabs the extension redirected itself, so they don't count as visits.
 */
export function buildBlockPageAddress(domain, originalUrl, { isRedirectedOpenTab = false } = {}) {
  const openTabFlag = isRedirectedOpenTab ? `&${OPEN_TAB_FLAG}=1` : "";
  return `${BLOCK_PAGE_URL}?domain=${encodeURIComponent(domain)}${openTabFlag}&${ORIGINAL_URL_PARAMETER}${originalUrl}`;
}

/** Everything after "url=" is the original URL, including its own `?` and `&`. */
export function parseBlockPageAddress(search) {
  const originalUrlStart = search.indexOf(ORIGINAL_URL_PARAMETER);
  const hasOriginalUrl = originalUrlStart > 0;
  const otherParameters = new URLSearchParams(hasOriginalUrl ? search.slice(0, originalUrlStart) : search);
  const rawOriginalUrl = hasOriginalUrl ? search.slice(originalUrlStart + ORIGINAL_URL_PARAMETER.length) : "";

  return {
    domain: otherParameters.get("domain") ?? "",
    isRedirectedOpenTab: otherParameters.has(OPEN_TAB_FLAG),
    originalUrl: decodeIfEncoded(rawOriginalUrl),
  };
}

function decodeIfEncoded(url) {
  if (!ENCODED_WEB_ADDRESS.test(url)) return url;
  const [error, decodedUrl] = attempt(() => decodeURIComponent(url));
  if (error) return url;
  return decodedUrl;
}

export function isBlockPageAddress(url) {
  return url.startsWith(BLOCK_PAGE_URL);
}

export function isWebAddress(url) {
  return WEB_ADDRESS.test(url);
}
