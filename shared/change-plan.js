import { BLOCK_MODE, BLOCK_MODE_LABELS, BLOCK_MODE_STRICTNESS } from "./constants.js";
import { findParentSite } from "./domains.js";
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
  REMOVE_SITE: "removeSite",
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

const MODE_SWITCH_DESCRIPTIONS = Object.freeze({
  [BLOCK_MODE.ALWAYS]: "block always",
  [BLOCK_MODE.ON_SCHEDULE]: "only block on schedule",
  [BLOCK_MODE.NEVER]: "never block (allow)",
});

function weakensBlocking(wantedMode, currentMode) {
  return BLOCK_MODE_STRICTNESS[wantedMode] < BLOCK_MODE_STRICTNESS[currentMode];
}

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
  if (!confirmedSite) return draftSite.removing ? [] : [planNewSite(config, draftSite)];

  return [
    ...planModeChange(config, confirmedSite, draftSite.mode),
    ...planRemovalChange(confirmedSite, draftSite.removing),
  ];
}

function planNewSite(config, draftSite) {
  if (draftSite.mode === BLOCK_MODE.NEVER) return planNewAllowedSite(config, draftSite);
  return {
    type: CHANGE_TYPE.ADD_SITE,
    domain: draftSite.domain,
    mode: draftSite.mode,
    waitsForCooldown: false,
    description: `Block ${draftSite.domain} (${BLOCK_MODE_LABELS[draftSite.mode]})`,
  };
}

/**
 * Allowing a subdomain of a blocked site weakens blocking: until the cooldown ends, the new site
 * keeps its parent's mode (`modeDuringCooldown`).
 */
function planNewAllowedSite(config, { domain, mode }) {
  const parentSite = findParentSite(config.sites, domain);
  const isException = Boolean(parentSite) && parentSite.mode !== BLOCK_MODE.NEVER;
  return {
    type: CHANGE_TYPE.ADD_SITE,
    domain,
    mode,
    modeDuringCooldown: parentSite?.mode,
    waitsForCooldown: isException,
    description: isException ? `Allow ${domain} (exception to ${parentSite.domain})` : `Allow ${domain}`,
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
      description: `${domain}: keep "${BLOCK_MODE_LABELS[confirmedSite.mode]}" (cancel the pending switch)`,
    }];
  }

  return [{
    type: CHANGE_TYPE.SET_MODE,
    domain,
    mode: wantedMode,
    waitsForCooldown: weakensBlocking(wantedMode, confirmedSite.mode),
    description: `${domain}: ${MODE_SWITCH_DESCRIPTIONS[wantedMode]}`,
  }];
}

/** Removing an allowed site only makes blocking stricter, so it applies right away. */
function planRemovalChange(confirmedSite, wantsRemoval) {
  const { domain } = confirmedSite;
  const isRemovalScheduled = Boolean(confirmedSite.removeAt);

  if (wantsRemoval && !isRemovalScheduled) {
    return [{
      type: CHANGE_TYPE.REMOVE_SITE,
      domain,
      waitsForCooldown: confirmedSite.mode !== BLOCK_MODE.NEVER,
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
