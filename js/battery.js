import { BATTERY_INPUT_TYPES, INPUT_MODES, LED_BEHAVIORS } from "./constants.js";

export class Battery {
  constructor(data = {}) {
    const now = new Date().toISOString();
    this.id = data.id ?? crypto.randomUUID();
    this.name = data.name ?? "";
    this.inputType = data.inputType ?? BATTERY_INPUT_TYPES.PERCENTAGE;
    this.preferredInputMode = data.preferredInputMode ?? getPreferredInputModeFromInputType(this.inputType);
    this.availableInputModes = data.availableInputModes ?? getAvailableInputModesFromInputType(this.inputType);
    this.ledConfig = data.ledConfig ?? getDefaultLedConfigFromInputType(this.inputType);
    this.archived = data.archived ?? false;
    this.notes = data.notes ?? "";
    this.createdAt = data.createdAt ?? now;
    this.updatedAt = data.updatedAt ?? now;
  }
}

export function createBattery(data = {}) { return new Battery(normalizeBatteryInput(data)); }
export function updateBattery(existingBattery, updates = {}) {
  return new Battery({ ...existingBattery, ...normalizeBatteryInput(updates), id: existingBattery.id, createdAt: existingBattery.createdAt, updatedAt: new Date().toISOString() });
}
export function archiveBattery(battery) { return updateBattery(battery, { archived: true }); }
export function restoreBattery(battery) { return updateBattery(battery, { archived: false }); }

export function normalizeBatteryInput(data = {}) {
  const inputType = data.inputType ?? getInputTypeFromLegacyFields(data);
  const preferredInputMode = getPreferredInputModeFromInputType(inputType);
  const availableInputModes = getAvailableInputModesFromInputType(inputType);
  let ledConfig = null;
  if (inputType === BATTERY_INPUT_TYPES.LED_SIMPLE || inputType === BATTERY_INPUT_TYPES.LED_ADVANCED) {
    ledConfig = {
      ledCount: Number(data.ledConfig?.ledCount ?? data.ledCount ?? 4),
      behavior: inputType === BATTERY_INPUT_TYPES.LED_ADVANCED ? LED_BEHAVIORS.ADVANCED : LED_BEHAVIORS.SIMPLE
    };
  }
  return { ...data, name: String(data.name ?? "").trim(), inputType, preferredInputMode, availableInputModes, ledConfig };
}

function getInputTypeFromLegacyFields(data) {
  if (data.preferredInputMode === INPUT_MODES.LED || data.ledConfig) {
    return data.ledConfig?.behavior === LED_BEHAVIORS.ADVANCED ? BATTERY_INPUT_TYPES.LED_ADVANCED : BATTERY_INPUT_TYPES.LED_SIMPLE;
  }
  return BATTERY_INPUT_TYPES.PERCENTAGE;
}
function getPreferredInputModeFromInputType(inputType) { return inputType === BATTERY_INPUT_TYPES.PERCENTAGE ? INPUT_MODES.PERCENTAGE : INPUT_MODES.LED; }
function getAvailableInputModesFromInputType(inputType) { return inputType === BATTERY_INPUT_TYPES.PERCENTAGE ? [INPUT_MODES.PERCENTAGE, INPUT_MODES.LED] : [INPUT_MODES.LED, INPUT_MODES.PERCENTAGE]; }
function getDefaultLedConfigFromInputType(inputType) {
  if (inputType === BATTERY_INPUT_TYPES.LED_SIMPLE) return { ledCount: 4, behavior: LED_BEHAVIORS.SIMPLE };
  if (inputType === BATTERY_INPUT_TYPES.LED_ADVANCED) return { ledCount: 4, behavior: LED_BEHAVIORS.ADVANCED };
  return null;
}
