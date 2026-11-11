import { browserApi } from "../shared/browser.js";
import { BLOCK_MODE } from "../shared/constants.js";
import { nextScheduleBoundary } from "../shared/schedules.js";
import { state } from "./state.js";

/**
 * No polling: the background sleeps until the next moment something can change (a schedule period
 * starting or ending, an unlock opening or closing, a cooldown or removal becoming due) and sets one
 * alarm for exactly that moment.
 */
const NEXT_CHANGE_ALARM = "next-change";

/** Fires just after the moment rather than just before it. */
const ALARM_MARGIN_MS = 250;

/** Catches a planned moment that was missed, e.g. when the system clock or time zone changes. */
const SAFETY_CHECK_ALARM = "safety-check";
const SAFETY_CHECK_PERIOD_MINUTES = 30;

/** The 30-second polling alarm of version 2.0. */
const LEGACY_POLLING_ALARM = "housekeeping";

function pendingChangeTimes() {
  const { schedules, settings, siteModes } = state.pendingChanges;
  return [
    schedules?.applyAt,
    ...Object.values(settings).map((change) => change.applyAt),
    ...Object.values(siteModes).map((change) => change.applyAt),
  ];
}

function removalTimes() {
  return state.sites.map((site) => site.removeAt);
}

function unlockTimes() {
  return Object.values(state.unlocks).flatMap((unlock) => [unlock.opensAt, unlock.closesAt]);
}

function isAnySiteOnSchedule() {
  const isOnScheduleNow = state.sites.some((site) => site.mode === BLOCK_MODE.ON_SCHEDULE);
  const isSwitchingToSchedule = Object.values(state.pendingChanges.siteModes)
    .some((change) => change.mode === BLOCK_MODE.ON_SCHEDULE);
  return isOnScheduleNow || isSwitchingToSchedule;
}

function scheduleBoundaryTimes(now) {
  if (!isAnySiteOnSchedule()) return [];
  const pendingSchedules = state.pendingChanges.schedules?.schedules ?? [];
  return [nextScheduleBoundary(state.schedules, now), nextScheduleBoundary(pendingSchedules, now)];
}

export function nextWakeUpTime(now = Date.now()) {
  const upcomingTimes = [
    ...pendingChangeTimes(),
    ...removalTimes(),
    ...unlockTimes(),
    ...scheduleBoundaryTimes(now),
  ].filter((time) => typeof time === "number" && time > now);
  return upcomingTimes.length > 0 ? Math.min(...upcomingTimes) : null;
}

/** Replaces the previous wake-up with the next one, or clears it when nothing is coming up. */
export async function scheduleNextWakeUp() {
  const wakeUpAt = nextWakeUpTime();
  if (wakeUpAt === null) {
    await browserApi.alarms.clear(NEXT_CHANGE_ALARM);
    return;
  }
  browserApi.alarms.create(NEXT_CHANGE_ALARM, { when: wakeUpAt + ALARM_MARGIN_MS });
}

/** Re-creating an alarm resets its timer, so the safety check is only created when missing. */
export async function setUpSafetyCheck() {
  await browserApi.alarms.clear(LEGACY_POLLING_ALARM);
  const existingAlarm = await browserApi.alarms.get(SAFETY_CHECK_ALARM);
  if (existingAlarm) return;
  browserApi.alarms.create(SAFETY_CHECK_ALARM, { periodInMinutes: SAFETY_CHECK_PERIOD_MINUTES });
}
