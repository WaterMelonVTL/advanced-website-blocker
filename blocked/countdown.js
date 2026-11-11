// The countdown shown between typing the sentence and the site opening.
import { byId } from "../shared/dom.js";
import { formatClockTime, formatCountdown } from "../shared/format.js";

const TICK_INTERVAL_MS = 250;

let tickTimer = null;

export function startCountdown({ domain, unlock, onFinished }) {
  stopCountdown();
  byId("unlock-window").textContent =
    `Open from ${formatClockTime(unlock.opensAt)} until ${formatClockTime(unlock.closesAt)}.`;

  const tick = () => {
    const remainingMs = unlock.opensAt - Date.now();
    byId("countdown-clock").textContent = formatCountdown(remainingMs);
    document.title = `${formatCountdown(remainingMs)} · ${domain}`;
    if (remainingMs > 0) return;

    stopCountdown();
    onFinished();
  };

  tick();
  tickTimer = setInterval(tick, TICK_INTERVAL_MS);
}

export function stopCountdown() {
  clearInterval(tickTimer);
  tickTimer = null;
}
