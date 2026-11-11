// Compares what the user is editing (the draft) with the confirmed configuration and lists the
// changes that "Confirm" would make. Changes that weaken blocking wait for the cooldown.
// The options page uses this to preview, the background uses it to apply, so both always agree.
//
// config: { sites, schedules, settings, pendingChanges: { schedules, settings, siteModes } }
// draft:  { sites: [{ domain, mode, removing }], schedules, settings }
import { BLOCK_MODE } from "./constants.js";
import { blocksAtLeastAsMuch, describeSchedule, schedulesAreEqual } from "./schedules.js";

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
  waitMinutes: (proposed, current) => proposed >= current,   // a longer wait is stricter
  unlockMinutes: (proposed, current) => proposed <= current, // a shorter unlock is stricter
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

// ---------------------------------------------------------------------------
// Where the configuration is heading: confirmed values with pending changes applied
// ---------------------------------------------------------------------------
function upcomingModeOf(site, config) {
  return config.pendingChanges.siteModes[site.domain]?.mode ?? site.mode;
}

function upcomingSchedules(config) {
  return config.pendingChanges.schedules?.schedules ?? config.schedules;
}

function upcomingSettingValue(config, key) {
  return config.pendingChanges.settings[key]?.value ?? config.settings[key];
}

/** The starting point of an edit: the configuration as it will be once pending changes apply. */
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

// ---------------------------------------------------------------------------
// Planning
// Each change: { type, waitsForCooldown, description, ...what it needs to be applied }
// ---------------------------------------------------------------------------
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

function planScheduleChange(config, wantedSchedules) {
  if (schedulesAreEqual(wantedSchedules, upcomingSchedules(config))) return [];

  const isBackToConfirmed = schedulesAreEqual(wantedSchedules, config.schedules);
  const loosensBlocking = !blocksAtLeastAsMuch(wantedSchedules, config.schedules);
  const summary = wantedSchedules.length > 0 ? wantedSchedules.map(describeSchedule).join(", ") : "no periods";

  return [{
    type: CHANGE_TYPE.SET_SCHEDULES,
    schedules: wantedSchedules,
    waitsForCooldown: loosensBlocking,
    description: isBackToConfirmed
      ? "Schedule: keep the current one (cancel the pending change)"
      : `Schedule → ${summary}`,
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
