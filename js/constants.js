export const DB_NAME = "BatteryReminderDB";
export const DB_VERSION = 1;

export const STORE_NAMES = {
  BATTERIES: "batteries",
  MEASUREMENTS: "measurements",
  SETTINGS: "settings",
  METADATA: "metadata"
};

export const INPUT_MODES = {
  PERCENTAGE: "percentage",
  LED: "led"
};

export const LED_BEHAVIORS = {
  SIMPLE: "simple",
  ADVANCED: "advanced"
};

export const MEASUREMENT_TYPES = {
  MEASURE: "measure",
  CHARGE: "charge"
};

export const MEASUREMENT_SOURCES = {
  MANUAL_PERCENTAGE: "manual_percentage",
  MANUAL_LED_SIMPLE: "manual_led_simple",
  MANUAL_LED_ADVANCED: "manual_led_advanced",
  BUTTON_CHARGE: "button_charge",
  IMPORT: "import"
};

export const STATUS = {
  UNINITIALIZED: "uninitialized",
  RED: "red",
  ORANGE: "orange",
  GREEN: "green"
};
