export const DB_NAME = "BattTrackDB";
export const DB_VERSION = 1;
export const APP_VERSION = "1.4.0";
export const APP_VERSION_FALLBACK = APP_VERSION;
export const GITHUB_RELEASES_API_URL = "https://api.github.com/repos/c34gl3j3rmy/BattTrack/releases/latest";

export const STORE_NAMES = { BATTERIES: "batteries", MEASUREMENTS: "measurements", SETTINGS: "settings", METADATA: "metadata" };
export const INPUT_MODES = { PERCENTAGE: "percentage", LED: "led" };
export const LED_BEHAVIORS = { SIMPLE: "simple", ADVANCED: "advanced" };
export const BATTERY_INPUT_TYPES = { PERCENTAGE: "percentage", LED_SIMPLE: "led_simple", LED_ADVANCED: "led_advanced" };
export const MEASUREMENT_TYPES = { MEASURE: "measure", CHARGE: "charge" };
export const MEASUREMENT_SOURCES = { MANUAL_PERCENTAGE: "manual_percentage", MANUAL_LED_SIMPLE: "manual_led_simple", MANUAL_LED_ADVANCED: "manual_led_advanced", BUTTON_CHARGE: "button_charge", IMPORT: "import" };
export const DASHBOARD_SORTS = { URGENCY: "urgency", NAME: "name", ESTIMATED_LEVEL: "estimatedLevel", LAST_MEASUREMENT: "lastMeasurement", LAST_CHARGE: "lastCharge", STATUS: "status" };
export const STATUS = { UNINITIALIZED: "uninitialized", RED: "red", ORANGE: "orange", GREEN: "green" };
export const VIEWS = { DASHBOARD: "dashboard", BATTERIES: "batteries", BATTERY_DETAILS: "battery-details", ARCHIVES: "archives", ARCHIVED_BATTERY_DETAILS: "archived-battery-details", SETTINGS: "settings" };
export const THEMES = { LIGHT: "light", DARK: "dark", SYSTEM: "system" };

export const DASHBOARD_FILTERS = { ALL: "all", RED: "red", ORANGE: "orange", GREEN: "green", UNINITIALIZED: "uninitialized" };
