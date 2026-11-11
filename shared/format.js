/** 125000 → "2:05" */
export function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** "14:05" in the user's locale. */
export function formatClockTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** "Thu 14:05" in the user's locale. */
export function formatDayAndTime(timestamp) {
  return new Date(timestamp).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

export function pluralize(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
