import { LED_BEHAVIORS, MEASUREMENT_SOURCES, MEASUREMENT_TYPES } from "./constants.js";

function pendingExcludeFromPrevious() {
  return Boolean(window.battTrackPendingExcludeFromPrevious);
}

export class Measurement {
  constructor(data = {}) {
    const now = new Date().toISOString();
    const measuredAt = data.measuredAt ?? `${data.date ?? new Date().toISOString().slice(0, 10)}T00:00`;
    this.id = data.id ?? crypto.randomUUID();
    this.batteryId = data.batteryId ?? null;
    this.measuredAt = measuredAt;
    this.date = data.date ?? measuredAt.slice(0, 10);
    this.levelPercent = data.levelPercent ?? null;
    this.type = data.type ?? MEASUREMENT_TYPES.MEASURE;
    this.source = data.source ?? MEASUREMENT_SOURCES.MANUAL_PERCENTAGE;
    this.excludeFromPrevious = Boolean(data.excludeFromPrevious);
    this.observation = data.observation ?? null;
    this.createdAt = data.createdAt ?? now;
    this.updatedAt = data.updatedAt ?? now;
  }
}

export function createPercentageMeasurement({ batteryId, levelPercent, measuredAt = nowLocalDateTime(), date = todayIso(), excludeFromPrevious = pendingExcludeFromPrevious(), id = crypto.randomUUID(), createdAt = new Date().toISOString() }) {
  return { id, batteryId, type: MEASUREMENT_TYPES.MEASURE, source: MEASUREMENT_SOURCES.MANUAL_PERCENTAGE, measuredAt, date: measuredAt?.slice(0, 10) ?? date, levelPercent: clampPercent(levelPercent), excludeFromPrevious: Boolean(excludeFromPrevious), observation: null, createdAt, updatedAt: new Date().toISOString() };
}

export function createLedMeasurement({ batteryId, levelPercent, ledCount, behavior, sliderPosition, measuredAt = nowLocalDateTime(), date = todayIso(), excludeFromPrevious = pendingExcludeFromPrevious(), id = crypto.randomUUID(), createdAt = new Date().toISOString() }) {
  const source = behavior === LED_BEHAVIORS.ADVANCED ? MEASUREMENT_SOURCES.MANUAL_LED_ADVANCED : MEASUREMENT_SOURCES.MANUAL_LED_SIMPLE;
  return { id, batteryId, type: MEASUREMENT_TYPES.MEASURE, source, measuredAt, date: measuredAt?.slice(0, 10) ?? date, levelPercent: clampPercent(levelPercent), excludeFromPrevious: Boolean(excludeFromPrevious), observation: { ledCount, behavior, sliderPosition }, createdAt, updatedAt: new Date().toISOString() };
}

export function createChargeMeasurement(batteryId) {
  const measuredAt = nowLocalDateTime();
  return { id: crypto.randomUUID(), batteryId, type: MEASUREMENT_TYPES.CHARGE, source: MEASUREMENT_SOURCES.BUTTON_CHARGE, measuredAt, date: measuredAt.slice(0, 10), levelPercent: 100, excludeFromPrevious: false, observation: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export function convertLedSimpleToPercent(ledCount, solid) { if (ledCount <= 0) return 0; return clampPercent(Math.round((solid / ledCount) * 100)); }
export function convertLedAdvancedToPercent(ledCount, sliderPosition) { const position = Number(sliderPosition); const maxPosition = ledCount * 2; if (position <= 0) return 0; if (position >= maxPosition) return 100; return clampPercent(Math.round(position * (100 / maxPosition))); }
export function getLedSliderPositionFromPercent(percent, ledCount, behavior) { const value = clampPercent(percent); if (behavior === LED_BEHAVIORS.ADVANCED) return Math.max(0, Math.min(ledCount * 2, Math.round((value / 100) * (ledCount * 2)))); return Math.max(0, Math.min(ledCount, Math.ceil((value / 100) * ledCount))); }
export function buildLedSimpleState(ledCount, sliderPosition) { const solid = Math.max(0, Math.min(ledCount, Number(sliderPosition))); return { solid, blinking: 0, off: ledCount - solid }; }
export function buildLedAdvancedState(ledCount, sliderPosition) { const position = Math.max(0, Math.min(ledCount * 2, Number(sliderPosition))); if (position === 0) return { solid: 0, blinking: 0, off: ledCount }; if (position >= ledCount * 2) return { solid: ledCount, blinking: 0, off: 0 }; if (position % 2 === 1) { const solid = Math.floor(position / 2); return { solid, blinking: 1, off: ledCount - solid - 1 }; } const solid = position / 2; return { solid, blinking: 0, off: ledCount - solid }; }
export function clampPercent(value) { const numberValue = Number(value); if (Number.isNaN(numberValue)) return 0; return Math.max(0, Math.min(100, Math.round(numberValue))); }
export function todayIso() { return new Date().toISOString().slice(0, 10); }
export function nowLocalDateTime() { const now = new Date(); const offsetMs = now.getTimezoneOffset() * 60000; return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16); }
