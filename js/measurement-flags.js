const DB_NAME = "BattTrackDB";
const STORE = "measurements";

let lastMeasurementId = null;
let navigationReady = false;

document.addEventListener("click", event => {
  const row = event.target?.closest?.("[data-measurement-id]");
  if (row) lastMeasurementId = row.dataset.measurementId;

  const batteryButton = event.target?.closest?.("[data-battery-id]");
  if (batteryButton) pushAppHistory("battery", batteryButton.dataset.batteryId);
}, true);

document.addEventListener("submit", event => {
  const form = event.target;
  if (form?.id !== "measurement-form") return;
  window.battTrackPendingExcludeFromPrevious = Boolean(form.querySelector("[name='excludeFromPrevious']")?.checked);
}, true);

window.addEventListener("popstate", () => {
  if (document.querySelector("#modal-root .modal")) {
    document.querySelector(".modal-close-button")?.click();
    return;
  }

  if (!isDashboardVisible()) {
    document.querySelector("#home-button")?.click();
  }
});

const observer = new MutationObserver(() => {
  enhanceMeasurementForm();
  decorateHistory();
  enhanceActionButtons();
  enhanceReadableInfo();
  markInitialNavigationState();
});

observer.observe(document.body, { childList: true, subtree: true });

enhanceMeasurementForm();
decorateHistory();
enhanceActionButtons();
enhanceReadableInfo();
markInitialNavigationState();

function markInitialNavigationState() {
  if (navigationReady || !document.querySelector("#app")) return;
  navigationReady = true;
  history.replaceState({ battTrackView: "dashboard" }, "", location.href);
}

function pushAppHistory(view, id = null) {
  if (!navigationReady) markInitialNavigationState();
  const current = history.state ?? {};
  if (current.battTrackView === view && current.id === id) return;
  history.pushState({ battTrackView: view, id }, "", location.href);
}

function isDashboardVisible() {
  return Boolean(document.querySelector(".dashboard-summary"));
}

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

function enhanceActionButtons() {
  document.querySelectorAll("#cancel-form, #later-update-button").forEach(button => button.remove());

  addButtonIcon("button", "Enregistrer", "💾");
  addButtonIcon("button", "Supprimer", "🗑️");
  addButtonIcon("button", "Supprimer définitivement", "🗑️");
  addButtonIcon("button", "Mettre à jour maintenant", "🔄");
  addButtonIcon("button", "Voir", "ℹ️");
  addButtonIcon("a.button", "Voir le projet GitHub", "🔗");
}

function addButtonIcon(selector, label, icon) {
  document.querySelectorAll(selector).forEach(button => {
    const text = button.textContent.trim();
    if (text !== label || text.startsWith(icon)) return;
    button.textContent = `${icon} ${label}`;
  });
}

function enhanceReadableInfo() {
  document.querySelectorAll(".card").forEach(card => {
    const title = card.querySelector("h3")?.textContent.trim();
    if (title === "Statut") {
      prefixParagraph(card, "Dernière mesure", "🔋");
      prefixParagraph(card, "Date seuil estimée", "📅");
      prefixParagraph(card, "Confiance", "🎯");
    }
    if (title === "Statistiques") {
      prefixParagraph(card, "Mesures", "📊");
      prefixParagraph(card, "Cycles", "🔄");
      prefixParagraph(card, "Perte moyenne", "📉");
    }
  });
}

function prefixParagraph(container, label, icon) {
  const paragraph = [...container.querySelectorAll("p")].find(element => element.textContent.trim().startsWith(label));
  if (!paragraph || paragraph.dataset.iconEnhanced) return;
  paragraph.dataset.iconEnhanced = "true";
  paragraph.innerHTML = `${icon} ${paragraph.innerHTML}`;
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
