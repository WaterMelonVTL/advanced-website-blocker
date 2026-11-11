import { BLOCK_MODE } from "./constants.js";
import { blocksAtLeastAsMuch, describeSchedule, schedulesAreEqual } from "./schedules.js";

/**
 * Compares a draft (what the user is editing) with the confirmed config and lists what "Confirm" changes.
 * The options page uses it to preview and the background to apply, so both always agree.
 *
 * @typedef {{ sites: object[], schedules: object[], settings: object, pendingChanges: object }} Config
 * @typedef {{ sites: { domain: string, mode: string, removing: boolean }[], schedules: object[], settings: object }} Draft
 * @typedef {{ type: string, waitsForCooldown: boolean, description: string }} Change
 */

export const CHANGE_TYPE = Object.freeze({
  ADD_SITE: "addSite",
  SET_MODE: "setMode",
  CANCEL_MODE_SWITCH: "cancelModeSwitch",
  SCHEDULE_REMOVAL: "scheduleRemoval",
  CANCEL_REMOVAL: "cancelRemoval",
  SET_SCHEDULES: "setSchedules",
  SET_SETTING: "setSetting",
});

const IS_STRICTER_SETTING = Object.freeze({
  waitMinutes: (proposed, current) => proposed >= current,
  unlockMinutes: (proposed, current) => proposed <= current,
});

export const SETTING_KEYS = Object.freeze(Object.keys(IS_STRICTER_SETTING));

const SETTING_LABELS = Object.freeze({
  waitMinutes: "Wait before unlocking",
  unlockMinutes: "Unlock duration",
});

const MODE_LABELS = Object.freeze({
  [BLOCK_MODE.ALWAYS]: "Always",
  [BLOCK_MODE.ON_SCHEDULE]: "On schedule",
});

function upcomingModeOf(site, config) {
  return config.pendingChanges.siteModes[site.domain]?.mode ?? site.mode;
}

function upcomingSchedules(config) {
  return config.pendingChanges.schedules?.schedules ?? config.schedules;
}

function upcomingSettingValue(config, key) {
  return config.pendingChanges.settings[key]?.value ?? config.settings[key];
}

/** The starting point of an edit: the config as it will be once pending changes apply. */
export function buildDraft(config) {
  return {
    sites: config.sites.map((site) => ({
      domain: site.domain,
      mode: upcomingModeOf(site, config),
      removing: Boolean(site.removeAt),
    })),
    schedules: structuredClone(upcomingSchedules(config)),
    settings: Object.fromEntries(SETTING_KEYS.map((key) => [key, upcomingSettingValue(config, key)])),
  };
}

/** @returns {Change[]} */
export function planChanges(config, draft) {
  return [
    ...draft.sites.flatMap((draftSite) => planSiteChanges(config, draftSite)),
    ...planScheduleChange(config, draft.schedules),
    ...SETTING_KEYS.flatMap((key) => planSettingChange(config, key, draft.settings[key])),
  ];
}

function planSiteChanges(config, draftSite) {
  const confirmedSite = config.sites.find((site) => site.domain === draftSite.domain);
  if (!confirmedSite) return draftSite.removing ? [] : [planNewSite(draftSite)];

  return [
    ...planModeChange(config, confirmedSite, draftSite.mode),
    ...planRemovalChange(confirmedSite, draftSite.removing),
  ];
}

function planNewSite({ domain, mode }) {
  return {
    type: CHANGE_TYPE.ADD_SITE,
    domain,
    mode,
    waitsForCooldown: false,
    description: `Block ${domain} (${MODE_LABELS[mode]})`,
  };
}

function planModeChange(config, confirmedSite, wantedMode) {
  const { domain } = confirmedSite;
  if (wantedMode === upcomingModeOf(confirmedSite, config)) return [];

  if (wantedMode === confirmedSite.mode) {
    return [{
      type: CHANGE_TYPE.CANCEL_MODE_SWITCH,
      domain,
      waitsForCooldown: false,
      description: `${domain}: keep "${MODE_LABELS[confirmedSite.mode]}" (cancel the pending switch)`,
    }];
  }

  const loosensBlocking = wantedMode === BLOCK_MODE.ON_SCHEDULE;
  return [{
    type: CHANGE_TYPE.SET_MODE,
    domain,
    mode: wantedMode,
    waitsForCooldown: loosensBlocking,
    description: loosensBlocking ? `${domain}: only block on schedule` : `${domain}: block always`,
  }];
}

function planRemovalChange(confirmedSite, wantsRemoval) {
  const { domain } = confirmedSite;
  const isRemovalScheduled = Boolean(confirmedSite.removeAt);

  if (wantsRemoval && !isRemovalScheduled) {
    return [{
      type: CHANGE_TYPE.SCHEDULE_REMOVAL,
      domain,
      waitsForCooldown: true,
      description: `Remove ${domain} from the list`,
    }];
  }
  if (!wantsRemoval && isRemovalScheduled) {
    return [{
      type: CHANGE_TYPE.CANCEL_REMOVAL,
      domain,
      waitsForCooldown: false,
      description: `Keep ${domain} (cancel its removal)`,
    }];
  }
  return [];
}

function describeScheduleChange(config, wantedSchedules) {
  const isBackToConfirmed = schedulesAreEqual(wantedSchedules, config.schedules);
  if (isBackToConfirmed) return "Schedule: keep the current one (cancel the pending change)";

  const summary = wantedSchedules.length > 0 ? wantedSchedules.map(describeSchedule).join(", ") : "no periods";
  return `Schedule → ${summary}`;
}

function planScheduleChange(config, wantedSchedules) {
  if (schedulesAreEqual(wantedSchedules, upcomingSchedules(config))) return [];

  return [{
    type: CHANGE_TYPE.SET_SCHEDULES,
    schedules: wantedSchedules,
    waitsForCooldown: !blocksAtLeastAsMuch(wantedSchedules, config.schedules),
    description: describeScheduleChange(config, wantedSchedules),
  }];
}

function planSettingChange(config, key, wantedValue) {
  if (wantedValue === upcomingSettingValue(config, key)) return [];

  const isStricter = IS_STRICTER_SETTING[key](wantedValue, config.settings[key]);
  return [{
    type: CHANGE_TYPE.SET_SETTING,
    key,
    value: wantedValue,
    waitsForCooldown: !isStricter,
    description: `${SETTING_LABELS[key]}: ${wantedValue} min`,
  }];
}
