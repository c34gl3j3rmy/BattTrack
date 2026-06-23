import { initDb, getAllBatteries, getMeasurementsByBatteryId, getSettings, saveSettings, saveBattery, deleteBattery, deleteMeasurementsByBatteryId, saveMeasurement, deleteMeasurement } from "./db.js";
import { Battery, createBattery, updateBattery, archiveBattery, restoreBattery } from "./battery.js";
import { createChargeMeasurement, createLedMeasurement, createPercentageMeasurement } from "./measurement.js";
import { calculateBatteryStatus, sortBatteryStatusItems } from "./calculation.js";
import { renderDashboard, renderArchivesPage, renderBatteryDetails, openSettingsModal, openBatteryFormModal, openAddMeasurementModal, openQuickMeasurementPicker, openBatteryActionModal, openArchivesDeletePicker, openDashboardActionModal, closeModal, setFabVisible } from "./ui.js";
import { downloadJsonBackup, readJsonBackup, replaceWithImportedData } from "./import-export.js";
import { INPUT_MODES, VIEWS, THEMES } from "./constants.js";
import { updateSettings } from "./settings.js";

let state = { batteries: [], settings: null, statuses: [], view: VIEWS.DASHBOARD, currentBatteryId: null };

async function main() {
  await registerServiceWorker();
  await initDb();
  await reloadState();
  applyTheme(state.settings.theme);
  renderDashboardView();

  document.querySelector("#floating-action-button").addEventListener("click", handleFabClick);
  document.querySelector("#settings-button").addEventListener("click", openSettingsView);
  document.querySelector("#home-button").addEventListener("click", renderDashboardView);

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(state.settings.theme));
}

async function reloadState() {
  state.settings = await getSettings();
  state.batteries = (await getAllBatteries()).map(b => new Battery(b));
  state.statuses = [];

  for (const battery of state.batteries) {
    const measurements = await getMeasurementsByBatteryId(battery.id);
    state.statuses.push({ battery, status: calculateBatteryStatus(battery, measurements, state.settings) });
  }
}

function applyTheme(theme) {
  const resolved = theme === THEMES.SYSTEM
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? THEMES.DARK : THEMES.LIGHT)
    : theme;

  document.documentElement.dataset.theme = resolved;
}

function getArchivedCount() {
  return state.batteries.filter(b => b.archived).length;
}

function activeSorted(mode) {
  return sortBatteryStatusItems(state.statuses.filter(i => !i.battery.archived), mode);
}

function archivedItems() {
  return state.statuses.filter(i => i.battery.archived);
}

function renderDashboardView() {
  state.view = VIEWS.DASHBOARD;
  state.currentBatteryId = null;
  setFabVisible(true);

  renderDashboard(activeSorted(state.settings.dashboardSort), state.settings, getArchivedCount(), {
    onOpenBattery: openBatteryDetails,
    onSortChange: handleDashboardSort,
    onArchives: renderArchivesView
  });
}

function renderArchivesView() {
  state.view = VIEWS.ARCHIVES;
  state.currentBatteryId = null;
  setFabVisible(archivedItems().length > 0);

  renderArchivesPage(archivedItems(), {
    onOpenBattery: openBatteryDetails,
    onBack: renderDashboardView
  });
}

function openSettingsView() {
  openSettingsModal(state.settings, {
    onSave: handleSettingsSave,
    onExportJson: downloadJsonBackup,
    onImportJson: handleImportFile
  });
}

async function openBatteryDetails(id) {
  const battery = state.batteries.find(b => b.id === id);
  const measurements = await getMeasurementsByBatteryId(id);
  const status = calculateBatteryStatus(battery, measurements, state.settings);

  state.view = battery.archived ? VIEWS.ARCHIVED_BATTERY_DETAILS : VIEWS.BATTERY_DETAILS;
  state.currentBatteryId = id;
  setFabVisible(true);

  renderBatteryDetails(battery, measurements, status, {
    onEditMeasurement: (measurementId) => openEditMeasurement(battery, measurements.find(m => m.id === measurementId)),
    onBack: renderDashboardView
  });
}

async function handleDashboardSort(sort) {
  state.settings = updateSettings(state.settings, { dashboardSort: sort });
  await saveSettings(state.settings);
  await reloadState();
  renderDashboardView();
}

async function handleSettingsSave(updates) {
  state.settings = updateSettings(state.settings, updates);
  await saveSettings(state.settings);
  applyTheme(state.settings.theme);
  await reloadState();

  // Keep the settings modal open and refresh its active state.
  openSettingsView();
}

function handleFabClick() {
  if (state.view === VIEWS.DASHBOARD) {
    return openDashboardActionModal({
      onAddMeasurement: () => openQuickMeasurementPicker(activeSorted(state.settings.dashboardSort), {
        onSelectBattery: b => {
          closeModal();
          openAddMeasurementForBattery(b);
        }
      }),
      onCreateBattery: () => openBatteryFormModal({ onSave: handleCreateBattery }),
      onQuickCharge: () => openQuickMeasurementPicker(activeSorted(state.settings.dashboardSort), {
        onSelectBattery: b => handleAddCharge(b.id)
      }, "Rechargé à 100 % rapide")
    });
  }

  if (state.view === VIEWS.BATTERY_DETAILS || state.view === VIEWS.ARCHIVED_BATTERY_DETAILS) {
    return openBatteryActionsForCurrent();
  }

  if (state.view === VIEWS.ARCHIVES) {
    return openArchivesDeletePicker(archivedItems(), { onDeleteBattery: handleDeleteBatteryById });
  }
}

function openBatteryActionsForCurrent() {
  const battery = state.batteries.find(b => b.id === state.currentBatteryId);

  openBatteryActionModal(battery, {
    onAddMeasurement: () => openAddMeasurementForBattery(battery),
    onAddCharge: () => handleAddCharge(battery.id),
    onEdit: () => openBatteryFormModal({ onSave: data => handleUpdateBattery(battery, data) }, battery),
    onArchive: () => handleArchiveBattery(battery),
    onRestore: () => handleRestoreBattery(battery),
    onDelete: () => handleDeleteBatteryById(battery.id)
  });
}

function openAddMeasurementForBattery(battery) {
  openAddMeasurementModal(battery, { onSave: data => handleCreateMeasurement(battery, data) });
}

function openEditMeasurement(battery, measurement) {
  openAddMeasurementModal(battery, {
    onSave: data => handleCreateMeasurement(battery, data),
    onDelete: async m => {
      if (confirm("Supprimer cette mesure ?")) {
        await deleteMeasurement(m.id);
        closeModal();
        await reloadState();
        await openBatteryDetails(battery.id);
      }
    }
  }, measurement);
}

async function handleCreateBattery(data) {
  const battery = createBattery(data);
  await saveBattery(battery);
  closeModal();
  await reloadState();
  renderDashboardView();
}

async function handleUpdateBattery(battery, data) {
  await saveBattery(updateBattery(battery, data));
  await reloadState();
  await openBatteryDetails(battery.id);
}

async function handleArchiveBattery(battery) {
  if (!confirm(`Archiver ${battery.name} ?`)) return;
  await saveBattery(archiveBattery(battery));
  closeModal();
  await reloadState();
  renderDashboardView();
}

async function handleRestoreBattery(battery) {
  await saveBattery(restoreBattery(battery));
  closeModal();
  await reloadState();
  await openBatteryDetails(battery.id);
}

async function handleDeleteBatteryById(id) {
  const battery = state.batteries.find(b => b.id === id);
  if (!battery || !confirm(`Supprimer définitivement ${battery.name} et toutes ses mesures ?`)) return;

  await deleteMeasurementsByBatteryId(id);
  await deleteBattery(id);
  closeModal();
  await reloadState();
  renderArchivesView();
}

async function handleAddCharge(id) {
  await saveMeasurement(createChargeMeasurement(id));
  closeModal();
  await reloadState();

  if (state.currentBatteryId === id) {
    await openBatteryDetails(id);
  } else {
    renderDashboardView();
  }
}

async function handleCreateMeasurement(battery, data) {
  const existing = data.existingMeasurement;
  const common = { batteryId: battery.id, levelPercent: data.levelPercent, date: data.date, id: existing?.id, createdAt: existing?.createdAt };
  const measurement = battery.preferredInputMode === INPUT_MODES.LED && battery.ledConfig
    ? createLedMeasurement({ ...common, ledCount: battery.ledConfig.ledCount, behavior: battery.ledConfig.behavior, sliderPosition: data.sliderPosition })
    : createPercentageMeasurement(common);

  await saveMeasurement(measurement);
  await reloadState();
  await openBatteryDetails(battery.id);
}

async function handleImportFile(file) {
  if (!file) return;
  if (!confirm("Importer ce fichier ? Les données actuelles seront remplacées.")) return;

  const data = await readJsonBackup(file);
  await replaceWithImportedData(data);
  await reloadState();
  closeModal();
  renderDashboardView();
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register("./service-worker.js");

    if (registration.waiting) {
      showUpdateAvailableBanner(registration);
    }

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateAvailableBanner(registration);
        }
      });
    });
  } catch (error) {
    console.warn("Service worker non enregistré", error);
  }
}

main().catch(error => {
  console.error(error);
  document.querySelector("#app").innerHTML = `<section class="card"><h2>Erreur</h2><p>${error.message}</p></section>`;
});

function showUpdateAvailableBanner(registration) {
  if (document.querySelector("#update-banner")) return;

  const banner = document.createElement("div");
  banner.id = "update-banner";
  banner.style.position = "fixed";
  banner.style.left = "1rem";
  banner.style.right = "1rem";
  banner.style.bottom = "5.5rem";
  banner.style.zIndex = "50";
  banner.style.padding = "1rem";
  banner.style.borderRadius = "1rem";
  banner.style.background = "var(--card)";
  banner.style.color = "var(--text)";
  banner.style.boxShadow = "0 8px 18px var(--shadow)";
  banner.style.border = "1px solid var(--border)";
  banner.innerHTML = `
    <strong>Nouvelle version disponible</strong>
    <div class="action-row">
      <button id="update-app-button" class="button" type="button">Mettre à jour</button>
    </div>
  `;

  document.body.appendChild(banner);

  document.querySelector("#update-app-button").addEventListener("click", () => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  });
}

let refreshing = false;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
