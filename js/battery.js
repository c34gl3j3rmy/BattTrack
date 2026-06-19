import { INPUT_MODES, LED_BEHAVIORS } from "./constants.js";

export class Battery {
  constructor(data = {}) {
    const now = new Date().toISOString();

    this.id = data.id ?? crypto.randomUUID();
    this.name = data.name ?? "";
    this.preferredInputMode = data.preferredInputMode ?? INPUT_MODES.PERCENTAGE;
    this.availableInputModes = data.availableInputModes ?? [INPUT_MODES.PERCENTAGE];
    this.ledConfig = data.ledConfig ?? null;
    this.archived = data.archived ?? false;
    this.notes = data.notes ?? "";
    this.createdAt = data.createdAt ?? now;
    this.updatedAt = data.updatedAt ?? now;
  }
}

export function createBattery(data = {}) {
  return new Battery(normalizeBatteryInput(data));
}

export function updateBattery(existingBattery, updates = {}) {
  return new Battery({
    ...existingBattery,
    ...normalizeBatteryInput(updates),
    id: existingBattery.id,
    createdAt: existingBattery.createdAt,
    updatedAt: new Date().toISOString()
  });
}

export function normalizeBatteryInput(data = {}) {
  const preferredInputMode = data.preferredInputMode ?? INPUT_MODES.PERCENTAGE;
  const availableInputModes = data.availableInputModes ?? [preferredInputMode];

  let ledConfig = data.ledConfig ?? null;

  if (availableInputModes.includes(INPUT_MODES.LED) && !ledConfig) {
    ledConfig = {
      ledCount: 4,
      behavior: LED_BEHAVIORS.SIMPLE
    };
  }

  return {
    ...data,
    name: String(data.name ?? "").trim(),
    preferredInputMode,
    availableInputModes,
    ledConfig
  };
}
