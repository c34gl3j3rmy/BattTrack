import { INPUT_MODES, LED_BEHAVIORS, STATUS } from "./constants.js";
import {
  buildLedAdvancedState,
  buildLedSimpleState,
  convertLedAdvancedToPercent,
  convertLedSimpleToPercent
} from "./measurement.js";

const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");

export function renderDashboard(batteriesWithStatus, handlers) {
  const red = batteriesWithStatus.filter((item) => item.status.status === STATUS.RED);
  const orange = batteriesWithStatus.filter((item) => item.status.status === STATUS.ORANGE);
  const green = batteriesWithStatus.filter((item) => item.status.status === STATUS.GREEN);
  const uninitialized = batteriesWithStatus.filter((item) => item.status.status === STATUS.UNINITIALIZED);

  app.innerHTML = `
    <section class="card">
      <h2>Tableau de bord</h2>
      <div class="status-row">
        <div><span class="badge badge-red">🔴 A recharger : ${red.length}</span></div>
        <div><span class="badge badge-orange">🟠 A surveiller : ${orange.length}</span></div>
        <div><span class="badge badge-green">🟢 OK : ${green.length}</span></div>
        <div><span class="badge badge-gray">⚪ Non initialisée : ${uninitialized.length}</span></div>
      </div>
    </section>

    <section class="card">
      <h3>Urgences</h3>
      ${red.length === 0 ? `<p class="empty-state">✅ Tout est OK</p>` : renderBatteryList(red)}
    </section>

    <section class="card">
      <button id="show-all-batteries" class="button secondary-button" type="button">Voir toutes les batteries</button>
    </section>
  `;

  app.querySelector("#show-all-batteries").addEventListener("click", handlers.onShowAll);

  app.querySelectorAll("[data-battery-id]").forEach((button) => {
    button.addEventListener("click", () => handlers.onOpenBattery(button.dataset.batteryId));
  });
}

export function renderAllBatteries(batteriesWithStatus, handlers) {
  app.innerHTML = `
    <section class="card">
      <h2>Toutes les batteries</h2>
      ${batteriesWithStatus.length === 0 ? `<p class="empty-state">Aucune batterie.</p>` : renderBatteryList(batteriesWithStatus)}
    </section>
  `;

  app.querySelectorAll("[data-battery-id]").forEach((button) => {
    button.addEventListener("click", () => handlers.onOpenBattery(button.dataset.batteryId));
  });
}

export function renderBatteryDetails(battery, measurements, status, handlers) {
  app.innerHTML = `
    <section class="card">
      <h2>${escapeHtml(battery.name)}</h2>

      <div class="action-row">
        <button id="add-measurement" class="button" type="button">Ajouter mesure</button>
        <button id="add-charge" class="button secondary-button" type="button">🔋 Rechargé à 100 %</button>
      </div>
    </section>

    <section class="card">
      <h3>Statut</h3>
      <p>${formatStatus(status.status)}</p>
      <p>Dernier niveau : <strong>${status.lastLevelPercent ?? "-"} %</strong></p>
      <p>Date seuil estimée : <strong>${status.estimatedThresholdDate ?? "-"}</strong></p>
      <p>Confiance : <strong>${status.confidence}</strong></p>
    </section>

    <section class="card">
      <h3>Statistiques</h3>
      <p>Mesures : <strong>${status.measurementCount}</strong></p>
      <p>Cycles : <strong>${status.cycleCount}</strong></p>
      <p>Perte moyenne : <strong>${status.averageDischargePerDay.toFixed(3)} % / jour</strong></p>
    </section>

    <section class="card">
      <h3>Historique</h3>
      ${measurements.length === 0 ? `<p class="empty-state">Aucune mesure.</p>` : renderMeasurementHistory(measurements)}
    </section>
  `;

  app.querySelector("#add-measurement").addEventListener("click", () => handlers.onAddMeasurement(battery));
  app.querySelector("#add-charge").addEventListener("click", () => handlers.onAddCharge(battery.id));

  app.querySelectorAll("[data-measurement-id]").forEach((row) => {
    row.addEventListener("click", () => handlers.onEditMeasurement(row.dataset.measurementId));
  });
}

export function openActionModal(handlers) {
  openModal(`
    <h2>Actions</h2>
    <div class="form-grid">
      <button id="create-battery" class="button" type="button">Créer une batterie</button>
      <button id="export-json" class="button secondary-button" type="button">Exporter JSON</button>
      <button id="close-modal" class="button secondary-button" type="button">Fermer</button>
    </div>
  `);

  modalRoot.querySelector("#create-battery").addEventListener("click", handlers.onCreateBattery);
  modalRoot.querySelector("#export-json").addEventListener("click", handlers.onExportJson);
  modalRoot.querySelector("#close-modal").addEventListener("click", closeModal);
}

export function openBatteryFormModal(handlers, battery = null) {
  openModal(`
    <h2>${battery ? "Modifier batterie" : "Créer batterie"}</h2>

    <form id="battery-form" class="form-grid">
      <label>
        Nom
        <input name="name" type="text" value="${escapeHtml(battery?.name ?? "")}" required>
      </label>

      <label>
        Mode préféré
        <select name="preferredInputMode">
          <option value="percentage">Pourcentage</option>
          <option value="led">LEDs</option>
        </select>
      </label>

      <label>
        Nombre de LEDs
        <select name="ledCount">
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4" selected>4</option>
          <option value="5">5</option>
        </select>
      </label>

      <label>
        Comportement LEDs
        <select name="ledBehavior">
          <option value="simple">Simple</option>
          <option value="advanced">Avancé</option>
        </select>
      </label>

      <label>
        Notes
        <textarea name="notes">${escapeHtml(battery?.notes ?? "")}</textarea>
      </label>

      <div class="action-row">
        <button class="button" type="submit">Enregistrer</button>
        <button id="cancel-form" class="button secondary-button" type="button">Annuler</button>
      </div>
    </form>
  `);

  const form = modalRoot.querySelector("#battery-form");
  form.preferredInputMode.value = battery?.preferredInputMode ?? INPUT_MODES.PERCENTAGE;

  if (battery?.ledConfig) {
    form.ledCount.value = String(battery.ledConfig.ledCount);
    form.ledBehavior.value = battery.ledConfig.behavior;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const preferredInputMode = formData.get("preferredInputMode");
    const availableInputModes = preferredInputMode === INPUT_MODES.LED
      ? [INPUT_MODES.LED, INPUT_MODES.PERCENTAGE]
      : [INPUT_MODES.PERCENTAGE, INPUT_MODES.LED];

    handlers.onSave({
      name: formData.get("name"),
      preferredInputMode,
      availableInputModes,
      ledConfig: {
        ledCount: Number(formData.get("ledCount")),
        behavior: formData.get("ledBehavior")
      },
      notes: formData.get("notes")
    });

    closeModal();
  });

  modalRoot.querySelector("#cancel-form").addEventListener("click", closeModal);
}

export function openAddMeasurementModal(battery, handlers) {
  const ledCount = battery.ledConfig?.ledCount ?? 4;
  const behavior = battery.ledConfig?.behavior ?? LED_BEHAVIORS.SIMPLE;
  const maxPosition = behavior === LED_BEHAVIORS.ADVANCED ? ledCount * 2 - 1 : ledCount;
  const initialPosition = maxPosition;
  const initialPercent = behavior === LED_BEHAVIORS.ADVANCED
    ? convertLedAdvancedToPercent(ledCount, initialPosition)
    : convertLedSimpleToPercent(ledCount, initialPosition);

  openModal(`
    <h2>Ajouter mesure</h2>

    <form id="measurement-form" class="form-grid">
      <label>
        Date
        <input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required>
      </label>

      ${battery.preferredInputMode === INPUT_MODES.LED ? `
        <div>
          <div id="led-preview" class="led-preview"></div>
          <input id="led-slider" name="sliderPosition" type="range" min="0" max="${maxPosition}" step="1" value="${initialPosition}">
        </div>
      ` : ""}

      <label>
        Pourcentage
        <input name="levelPercent" type="number" inputmode="numeric" min="0" max="100" step="1" value="${battery.preferredInputMode === INPUT_MODES.LED ? initialPercent : ""}" required>
      </label>

      <div class="action-row">
        <button class="button" type="submit">Enregistrer</button>
        <button id="cancel-form" class="button secondary-button" type="button">Annuler</button>
      </div>
    </form>
  `);

  const form = modalRoot.querySelector("#measurement-form");
  const slider = modalRoot.querySelector("#led-slider");
  const preview = modalRoot.querySelector("#led-preview");

  if (slider && preview) {
    const updatePreview = () => {
      const position = Number(slider.value);
      const percent = behavior === LED_BEHAVIORS.ADVANCED
        ? convertLedAdvancedToPercent(ledCount, position)
        : convertLedSimpleToPercent(ledCount, position);

      form.levelPercent.value = percent;
      preview.innerHTML = `${renderLedPreviewHtml(ledCount, behavior, position)} <span>(${percent} %)</span>`;
    };

    slider.addEventListener("input", updatePreview);
    updatePreview();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);

    handlers.onSave({
      date: formData.get("date"),
      levelPercent: Number(formData.get("levelPercent")),
      sliderPosition: slider ? Number(formData.get("sliderPosition")) : null
    });

    closeModal();
  });

  modalRoot.querySelector("#cancel-form").addEventListener("click", closeModal);
}

function renderBatteryList(items) {
  return `
    <div class="battery-list">
      ${items.map(({ battery, status }) => `
        <button class="battery-item" type="button" data-battery-id="${battery.id}">
          <span>
            <span class="battery-name">${escapeHtml(battery.name)}</span>
            <br>
            <span class="battery-meta">Seuil estimé : ${status.estimatedThresholdDate ?? "-"}</span>
          </span>
          <span>${formatStatus(status.status)}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderMeasurementHistory(measurements) {
  return measurements.slice(-5).reverse().map((measurement) => `
    <div class="history-item" data-measurement-id="${measurement.id}">
      <span>${measurement.date}</span>
      <strong>${measurement.levelPercent} %</strong>
    </div>
  `).join("");
}

function renderLedPreviewHtml(ledCount, behavior, sliderPosition) {
  const state = behavior === LED_BEHAVIORS.ADVANCED
    ? buildLedAdvancedState(ledCount, sliderPosition)
    : buildLedSimpleState(ledCount, sliderPosition);

  const leds = [];

  for (let index = 0; index < state.solid; index += 1) {
    leds.push(`<span class="led led-on"></span>`);
  }

  for (let index = 0; index < state.blinking; index += 1) {
    leds.push(`<span class="led led-blink"></span>`);
  }

  for (let index = 0; index < state.off; index += 1) {
    leds.push(`<span class="led led-off"></span>`);
  }

  return leds.join("");
}

function openModal(content) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        ${content}
      </div>
    </div>
  `;
}

export function closeModal() {
  modalRoot.innerHTML = "";
}

function formatStatus(status) {
  switch (status) {
    case STATUS.RED:
      return `<span class="badge badge-red">🔴 A recharger</span>`;
    case STATUS.ORANGE:
      return `<span class="badge badge-orange">🟠 A surveiller</span>`;
    case STATUS.GREEN:
      return `<span class="badge badge-green">🟢 OK</span>`;
    default:
      return `<span class="badge badge-gray">⚪ Non initialisée</span>`;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
