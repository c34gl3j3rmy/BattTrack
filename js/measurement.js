import { INPUT_MODES, LED_BEHAVIORS, MEASUREMENT_SOURCES, MEASUREMENT_TYPES } from "./constants.js";

export class Measurement {
  constructor(data = {}) {
    const now = new Date().toISOString();
    this.id = data.id ?? crypto.randomUUID();
    this.batteryId = data.batteryId ?? null;
    this.date = data.date ?? new Date().toISOString().slice(0, 10);
    this.levelPercent = data.levelPercent ?? null;
    this.type = data.type ?? MEASUREMENT_TYPES.MEASURE;
    this.source = data.source ?? MEASUREMENT_SOURCES.MANUAL_PERCENTAGE;
    this.observation = data.observation ?? null;
    this.createdAt = data.createdAt ?? now;
    this.updatedAt = data.updatedAt ?? now;
  }
}

export function createPercentageMeasurement({ batteryId, levelPercent, date, type = MEASUREMENT_TYPES.MEASURE, id = undefined, createdAt = undefined }) {
  const level = clampPercent(levelPercent);
  return new Measurement({
    id, createdAt, batteryId, date, levelPercent: level, type,
    source: type === MEASUREMENT_TYPES.CHARGE ? MEASUREMENT_SOURCES.BUTTON_CHARGE : MEASUREMENT_SOURCES.MANUAL_PERCENTAGE,
    observation: { mode: INPUT_MODES.PERCENTAGE, value: level }
  });
}

export function createChargeMeasurement(batteryId, date) { return createPercentageMeasurement({ batteryId, date, levelPercent: 100, type: MEASUREMENT_TYPES.CHARGE }); }

export function createLedMeasurement({ batteryId, ledCount, behavior, sliderPosition, levelPercent, date, id = undefined, createdAt = undefined }) {
  const state = behavior === LED_BEHAVIORS.ADVANCED ? buildLedAdvancedState(ledCount, sliderPosition) : buildLedSimpleState(ledCount, sliderPosition);
  const proposedPercent = behavior === LED_BEHAVIORS.ADVANCED ? convertLedAdvancedToPercent(ledCount, sliderPosition) : convertLedSimpleToPercent(ledCount, sliderPosition);
  const finalPercent = clampPercent(levelPercent ?? proposedPercent);
  return new Measurement({
    id, createdAt, batteryId, date, levelPercent: finalPercent, type: MEASUREMENT_TYPES.MEASURE,
    source: behavior === LED_BEHAVIORS.ADVANCED ? MEASUREMENT_SOURCES.MANUAL_LED_ADVANCED : MEASUREMENT_SOURCES.MANUAL_LED_SIMPLE,
    observation: { mode: INPUT_MODES.LED, behavior, ledCount, solid: state.solid, blinking: state.blinking, off: state.off, sliderPosition: Number(sliderPosition) }
  });
}

export function convertLedSimpleToPercent(ledCount, solid) {
  if (ledCount <= 0) return 0;
  return clampPercent(Math.round((solid / ledCount) * 100));
}
export function convertLedAdvancedToPercent(ledCount, sliderPosition) {
  const position = Number(sliderPosition);
  const maxPosition = ledCount * 2;
  if (position <= 0) return 0;
  if (position >= maxPosition) return 93;
  const stepSize = 100 / maxPosition;
  return clampPercent(Math.round(position * stepSize));
}
export function getLedSliderPositionFromPercent(percent, ledCount, behavior) {
  const value = clampPercent(percent);
  if (behavior === LED_BEHAVIORS.ADVANCED) return Math.max(0, Math.min(ledCount * 2, Math.round((value / 100) * (ledCount * 2))));
  return Math.max(0, Math.min(ledCount, Math.ceil((value / 100) * ledCount)));
}
export function buildLedSimpleState(ledCount, sliderPosition) {
  const solid = Math.max(0, Math.min(ledCount, Number(sliderPosition)));
  return { solid, blinking: 0, off: ledCount - solid };
}
export function buildLedAdvancedState(ledCount, sliderPosition) {
  const position = Math.max(0, Math.min(ledCount * 2, Number(sliderPosition)));
  if (position === 0) return { solid: 0, blinking: 0, off: ledCount };
  if (position >= ledCount * 2) return { solid: ledCount, blinking: 0, off: 0 };
  if (position % 2 === 1) {
    const solid = Math.floor(position / 2);
    return { solid, blinking: 1, off: ledCount - solid - 1 };
  }
  const solid = position / 2;
  return { solid, blinking: 0, off: ledCount - solid };
}
export function clampPercent(value) {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return 0;
  return Math.max(0, Math.min(100, Math.round(numberValue)));
}
