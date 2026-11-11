import { DAY_NAMES, MONDAY_FIRST_DAYS } from "../shared/constants.js";
import { byId, createButton, createElement, setVisible } from "../shared/dom.js";
import { formatDayAndTime } from "../shared/format.js";
import { editor, notifyStructureChanged, notifyValueEdited } from "./editor.js";

const NEW_PERIOD = Object.freeze({ days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" });

export function initSchedulesSection() {
  byId("add-schedule").addEventListener("click", addPeriod);
  byId("revert-schedule").addEventListener("click", revertToConfirmedSchedule);
}

export function renderSchedulesSection() {
  renderPendingScheduleNotice();
  const schedules = editor.draft.schedules;
  setVisible(byId("no-schedules"), schedules.length === 0);
  byId("schedule-list").replaceChildren(...schedules.map(createScheduleRow));
}

function addPeriod() {
  editor.draft.schedules.push({ id: crypto.randomUUID(), ...structuredClone(NEW_PERIOD) });
  notifyStructureChanged();
}

function deletePeriod(schedule) {
  editor.draft.schedules = editor.draft.schedules.filter((existing) => existing !== schedule);
  notifyStructureChanged();
}

function revertToConfirmedSchedule() {
  editor.draft.schedules = structuredClone(editor.config.schedules);
  notifyStructureChanged();
}

function setDayIncluded(schedule, day, isIncluded) {
  schedule.days = isIncluded ? [...schedule.days, day] : schedule.days.filter((existingDay) => existingDay !== day);
  notifyValueEdited();
}

function setTime(schedule, field, timeOfDay) {
  if (!timeOfDay) return;
  schedule[field] = timeOfDay;
  notifyValueEdited();
}

function renderPendingScheduleNotice() {
  const pendingSchedules = editor.config.pendingChanges.schedules;
  setVisible(byId("pending-schedule-notice"), Boolean(pendingSchedules));
  if (pendingSchedules) byId("pending-schedule-date").textContent = formatDayAndTime(pendingSchedules.applyAt);
}

function createScheduleRow(schedule) {
  return createElement("div", { className: "schedule" },
    createDayToggles(schedule),
    createTimeRange(schedule),
    createElement("span", { className: "spacer" }),
    createButton("Delete", "danger", () => deletePeriod(schedule)));
}

function createDayToggles(schedule) {
  const toggles = MONDAY_FIRST_DAYS.map((day) => createDayToggle(schedule, day));
  return createElement("div", { className: "day-toggles" }, ...toggles);
}

function createDayToggle(schedule, day) {
  const checkbox = createElement("input", { type: "checkbox", checked: schedule.days.includes(day) });
  checkbox.addEventListener("change", () => setDayIncluded(schedule, day, checkbox.checked));
  return createElement("label", {}, checkbox, DAY_NAMES[day]);
}

function createTimeRange(schedule) {
  return createElement("div", { className: "time-range" },
    createTimeInput(schedule, "start", "Start time"),
    "→",
    createTimeInput(schedule, "end", "End time"));
}

function createTimeInput(schedule, field, label) {
  const input = createElement("input", { type: "time", value: schedule[field], ariaLabel: label });
  input.addEventListener("change", () => setTime(schedule, field, input.value));
  return input;
}
