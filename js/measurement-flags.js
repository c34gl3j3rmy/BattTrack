const DB_NAME = "BattTrackDB";
const STORE = "measurements";

let lastMeasurementId = null;

document.addEventListener("click", event => {
  const row = event.target?.closest?.("[data-measurement-id]");
  if (row) lastMeasurementId = row.dataset.measurementId;
}, true);

document.addEventListener("submit", event => {
  const form = event.target;
  if (form?.id !== "measurement-form") return;
  window.battTrackPendingExcludeFromPrevious = Boolean(form.querySelector("[name='excludeFromPrevious']")?.checked);
}, true);

const observer = new MutationObserver(() => {
  enhanceMeasurementForm();
  decorateHistory();
  decorateExistingChart();
});

observer.observe(document.body, { childList: true, subtree: true });

enhanceMeasurementForm();
decorateHistory();
decorateExistingChart();

async function enhanceMeasurementForm() {
  const form = document.querySelector("#measurement-form");
  if (!form || form.dataset.flagEnhanced) return;
  form.dataset.flagEnhanced = "true";

  const existing = lastMeasurementId ? await getMeasurement(lastMeasurementId) : null;
  const checked = existing?.excludeFromPrevious ? "checked" : "";
  const levelLabel = form.querySelector("[name='levelPercent']")?.closest("label");
  if (!levelLabel) return;

  levelLabel.insertAdjacentHTML("afterend", `
    <label class="checkbox-row">
      <input name="excludeFromPrevious" type="checkbox" ${checked}>
      <span>Exclure la baisse depuis la mesure précédente</span>
    </label>
    <p class="helper-text flagged-helper">À cocher si la batterie a été utilisée depuis la dernière mesure.</p>
  `);
}

async function decorateHistory() {
  const rows = [...document.querySelectorAll("[data-measurement-id]")];
  if (rows.length === 0) return;

  const measurements = await getAllMeasurements();
  const byId = new Map(measurements.map(measurement => [measurement.id, measurement]));

  for (const row of rows) {
    const measurement = byId.get(row.dataset.measurementId);
    if (!measurement?.excludeFromPrevious || row.dataset.flagDecorated) continue;
    row.dataset.flagDecorated = "true";
    row.classList.add("measurement-flagged");
  }
}

async function decorateExistingChart() {
  const chart = document.querySelector(".mini-chart");
  if (!chart || chart.dataset.flagDecorated === "true") return;

  const rows = [...document.querySelectorAll("[data-measurement-id]")];
  if (rows.length === 0) return;

  const allMeasurements = await getAllMeasurements();
  const rowIds = new Set(rows.map(row => row.dataset.measurementId));
  const visibleMeasurement = allMeasurements.find(measurement => rowIds.has(measurement.id));
  if (!visibleMeasurement?.batteryId) return;

  const now = new Date();
  const minDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const chartMeasurements = allMeasurements
    .filter(measurement => measurement.batteryId === visibleMeasurement.batteryId && typeof measurement.levelPercent === "number")
    .map(measurement => ({ ...measurement, dateObject: new Date(measurement.measuredAt ?? `${measurement.date}T00:00`) }))
    .filter(measurement => measurement.dateObject >= minDate && measurement.dateObject <= now)
    .sort((a, b) => a.dateObject - b.dateObject);

  const segments = [...chart.querySelectorAll(".mini-chart-segment")];
  const dots = [...chart.querySelectorAll(".mini-chart-dot")];
  if (chartMeasurements.length < 2 || segments.length === 0) return;

  chart.dataset.flagDecorated = "true";

  chartMeasurements.forEach((measurement, index) => {
    if (!measurement.excludeFromPrevious) return;

    const segment = segments[index - 1];
    if (segment) {
      segment.setAttribute("stroke", "var(--muted)");
      segment.setAttribute("stroke-dasharray", "7 6");
      segment.setAttribute("opacity", "0.75");
    }

    const dot = dots[index];
    if (dot) {
      dot.setAttribute("fill", "var(--muted)");
    }
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getAllMeasurements() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result ?? []);
  });
}

async function getMeasurement(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result ?? null);
  });
}
