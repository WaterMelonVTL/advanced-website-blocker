import { findSiteByDomain, saveState, state } from "./state.js";

/** "2026-11-11" in local time, so the count resets at local midnight. */
function localDateKey(date = new Date()) {
  const twoDigits = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}

/** Counts one more time the block page was shown for this site today. */
export async function recordBlockedVisit(domain) {
  if (!findSiteByDomain(domain)) return;

  const today = localDateKey();
  if (state.blockCounts.date !== today) state.blockCounts = { date: today, countsByDomain: {} };

  const counts = state.blockCounts.countsByDomain;
  counts[domain] = (counts[domain] ?? 0) + 1;
  await saveState("blockCounts");
}

export function blockedVisitsToday(domain) {
  const isFromToday = state.blockCounts.date === localDateKey();
  return isFromToday ? (state.blockCounts.countsByDomain[domain] ?? 0) : 0;
}
