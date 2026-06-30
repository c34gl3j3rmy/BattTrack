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
  renderFlaggedChart();
});

observer.observe(document.body, { childList: true, subtree: true });

enhanceMeasurementForm();
decorateHistory();
renderFlaggedChart();

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
    row.insertAdjacentHTML("beforeend", `<span class="badge badge-gray flagged-badge">Exclue</span>`);
  }
}

async function renderFlaggedChart() {
  const chart = document.querySelector(".mini-chart");
  if (!chart || chart.dataset.flaggedChart === "true") return;

  const rows = [...document.querySelectorAll("[data-measurement-id]")];
  if (rows.length === 0) return;

  const allMeasurements = await getAllMeasurements();
  const rowIds = new Set(rows.map(row => row.dataset.measurementId));
  const visibleMeasurement = allMeasurements.find(measurement => rowIds.has(measurement.id));
  if (!visibleMeasurement?.batteryId) return;

  const settings = await getSettings();
  const measurements = allMeasurements
    .filter(measurement => measurement.batteryId === visibleMeasurement.batteryId && typeof measurement.levelPercent === "number")
    .map(measurement => ({ ...measurement, dateObject: new Date(measurement.measuredAt ?? `${measurement.date}T00:00`) }))
    .sort((a, b) => a.dateObject - b.dateObject)
    .slice(-12);

  if (measurements.length < 2) return;

  const width = 420;
  const height = 190;
  const labelW = 42;
  const bottomH = 32;
  const padding = 12;
  const chartX = labelW;
  const chartY = padding;
  const chartW = width - labelW - padding;
  const chartH = height - bottomH - padding * 2;
  const first = measurements[0].dateObject;
  const last = measurements.at(-1).dateObject;
  const rangeMs = Math.max(1, last - first);

  const yFor = level => chartY + ((100 - level) / 100) * chartH;
  const xFor = date => chartX + ((date - first) / rangeMs) * chartW;
  const colorFor = level => {
    if (level <= settings.criticalThresholdPercent) return "var(--danger)";
    if (level <= settings.alertThresholdPercent) return "var(--warning)";
    return "var(--success)";
  };
  const labelFor = point => point.dateObject.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const coords = measurements.map(point => ({ x: xFor(point.dateObject), y: yFor(point.levelPercent), level: point.levelPercent, label: labelFor(point), flagged: Boolean(point.excludeFromPrevious) }));
  const segments = [];

  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const stroke = b.flagged ? "var(--muted)" : colorFor(b.level);
    const dash = b.flagged ? ` stroke-dasharray="7 6" opacity="0.75"` : "";
    const title = `${b.label} - ${b.level} %${b.flagged ? " - segment exclu" : ""}`;
    segments.push(`<line class="mini-chart-segment" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${stroke}"${dash}><title>${title}</title></line>`);
  }

  chart.outerHTML = `
    <svg class="mini-chart" data-flagged-chart="true" viewBox="0 0 ${width} ${height}" role="img" aria-label="Évolution du niveau de batterie">
      ${[100, 50, 0].map(level => `<text class="mini-chart-label" x="0" y="${(yFor(level) + 5).toFixed(1)}">${level} %</text><line class="mini-chart-grid" x1="${chartX}" y1="${yFor(level).toFixed(1)}" x2="${width - padding}" y2="${yFor(level).toFixed(1)}"/>`).join("")}
      ${segments.join("")}
      ${coords.map(p => `<circle class="mini-chart-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${p.flagged ? "var(--muted)" : colorFor(p.level)}"><title>${p.label} - ${p.level} %${p.flagged ? " - exclue" : ""}</title></circle>`).join("")}
    </svg>
  `;
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

async function getSettings() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction("settings", "readonly").objectStore("settings").get("global");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result ?? { alertThresholdPercent: 30, criticalThresholdPercent: 15 });
  });
}
