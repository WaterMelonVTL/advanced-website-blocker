import { attempt } from "./attempt.js";

const URL_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//;
const CREDENTIALS = /^[^@/]*@/;
const PATH_QUERY_OR_HASH = /[/?#]/;
const PORT = /:\d+$/;
const WILDCARD_PREFIX = /^\*\./;
const WWW_PREFIX = /^www\./;
const TRAILING_DOTS = /\.+$/;
const VALID_DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

function hostFromUserInput(input) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(URL_SCHEME, "")
    .replace(CREDENTIALS, "")
    .split(PATH_QUERY_OR_HASH)[0];
}

/** "https://www.YouTube.com/watch?v=1" → "youtube.com". Returns "" when the input isn't a domain. */
export function domainFromUserInput(input) {
  const domain = hostFromUserInput(input)
    .replace(PORT, "")
    .replace(WILDCARD_PREFIX, "")
    .replace(WWW_PREFIX, "")
    .replace(TRAILING_DOTS, "");

  const isValid = VALID_DOMAIN.test(domain) || domain === "localhost";
  return isValid ? domain : "";
}

export function parseUrl(url) {
  const [error, parsedUrl] = attempt(() => new URL(url));
  if (error) return null;
  return parsedUrl;
}

/** Hostname of an http(s) URL, or "" for anything else (about: pages, extension pages...). */
export function webHostnameOf(url) {
  const parsedUrl = parseUrl(url);
  if (!parsedUrl) return "";

  const isWebPage = parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  if (!isWebPage) return "";

  return parsedUrl.hostname.toLowerCase().replace(TRAILING_DOTS, "");
}

export function isSameOrSubdomain(hostname, domain) {
  return hostname === domain || hostname.endsWith("." + domain);
}
