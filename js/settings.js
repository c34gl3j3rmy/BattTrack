import { DASHBOARD_SORTS, THEMES } from "./constants.js";

export class Settings {
  constructor(data = {}) {
    const now = new Date().toISOString();

    this.key = "global";
    this.criticalThresholdPercent = data.criticalThresholdPercent ?? 20;
    this.alertThresholdPercent = data.alertThresholdPercent ?? data.orangeAlertPercent ?? 30;
    this.dashboardSort = data.dashboardSort ?? DASHBOARD_SORTS.URGENCY;
    this.batteriesSort = data.batteriesSort ?? DASHBOARD_SORTS.NAME;
    this.theme = data.theme ?? THEMES.SYSTEM;
    this.showArchived = data.showArchived ?? false;

    this.notificationsEnabled = data.notificationsEnabled ?? false;
    this.notifyOnCritical = data.notifyOnCritical ?? true;
    this.notificationHistory = data.notificationHistory ?? {};
    this.notificationPromptAskedAt = data.notificationPromptAskedAt ?? null;
    this.lastExportAt = data.lastExportAt ?? null;
    this.installPromptDismissedAt = data.installPromptDismissedAt ?? null;

    this.createdAt = data.createdAt ?? now;
    this.updatedAt = data.updatedAt ?? now;
  }
}

export function createDefaultSettings() {
  return new Settings();
}

export function updateSettings(settings, updates = {}) {
  return new Settings({
    ...settings,
    ...updates,
    createdAt: settings.createdAt,
    updatedAt: new Date().toISOString()
  });
}
