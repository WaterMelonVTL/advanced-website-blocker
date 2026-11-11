import { DAY_NAMES, MONDAY_FIRST_DAYS } from "./constants.js";

/**
 * @typedef {{ id: string, days: number[], start: string, end: string }} Schedule
 * `days` are 0 (Sunday) to 6. When `end` is before `start` (22:00 → 02:00) the period runs overnight and
 * belongs to the day it starts on. When `start` equals `end` it covers the whole day.
 */

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

/** Yesterday (its overnight period may end today) through a full week ahead. */
const DAY_OFFSETS_TO_CHECK = [-1, 0, 1, 2, 3, 4, 5, 6, 7];

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

/** Local-time timestamp of `minutesAfterMidnight` on the day `dayOffset` days after `referenceDate`. */
function localTimestamp(referenceDate, dayOffset, minutesAfterMidnight) {
  const date = new Date(referenceDate);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(0, minutesAfterMidnight, 0, 0);
  return date.getTime();
}

function periodStartingOnDay(schedule, referenceDate, dayOffset) {
  const start = minutesSinceMidnight(schedule.start);
  const end = minutesSinceMidnight(schedule.end);

  if (start === end) {
    return { startsAt: localTimestamp(referenceDate, dayOffset, 0), endsAt: localTimestamp(referenceDate, dayOffset + 1, 0) };
  }
  const endDayOffset = end < start ? dayOffset + 1 : dayOffset;
  return { startsAt: localTimestamp(referenceDate, dayOffset, start), endsAt: localTimestamp(referenceDate, endDayOffset, end) };
}

function boundariesOfDay(schedules, referenceDate, dayOffset) {
  const weekday = (referenceDate.getDay() + dayOffset + 7) % 7;
  return schedules
    .filter((schedule) => schedule.days.includes(weekday))
    .map((schedule) => periodStartingOnDay(schedule, referenceDate, dayOffset))
    .flatMap(({ startsAt, endsAt }) => [startsAt, endsAt]);
}

/** The next moment after `now` when any of these schedules starts or ends, or null when there is none. */
export function nextScheduleBoundary(schedules, now = Date.now()) {
  const referenceDate = new Date(now);
  const upcomingBoundaries = DAY_OFFSETS_TO_CHECK
    .flatMap((dayOffset) => boundariesOfDay(schedules, referenceDate, dayOffset))
    .filter((boundary) => boundary > now);
  return upcomingBoundaries.length > 0 ? Math.min(...upcomingBoundaries) : null;
}

function blockedMinuteRange(schedule) {
  const start = minutesSinceMidnight(schedule.start);
  const end = minutesSinceMidnight(schedule.end);
  const endsNextDay = end <= start;
  return { start, end: end + (endsNextDay ? MINUTES_PER_DAY : 0) };
}

function markMinutes(blockedMinutes, dayStart, { start, end }) {
  for (let minute = start; minute < end; minute++) {
    blockedMinutes[(dayStart + minute) % MINUTES_PER_WEEK] = 1;
  }
}

/** One flag per minute of the week (Sunday 00:00 is minute 0), set when a schedule blocks that minute. */
function blockedMinutesOfWeek(schedules) {
  const blockedMinutes = new Uint8Array(MINUTES_PER_WEEK);
  for (const schedule of schedules) {
    const range = blockedMinuteRange(schedule);
    schedule.days.forEach((day) => markMinutes(blockedMinutes, day * MINUTES_PER_DAY, range));
  }
  return blockedMinutes;
}

/** True when `candidate` blocks every minute that `reference` blocks: switching to it only adds blocking. */
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
