import {
  initDb,
  getAllBatteries,
  getMeasurementsByBatteryId,
  getSettings,
  saveBattery,
  saveMeasurement
} from "./db.js";
import { createBattery } from "./battery.js";
import {
  createChargeMeasurement,
  createLedMeasurement,
  createPercentageMeasurement
} from "./measurement.js";
import { calculateBatteryStatus } from "./calculation.js";
import {
  renderDashboard,
  renderAllBatteries,
  renderBatteryDetails,
  openActionModal,
  openBatteryFormModal,
  openAddMeasurementModal
} from "./ui.js";
import { downloadJsonBackup } from "./import-export.js";
import { INPUT_MODES } from "./constants.js";

let state = {
  batteries: [],
  settings: null,
  statuses: []
};

async function main() {
  await initDb();
  await reloadState();
  renderHome();

  document.querySelector("#floating-action-button").addEventListener("click", () => {
    openActionModal({
      onCreateBattery: () => openBatteryFormModal({ onSave: handleCreateBattery }),
      onExportJson: handleExportJson
    });
  });

  document.querySelector("#menu-button").addEventListener("click", renderHome);
}

async function reloadState() {
  state.settings = await getSettings();
  state.batteries = await getAllBatteries();
  state.statuses = [];

  for (const battery of state.batteries) {
    const measurements = await getMeasurementsByBatteryId(battery.id);
    const status = calculateBatteryStatus(battery, measurements, state.settings);
    state.statuses.push({ battery, status });
  }
}

function renderHome() {
  renderDashboard(state.statuses, {
    onShowAll: () => renderAllBatteries(state.statuses, {
      onOpenBattery: openBatteryDetails
    }),
    onOpenBattery: openBatteryDetails
  });
}

async function openBatteryDetails(batteryId) {
  const battery = state.batteries.find((item) => item.id === batteryId);
  const measurements = await getMeasurementsByBatteryId(batteryId);
  const status = calculateBatteryStatus(battery, measurements, state.settings);

  renderBatteryDetails(battery, measurements, status, {
    onAddMeasurement: (selectedBattery) => {
      openAddMeasurementModal(selectedBattery, {
        onSave: async (data) => {
          await handleCreateMeasurement(selectedBattery, data);
        }
      });
    },
    onAddCharge: async (selectedBatteryId) => {
      await saveMeasurement(createChargeMeasurement(selectedBatteryId));
      await reloadState();
      await openBatteryDetails(selectedBatteryId);
    },
    onEditMeasurement: () => {
      alert("Modification des mesures : prévu dans la prochaine itération.");
    }
  });
}

async function handleCreateBattery(data) {
  const battery = createBattery(data);
  await saveBattery(battery);
  await reloadState();
  renderHome();
}

async function handleCreateMeasurement(battery, data) {
  const measurement = battery.preferredInputMode === INPUT_MODES.LED
    ? createLedMeasurement({
      batteryId: battery.id,
      ledCount: battery.ledConfig?.ledCount ?? 4,
      behavior: battery.ledConfig?.behavior ?? "simple",
      sliderPosition: data.sliderPosition,
      levelPercent: data.levelPercent,
      date: data.date
    })
    : createPercentageMeasurement({
      batteryId: battery.id,
      levelPercent: data.levelPercent,
      date: data.date
    });

  await saveMeasurement(measurement);
  await reloadState();
  await openBatteryDetails(battery.id);
}

async function handleExportJson() {
  await downloadJsonBackup();
}

main().catch((error) => {
  console.error(error);
  document.querySelector("#app").innerHTML = `
    <section class="card">
      <h2>Erreur</h2>
      <p>${error.message}</p>
    </section>
  `;
});
