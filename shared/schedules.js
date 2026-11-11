// A schedule is { id, days: [0-6], start: "HH:MM", end: "HH:MM" }.
// When end is before start (22:00 → 02:00) the period runs overnight and belongs to the day it starts on.
// When start equals end, the period covers the whole day.
import { DAY_NAMES, MONDAY_FIRST_DAYS } from "./constants.js";

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

function minutesSinceMidnight(timeOfDay) {
  const [hours, minutes] = timeOfDay.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isScheduleActive(schedule, date = new Date()) {
  const start = minutesSinceMidnight(schedule.start);
  const end = minutesSinceMidnight(schedule.end);
  const now = date.getHours() * 60 + date.getMinutes();
  const today = date.getDay();
  const yesterday = (today + 6) % 7;
  const isActiveOn = (day) => schedule.days.includes(day);

  if (start === end) return isActiveOn(today);
  if (start < end) return isActiveOn(today) && now >= start && now < end;

  const isInTonightsPart = isActiveOn(today) && now >= start;
  const isInLastNightsPart = isActiveOn(yesterday) && now < end;
  return isInTonightsPart || isInLastNightsPart;
}

export function isAnyScheduleActive(schedules, date = new Date()) {
  return schedules.some((schedule) => isScheduleActive(schedule, date));
}

/** One flag per minute of the week (Sunday 00:00 is minute 0): 1 when some schedule blocks it. */
function blockedMinutesOfWeek(schedules) {
  const blockedMinutes = new Uint8Array(MINUTES_PER_WEEK);
  for (const schedule of schedules) markBlockedMinutes(blockedMinutes, schedule);
  return blockedMinutes;
}

function markBlockedMinutes(blockedMinutes, schedule) {
  const start = minutesSinceMidnight(schedule.start);
  const endsNextDay = minutesSinceMidnight(schedule.end) <= start;
  const end = minutesSinceMidnight(schedule.end) + (endsNextDay ? MINUTES_PER_DAY : 0);

  for (const day of schedule.days) {
    const dayStart = day * MINUTES_PER_DAY;
    for (let minute = start; minute < end; minute++) {
      blockedMinutes[(dayStart + minute) % MINUTES_PER_WEEK] = 1;
    }
  }
}

/** True when `candidate` blocks every minute that `reference` blocks, i.e. switching to it only adds blocking. */
export function blocksAtLeastAsMuch(candidate, reference) {
  const candidateMinutes = blockedMinutesOfWeek(candidate);
  const referenceMinutes = blockedMinutesOfWeek(reference);
  return referenceMinutes.every((isBlocked, minute) => !isBlocked || candidateMinutes[minute] === 1);
}

/** Compares what the schedules block, ignoring ids and day order. */
export function schedulesAreEqual(first, second) {
  const comparable = (schedules) =>
    JSON.stringify(schedules.map((schedule) => [[...schedule.days].sort(), schedule.start, schedule.end]));
  return comparable(first) === comparable(second);
}

export function describeSchedule(schedule) {
  const dayNames = MONDAY_FIRST_DAYS.filter((day) => schedule.days.includes(day)).map((day) => DAY_NAMES[day]);
  const days = dayNames.join(" ") || "no days";
  return `${days} ${schedule.start}–${schedule.end}`;
}
