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
      <span>Batterie utilisée depuis la dernière mesure</span>
    </label>
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
  const settings = await getSettings();
  const rowIds = new Set(rows.map(row => row.dataset.measurementId));
  const visibleMeasurement = allMeasurements.find(measurement => rowIds.has(measurement.id));
  if (!visibleMeasurement?.batteryId) return;

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const minDate = new Date(now.getTime() - 28 * dayMs);
  const chartMeasurements = allMeasurements
    .filter(measurement => measurement.batteryId === visibleMeasurement.batteryId && typeof measurement.levelPercent === "number")
    .map(measurement => ({ ...measurement, dateObject: new Date(measurement.measuredAt ?? `${measurement.date}T00:00`) }))
    .filter(measurement => measurement.dateObject >= minDate && measurement.dateObject <= now)
    .sort((a, b) => a.dateObject - b.dateObject);

  const originalSegments = [...chart.querySelectorAll(".mini-chart-segment")];
  const dots = [...chart.querySelectorAll(".mini-chart-dot")];
  if (chartMeasurements.length < 2 || originalSegments.length === 0) return;

  chart.dataset.flagDecorated = "true";
  originalSegments.forEach(segment => segment.remove());
  dots.forEach(dot => dot.remove());
  chart.querySelectorAll(".mini-chart-extra-grid, .mini-chart-threshold").forEach(element => element.remove());

  const width = 420;
  const height = 190;
  const labelW = 42;
  const bottomH = 32;
  const padding = 12;
  const chartX = labelW;
  const chartY = padding;
  const chartW = width - labelW - padding;
  const chartH = height - bottomH - padding * 2;
  const alertThreshold = Number(settings.alertThresholdPercent ?? 30);
  const criticalThreshold = Number(settings.criticalThresholdPercent ?? 15);
  const yFor = level => chartY + ((100 - level) / 100) * chartH;
  const xFor = date => chartX + ((date - minDate) / (28 * dayMs)) * chartW;
  const colorForLevel = level => {
    if (level <= criticalThreshold) return "var(--danger)";
    if (level < alertThreshold) return "var(--warning)";
    return "var(--success)";
  };

  insertFixedGrid(chart, [25, 75], chartX, width - padding, yFor);
  insertThresholdLine(chart, alertThreshold, "var(--warning)", chartX, width - padding, yFor);
  insertThresholdLine(chart, criticalThreshold, "var(--danger)", chartX, width - padding, yFor);

  const chartParts = chart.querySelector(".mini-chart-dot") ?? chart.querySelector("text:last-of-type") ?? chart.lastElementChild;
  for (let index = 1; index < chartMeasurements.length; index++) {
    const previous = chartMeasurements[index - 1];
    const current = chartMeasurements[index];
    const x1 = xFor(previous.dateObject);
    const x2 = xFor(current.dateObject);
    const y1 = yFor(previous.levelPercent);
    const y2 = yFor(current.levelPercent);

    if (current.excludeFromPrevious) {
      chart.insertBefore(createSvgLine({ x1, y1, x2, y2, stroke: "var(--muted)", dash: true, opacity: "0.75" }), chartParts?.nextSibling ?? null);
      continue;
    }

    for (const part of splitSegmentByThresholds(previous.levelPercent, current.levelPercent, [alertThreshold, criticalThreshold])) {
      const partX1 = x1 + (x2 - x1) * part.startRatio;
      const partX2 = x1 + (x2 - x1) * part.endRatio;
      const partY1 = yFor(part.startLevel);
      const partY2 = yFor(part.endLevel);
      const midLevel = (part.startLevel + part.endLevel) / 2;
      chart.insertBefore(createSvgLine({ x1: partX1, y1: partY1, x2: partX2, y2: partY2, stroke: colorForLevel(midLevel) }), chartParts?.nextSibling ?? null);
    }
  }
}

function splitSegmentByThresholds(startLevel, endLevel, thresholds) {
  if (startLevel === endLevel) return [{ startRatio: 0, endRatio: 1, startLevel, endLevel }];
  const ratios = [0, 1];
  for (const threshold of thresholds) {
    const crosses = (startLevel - threshold) * (endLevel - threshold) < 0;
    if (crosses) ratios.push((threshold - startLevel) / (endLevel - startLevel));
  }
  ratios.sort((a, b) => a - b);
  return ratios.slice(0, -1).map((startRatio, index) => {
    const endRatio = ratios[index + 1];
    return {
      startRatio,
      endRatio,
      startLevel: startLevel + (endLevel - startLevel) * startRatio,
      endLevel: startLevel + (endLevel - startLevel) * endRatio
    };
  }).filter(part => part.endRatio > part.startRatio);
}

function insertFixedGrid(chart, levels, x1, x2, yFor) {
  for (const level of levels) {
    const existingLabel = [...chart.querySelectorAll(".mini-chart-label")].some(label => label.textContent.trim() === `${level} %`);
    const y = yFor(level);
    chart.insertAdjacentHTML("afterbegin", `<line class="mini-chart-grid mini-chart-extra-grid" x1="${x1}" y1="${y.toFixed(1)}" x2="${x2}" y2="${y.toFixed(1)}" stroke-dasharray="5 5" opacity="0.65"/>`);
    if (!existingLabel) chart.insertAdjacentHTML("afterbegin", `<text class="mini-chart-label mini-chart-extra-grid" x="0" y="${(y + 5).toFixed(1)}">${level} %</text>`);
  }
}

function insertThresholdLine(chart, level, stroke, x1, x2, yFor) {
  const y = yFor(level);
  chart.insertAdjacentHTML("afterbegin", `<line class="mini-chart-threshold" x1="${x1}" y1="${y.toFixed(1)}" x2="${x2}" y2="${y.toFixed(1)}" stroke="${stroke}" stroke-dasharray="7 6" opacity="0.9"/>`);
}

function createSvgLine({ x1, y1, x2, y2, stroke, dash = false, opacity = null }) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("class", "mini-chart-segment");
  line.setAttribute("x1", x1.toFixed(1));
  line.setAttribute("y1", y1.toFixed(1));
  line.setAttribute("x2", x2.toFixed(1));
  line.setAttribute("y2", y2.toFixed(1));
  line.setAttribute("stroke", stroke);
  if (dash) line.setAttribute("stroke-dasharray", "7 6");
  if (opacity) line.setAttribute("opacity", opacity);
  return line;
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
