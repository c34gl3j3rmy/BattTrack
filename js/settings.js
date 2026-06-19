import { DASHBOARD_SORTS } from "./constants.js";
export class Settings {
  constructor(data = {}) {
    const now = new Date().toISOString();
    this.key = "global";
    this.criticalThresholdPercent = data.criticalThresholdPercent ?? 20;
    this.alertThresholdPercent = data.alertThresholdPercent ?? data.orangeAlertPercent ?? 30;
    this.prealertDays = data.prealertDays ?? data.orangeAlertDays ?? 30;
    this.dashboardSort = data.dashboardSort ?? DASHBOARD_SORTS.URGENCY;
    this.batteriesSort = data.batteriesSort ?? DASHBOARD_SORTS.NAME;
    this.showArchived = data.showArchived ?? false;
    this.createdAt = data.createdAt ?? now;
    this.updatedAt = data.updatedAt ?? now;
  }
}
export function createDefaultSettings() { return new Settings(); }
export function updateSettings(settings, updates = {}) { return new Settings({ ...settings, ...updates, createdAt: settings.createdAt, updatedAt: new Date().toISOString() }); }
