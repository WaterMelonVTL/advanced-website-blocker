import { browserApi } from "../shared/browser.js";
import { runHousekeeping } from "./housekeeping.js";
import { handleMessage } from "./messages.js";
import { setUpSafetyCheck } from "./wake-up.js";

/** Chrome ignores promises returned by onMessage listeners; `sendResponse` + `return true` works everywhere. */
function answerAsynchronously(handler) {
  return (message, _sender, sendResponse) => {
    const reportError = (error) => sendResponse({ ok: false, error: String(error?.message ?? error) });
    handler(message).then(sendResponse, reportError);
    return true;
  };
}

function onBrowserStart() {
  setUpSafetyCheck();
  runHousekeeping();
}

browserApi.runtime.onMessage.addListener(answerAsynchronously(handleMessage));
browserApi.alarms.onAlarm.addListener(() => runHousekeeping());
browserApi.runtime.onStartup.addListener(onBrowserStart);
browserApi.runtime.onInstalled.addListener(onBrowserStart);
