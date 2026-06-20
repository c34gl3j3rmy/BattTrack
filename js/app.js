import { initDb, getAllBatteries, getMeasurementsByBatteryId, getSettings, saveSettings, saveBattery, deleteBattery, deleteMeasurementsByBatteryId, saveMeasurement, deleteMeasurement } from "./db.js";
import { Battery, createBattery, updateBattery, archiveBattery, restoreBattery } from "./battery.js";
import { createChargeMeasurement, createLedMeasurement, createPercentageMeasurement } from "./measurement.js";
import { calculateBatteryStatus, sortBatteryStatusItems } from "./calculation.js";
import { renderDashboard, renderBatteriesPage, renderArchivesPage, renderBatteryDetails, renderSettingsPage, openBatteryFormModal, openAddMeasurementModal, openQuickMeasurementPicker, openBatteryActionModal, openArchivesDeletePicker, openSideMenu, closeModal, setFabVisible } from "./ui.js";
import { downloadJsonBackup, readJsonBackup, replaceWithImportedData } from "./import-export.js";
import { INPUT_MODES, VIEWS } from "./constants.js";
import { updateSettings } from "./settings.js";
let state = { batteries: [], settings: null, statuses: [], view: VIEWS.DASHBOARD, currentBatteryId: null };

async function main() {
  await registerServiceWorker();
  await initDb(); await reloadState(); renderDashboardView();
  document.querySelector("#floating-action-button").addEventListener("click", handleFabClick);
  document.querySelector("#menu-button").addEventListener("click", () => openSideMenu({ onDashboard: renderDashboardView, onBatteries: renderBatteriesView, onArchives: renderArchivesView, onSettings: renderSettingsView, onExportJson: downloadJsonBackup, onImportJson: triggerImport }));
  document.querySelector("#import-json-input").addEventListener("change", handleImportFile);
}
async function reloadState() {
  state.settings = await getSettings();
  state.batteries = (await getAllBatteries()).map(b => new Battery(b));
  state.statuses = [];
  for (const battery of state.batteries) { const measurements = await getMeasurementsByBatteryId(battery.id); state.statuses.push({ battery, status: calculateBatteryStatus(battery, measurements, state.settings) }); }
}
function getArchivedCount() { return state.batteries.filter(b => b.archived).length; }
function activeSorted(mode) { return sortBatteryStatusItems(state.statuses.filter(i => !i.battery.archived), mode); }
function archivedItems() { return state.statuses.filter(i => i.battery.archived); }
function renderDashboardView() { state.view = VIEWS.DASHBOARD; state.currentBatteryId = null; setFabVisible(true); renderDashboard(activeSorted(state.settings.dashboardSort), state.settings, getArchivedCount(), { onOpenBattery: openBatteryDetails, onSortChange: handleDashboardSort }); }
function renderBatteriesView() { state.view = VIEWS.BATTERIES; state.currentBatteryId = null; setFabVisible(true); renderBatteriesPage(activeSorted(state.settings.batteriesSort), state.settings, { onOpenBattery: openBatteryDetails, onSortChange: handleBatteriesSort }); }
function renderArchivesView() { state.view = VIEWS.ARCHIVES; state.currentBatteryId = null; setFabVisible(archivedItems().length > 0); renderArchivesPage(archivedItems(), { onOpenBattery: openBatteryDetails }); }
function renderSettingsView() { state.view = VIEWS.SETTINGS; state.currentBatteryId = null; setFabVisible(false); renderSettingsPage(state.settings, { onSave: handleSettingsSave }); }
async function openBatteryDetails(id) { const battery = state.batteries.find(b => b.id === id); const measurements = await getMeasurementsByBatteryId(id); const status = calculateBatteryStatus(battery, measurements, state.settings); state.view = battery.archived ? VIEWS.ARCHIVED_BATTERY_DETAILS : VIEWS.BATTERY_DETAILS; state.currentBatteryId = id; setFabVisible(true); renderBatteryDetails(battery, measurements, status, { onEditMeasurement: (measurementId) => openEditMeasurement(battery, measurements.find(m => m.id === measurementId)) }); }
async function handleDashboardSort(sort) { state.settings = updateSettings(state.settings, { dashboardSort: sort }); await saveSettings(state.settings); renderDashboardView(); }
async function handleBatteriesSort(sort) { state.settings = updateSettings(state.settings, { batteriesSort: sort }); await saveSettings(state.settings); renderBatteriesView(); }
async function handleSettingsSave(updates) { state.settings = updateSettings(state.settings, updates); await saveSettings(state.settings); await reloadState(); renderSettingsView(); }
function handleFabClick() {
  if (state.view === VIEWS.DASHBOARD) return openQuickMeasurementPicker(activeSorted(state.settings.dashboardSort), { onSelectBattery: b => openAddMeasurementForBattery(b) });
  if (state.view === VIEWS.BATTERIES) return openBatteryFormModal({ onSave: handleCreateBattery });
  if (state.view === VIEWS.BATTERY_DETAILS || state.view === VIEWS.ARCHIVED_BATTERY_DETAILS) return openBatteryActionsForCurrent();
  if (state.view === VIEWS.ARCHIVES) return openArchivesDeletePicker(archivedItems(), { onDeleteBattery: handleDeleteBatteryById });
}
function openBatteryActionsForCurrent() {
  const battery = state.batteries.find(b => b.id === state.currentBatteryId);
  openBatteryActionModal(battery, { onAddMeasurement: () => openAddMeasurementForBattery(battery), onAddCharge: () => handleAddCharge(battery.id), onEdit: () => openBatteryFormModal({ onSave: data => handleUpdateBattery(battery, data) }, battery), onArchive: () => handleArchiveBattery(battery), onRestore: () => handleRestoreBattery(battery), onDelete: () => handleDeleteBatteryById(battery.id) });
}
function openAddMeasurementForBattery(battery) { openAddMeasurementModal(battery, { onSave: data => handleCreateMeasurement(battery, data) }); }
function openEditMeasurement(battery, measurement) { openAddMeasurementModal(battery, { onSave: data => handleCreateMeasurement(battery, data), onDelete: async m => { if (confirm("Supprimer cette mesure ?")) { await deleteMeasurement(m.id); closeModal(); await reloadState(); await openBatteryDetails(battery.id); } } }, measurement); }
async function handleCreateBattery(data) { const battery = createBattery(data); await saveBattery(battery); await reloadState(); renderBatteriesView(); }
async function handleUpdateBattery(battery, data) { await saveBattery(updateBattery(battery, data)); await reloadState(); await openBatteryDetails(battery.id); }
async function handleArchiveBattery(battery) { if (!confirm(`Archiver ${battery.name} ?`)) return; await saveBattery(archiveBattery(battery)); closeModal(); await reloadState(); renderBatteriesView(); }
async function handleRestoreBattery(battery) { await saveBattery(restoreBattery(battery)); closeModal(); await reloadState(); await openBatteryDetails(battery.id); }
async function handleDeleteBatteryById(id) { const battery = state.batteries.find(b => b.id === id); if (!battery || !confirm(`Supprimer définitivement ${battery.name} et toutes ses mesures ?`)) return; await deleteMeasurementsByBatteryId(id); await deleteBattery(id); closeModal(); await reloadState(); renderArchivesView(); }
async function handleAddCharge(id) { await saveMeasurement(createChargeMeasurement(id)); closeModal(); await reloadState(); await openBatteryDetails(id); }
async function handleCreateMeasurement(battery, data) {
  const existing = data.existingMeasurement;
  const common = { batteryId: battery.id, levelPercent: data.levelPercent, date: data.date, id: existing?.id, createdAt: existing?.createdAt };
  const measurement = battery.preferredInputMode === INPUT_MODES.LED && battery.ledConfig ? createLedMeasurement({ ...common, ledCount: battery.ledConfig.ledCount, behavior: battery.ledConfig.behavior, sliderPosition: data.sliderPosition }) : createPercentageMeasurement(common);
  await saveMeasurement(measurement); await reloadState(); await openBatteryDetails(battery.id);
}
function triggerImport() { document.querySelector("#import-json-input").click(); }
async function handleImportFile(event) { const file = event.target.files?.[0]; if (!file) return; if (!confirm("Importer ce fichier ? Les données actuelles seront remplacées.")) return; const data = await readJsonBackup(file); await replaceWithImportedData(data); await reloadState(); renderDashboardView(); event.target.value = ""; }

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register("./service-worker.js");
  } catch (error) {
    console.warn("Service worker non enregistré", error);
  }
}

main().catch(error => { console.error(error); document.querySelector("#app").innerHTML = `<section class="card"><h2>Erreur</h2><p>${error.message}</p></section>`; });
