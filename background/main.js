// Entry point of the background (a service worker in Chrome/Brave/Edge, an event page in Firefox).
// Listeners are registered at the top level so the browser can wake the background for them.
import { browserApi } from "../shared/browser.js";
import { ensureHousekeepingAlarm, runHousekeeping } from "./housekeeping.js";
import { handleMessage } from "./messages.js";

/** Chrome ignores promises returned by onMessage listeners; sendResponse + `return true` works everywhere. */
function answerAsynchronously(handler) {
  return (message, _sender, sendResponse) => {
    const reportError = (error) => sendResponse({ ok: false, error: String(error?.message ?? error) });
    handler(message).then(sendResponse, reportError);
    return true;
  };
}

function onBrowserStart() {
  ensureHousekeepingAlarm();
  runHousekeeping();
}

browserApi.runtime.onMessage.addListener(answerAsynchronously(handleMessage));
browserApi.alarms.onAlarm.addListener(() => runHousekeeping()); // housekeeping and unlock alarms alike
browserApi.runtime.onStartup.addListener(onBrowserStart);
browserApi.runtime.onInstalled.addListener(onBrowserStart);
ensureHousekeepingAlarm();
