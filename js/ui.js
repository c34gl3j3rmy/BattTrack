import { modalOpened, modalClosed } from "./navigation.js";
import { renderControlSummary, renderControlDetails, renderUnifiedHistory, renderDropboxSettings } from "./ui/v2-sections.js";
import { BATTERY_INPUT_TYPES, INPUT_MODES, LED_BEHAVIORS, STATUS, THEMES, DASHBOARD_FILTERS } from "./constants.js";
import { buildLedAdvancedState, buildLedSimpleState, convertLedAdvancedToPercent, convertLedSimpleToPercent, getLedSliderPositionFromPercent, nowLocalDateTime } from "./measurement.js";
import { calculateMeasurementRates, formatRelativeDate, sortMeasurementsDescending, formatMeasurementDateTime } from "./calculation.js";

const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const pageTitle = document.querySelector("#page-title");

export function setPageTitle(title) {
  pageTitle.textContent = "BattTrack";
  document.title = title ? `BattTrack - ${stripEmoji(title)}` : "BattTrack";
}

export function setFabVisible(visible) {
  document.querySelector("#floating-action-button").hidden = !visible;
}

export function renderDashboard(items, settings, archivedCount, activeFilter, handlers) {
  setPageTitle("Tableau de bord");

  const active = items.filter(i => !i.battery.archived);
  const red = active.filter(i => i.status.status === STATUS.RED);
  const orange = active.filter(i => i.status.status === STATUS.ORANGE);
  const green = active.filter(i => i.status.status === STATUS.GREEN);
  const uninit = active.filter(i => i.status.status === STATUS.UNINITIALIZED);
  const filtered = filterItems(active, activeFilter);

  app.innerHTML = `
    <section class="card dashboard-summary">
      <h2>Tableau de bord</h2>
      <div class="status-row">
        ${renderSummaryButton(DASHBOARD_FILTERS.ALL, activeFilter, "badge-gray", `🔋 Actives : ${active.length}`)}
        ${renderSummaryButton(DASHBOARD_FILTERS.RED, activeFilter, "badge-red", `<img class="status-icon" src="assets/icons/status/critical.svg" alt=""> À recharger : ${red.length}`)}
        ${renderSummaryButton(DASHBOARD_FILTERS.ORANGE, activeFilter, "badge-orange", `<img class="status-icon" src="assets/icons/status/warning.svg" alt=""> À surveiller : ${orange.length}`)}
        ${renderSummaryButton(DASHBOARD_FILTERS.GREEN, activeFilter, "badge-green", `<img class="status-icon" src="assets/icons/status/ok.svg" alt=""> OK : ${green.length}`)}
        ${renderSummaryButton(DASHBOARD_FILTERS.UNINITIALIZED, activeFilter, "badge-gray", `<img class="status-icon" src="assets/icons/status/unknown.svg" alt=""> Non initialisée : ${uninit.length}`)}
        <button class="badge badge-gray summary-filter-button" type="button" data-open-archives>📦 Archivées : ${archivedCount}</button>
      </div>
    </section>

    ${renderControlSummary(active)}

    <section class="card">
      <div class="section-title-row">
        <h2>${batterySectionTitle(activeFilter)}</h2>
        ${activeFilter !== DASHBOARD_FILTERS.ALL ? `<button id="clear-dashboard-filter" class="button secondary-button compact-button" type="button">✕ Effacer</button>` : ""}
      </div>

      ${renderSortControl("dashboard-sort", settings.dashboardSort)}

      <label class="search-box">
        Rechercher
        <input id="battery-search" type="search" placeholder="DJI, laser, trottinette...">
      </label>

      <div id="battery-list-zone">
        ${filtered.length === 0 ? `<p class="empty-state">Aucune batterie dans ce filtre.</p>` : renderBatteryList(filtered)}
      </div>

      <div class="archives-link">
        <button id="open-archives" class="button secondary-button" type="button">📦 Archives (${archivedCount})</button>
      </div>
    </section>
  `;

  const zone = app.querySelector("#battery-list-zone");
  const search = app.querySelector("#battery-search");

  const bind = () => bindBatteryButtons(handlers.onOpenBattery);

  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    const searched = filtered.filter(i => searchBattery(i.battery, q));
    zone.innerHTML = searched.length ? renderBatteryList(searched) : `<p class="empty-state">Aucune batterie trouvée.</p>`;
    bind();
  });

  bind();
  bindSort("#dashboard-sort", handlers.onSortChange);

  app.querySelectorAll("[data-dashboard-filter]").forEach(button => {
    button.addEventListener("click", () => handlers.onFilterChange(button.dataset.dashboardFilter));
  });

  app.querySelectorAll("[data-open-archives]").forEach(button => {
    button.addEventListener("click", handlers.onArchives);
  });

  app.querySelector("#open-archives").onclick = handlers.onArchives;

  const clear = app.querySelector("#clear-dashboard-filter");
  if (clear) clear.onclick = () => handlers.onFilterChange(DASHBOARD_FILTERS.ALL);
}

export function renderArchivesPage(items, handlers) {
  setPageTitle("Archives");
  const archived = items.filter(i => i.battery.archived);

  app.innerHTML = `
    <div class="back-button-row">
      <button id="back-dashboard" class="back-button" type="button">← Tableau de bord</button>
    </div>
    <section class="card">
      <h2>📦 Archives (${archived.length})</h2>
      ${archived.length === 0 ? `<p class="empty-state">Aucune batterie archivée.</p>` : renderBatteryList(archived)}
    </section>
  `;

  app.querySelector("#back-dashboard").onclick = handlers.onBack;
  bindBatteryButtons(handlers.onOpenBattery);
}

export function renderBatteryDetails(battery, measurements, status, settings, handlers, usageEvents = []) {
  setPageTitle(battery.archived ? "Batterie archivée" : "Batterie");
  const measurementsWithRates = calculateMeasurementRates(measurements, usageEvents);
  const estimatedText = status.estimatedLevelIsAvailable ? `≈ ${status.estimatedLevelPercent} %` : (status.lastLevelPercent === null ? "?" : `${status.lastLevelPercent} %`);
  const levelLabel = status.estimatedLevelIsAvailable ? "Niveau actuel estimé" : "Dernier niveau mesuré";

  app.innerHTML = `
    <section class="card">
      <h2>${escapeHtml(battery.name)}</h2>
      ${battery.archived ? `<p><span class="badge badge-gray">📦 Archivée</span></p>` : ""}
      ${battery.notes ? `<p class="helper-text">${escapeHtml(battery.notes)}</p>` : ""}
    </section>

    <section class="card">
      <h3>Statut</h3>
      <p>${battery.archived ? `<span class="badge badge-gray">📦 Archivée</span>` : formatStatus(status.status)}</p>
      <p>${levelLabel} : <strong class="${statusClass(status.status)}">${estimatedText}</strong></p>
      ${!status.estimatedLevelIsAvailable ? `<p class="helper-text">Pas assez de mesures pour estimer l'autodécharge.</p>` : ""}
      <p>🔋 Dernière mesure : <strong>${status.lastLevelPercent ?? "-"} %</strong> (${formatRelativeDate(status.lastMeasurementDate)})</p>
      <p>📅 Recharge estimée : <strong>${status.estimatedThresholdDate ? formatRelativeDate(status.estimatedThresholdDate) : "Impossible à estimer pour le moment"}</strong></p>
      <p>🎯 Fiabilité de l'estimation : <strong>${status.confidence}</strong></p><p class="helper-text">${escapeHtml(status.confidenceReason ?? "")}</p>
    </section>

    <section class="card">
      <h3>Statistiques</h3>
      <p>📊 Mesures : <strong>${status.measurementCount}</strong></p>
      <p>🔄 Cycles : <strong>${status.cycleCount}</strong></p>
      <p>📉 Perte moyenne : <strong>${status.averageDischargePerDay === null ? "Pas assez de données" : `${status.averageDischargePerDay.toFixed(3)} %/jour`}</strong></p>
      ${renderMiniChart(measurements, settings)}
      <button id="csv-battery" class="button secondary-button" type="button">📊 Exporter les mesures CSV</button>
    </section>

    ${renderControlDetails(battery, status)}

    <section class="card">
      <h3>Historique</h3>
      ${renderUnifiedHistory(measurementsWithRates, usageEvents)}
    </section>
  `;

  app.querySelectorAll("[data-measurement-id]").forEach(row => row.addEventListener("click", () => handlers.onEditMeasurement(row.dataset.measurementId)));
  app.querySelectorAll("[data-usage-id]").forEach(row => row.addEventListener("click", () => handlers.onEditUsage?.(row.dataset.usageId)));
  app.querySelector("#accept-recommendation")?.addEventListener("click", handlers.onAcceptRecommendation);
  app.querySelector("#snooze-control")?.addEventListener("click", handlers.onSnoozeControl);
  app.querySelector("#csv-battery")?.addEventListener("click", handlers.onExportCsv);
}

export function openSettingsModal(settings, handlers) {
  openModal(`
    ${renderModalHeader("⚙️ Paramètres", "close-settings")}

    <div class="settings-grid">
      <section>
        <h3>Alertes</h3>
        <label>Seuil d'alerte (%)<input id="alert-threshold" type="number" inputmode="numeric" min="0" max="100" step="1" value="${escapeHtml(settings.alertThresholdPercent)}" required></label>
        <label>Seuil critique (%)<input id="critical-threshold" type="number" inputmode="numeric" min="0" max="100" step="1" value="${escapeHtml(settings.criticalThresholdPercent)}" required></label>
      </section>

      <section class="settings-section">
        <h3>Contrôles</h3>
        <label>Fréquence globale (jours)<input id="default-control-days" type="number" min="7" max="365" step="1" value="${escapeHtml(settings.defaultControlIntervalDays ?? 30)}"></label>
      </section>
      <section class="settings-section">
        <h3>Apparence</h3>
        <label>Thème
          <select id="theme-select">
            <option value="${THEMES.SYSTEM}">📱 Système</option>
            <option value="${THEMES.LIGHT}">☀️ Clair</option>
            <option value="${THEMES.DARK}">🌙 Sombre</option>
          </select>
        </label>
      </section>

      <section class="settings-section">
        <h3>Notifications</h3>
        <label class="checkbox-row">
          <input id="notifications-enabled" type="checkbox" ${settings.notificationsEnabled ? "checked" : ""}>
          <span>Activer les notifications locales</span>
        </label>
        <label class="checkbox-row">
          <input id="notify-critical" type="checkbox" ${settings.notifyOnCritical ? "checked" : ""}>
          <span>Me prévenir quand une batterie est à recharger</span>
        </label>
        <p class="helper-text">Les notifications sont vérifiées au lancement de l'application et après les changements de données.</p>
      </section>

      <section class="settings-section">
        <h3>Application</h3>
        <button id="check-update-button" class="button secondary-button" type="button">🔄 Vérifier mise à jour</button>
      </section>

      <section class="settings-section">
        <h3>Données</h3>
        <p class="helper-text">Dernier export : <strong>${settings.lastExportAt ? formatRelativeDate(settings.lastExportAt.slice(0, 10)) : "jamais"}</strong></p>
        <div class="action-row">
          <button id="export-json" class="button secondary-button" type="button">📤 Exporter JSON</button>
          <button id="export-csv" class="button secondary-button" type="button">📊 Exporter CSV</button>
          <label class="button secondary-button">📥 Importer JSON<input id="import-json-input" type="file" accept="application/json" hidden></label>
        </div>
      </section>

      ${renderDropboxSettings(handlers.syncStatus ?? {status:"local"}, handlers.dropboxConnected, handlers.dropboxKey ?? "")}

      <section class="settings-section">
        <h3>À propos</h3>
        <button id="about-button" class="button secondary-button" type="button">ℹ️ Voir</button>
      </section>
    </div>
  `);

  modalRoot.querySelector("#close-settings").onclick = closeModal;

  const themeSelect = modalRoot.querySelector("#theme-select");
  themeSelect.value = settings.theme;

  const buildUpdates = () => ({
    alertThresholdPercent: Number(modalRoot.querySelector("#alert-threshold").value),
    defaultControlIntervalDays: Number(modalRoot.querySelector("#default-control-days").value),
    criticalThresholdPercent: Number(modalRoot.querySelector("#critical-threshold").value),
    theme: themeSelect.value,
    notificationsEnabled: modalRoot.querySelector("#notifications-enabled").checked,
    notifyOnCritical: modalRoot.querySelector("#notify-critical").checked
  });

  modalRoot.querySelector("#default-control-days").addEventListener("change", () => handlers.onSave(buildUpdates()));
  modalRoot.querySelector("#alert-threshold").addEventListener("change", () => handlers.onSave(buildUpdates()));
  modalRoot.querySelector("#critical-threshold").addEventListener("change", () => handlers.onSave(buildUpdates()));
  themeSelect.addEventListener("change", () => handlers.onSave(buildUpdates()));
  modalRoot.querySelector("#notifications-enabled").addEventListener("change", () => handlers.onSave(buildUpdates()));
  modalRoot.querySelector("#notify-critical").addEventListener("change", () => handlers.onSave(buildUpdates()));

  modalRoot.querySelector("#check-update-button").onclick = handlers.onCheckUpdate;
  modalRoot.querySelector("#export-json").onclick = handlers.onExportJson;
  modalRoot.querySelector("#import-json-input").onchange = e => handlers.onImportJson(e.target.files?.[0]);
  modalRoot.querySelector("#about-button").onclick = () => openAboutModal();
  modalRoot.querySelector("#dropbox-connect")?.addEventListener("click", () => handlers.onDropboxConnect(modalRoot.querySelector("#dropbox-appkey").value));
  modalRoot.querySelector("#dropbox-disconnect")?.addEventListener("click", handlers.onDropboxDisconnect);
  modalRoot.querySelector("#dropbox-sync")?.addEventListener("click", handlers.onDropboxSync);
  modalRoot.querySelector("#dropbox-backup")?.addEventListener("click", handlers.onDropboxBackup);
  modalRoot.querySelector("#dropbox-restore")?.addEventListener("click", handlers.onDropboxRestore);
  modalRoot.querySelector("#export-csv")?.addEventListener("click", handlers.onExportCsv);
}

export function openAboutModal() {
  openModal(`
    ${renderModalHeader("BattTrack", "close-about")}

    <p><strong>Version : ${window.battTrackVersionInfo?.version ?? "-"}</strong></p>

    <p class="about-text">
      🔋 Suivez vos batteries.<br>
      📈 Estimez leur autodécharge.<br>
      🛡️ Évitez les décharges profondes.
    </p>

    <p class="about-text">
      BattTrack aide à éviter les décharges profondes des batteries rarement utilisées en estimant leur autodécharge et en affichant un statut visuel.
    </p>

    <p>Développé par <strong>Jérémy Le Gac</strong>.</p>

    <h3>Code source</h3>
    <p>
      <a href="https://github.com/c34gl3j3rmy/BattTrack" target="_blank" rel="noopener noreferrer">Voir le projet GitHub</a>
    </p>

    <div class="action-row">
      <a class="button secondary-button" href="https://github.com/c34gl3j3rmy/BattTrack/issues/new?labels=bug" target="_blank" rel="noopener noreferrer">🐛 Signaler un bug</a>
      <a class="button secondary-button" href="https://github.com/c34gl3j3rmy/BattTrack/issues/new?labels=enhancement" target="_blank" rel="noopener noreferrer">💡 Proposer une amélioration</a>
    </div>

    <h3>Licence</h3>
    <p>Code source disponible sur GitHub.<br><strong>Tous droits réservés.</strong></p>
  `);

  modalRoot.querySelector("#close-about").onclick = closeModal;
}

export function openUpdateAvailableModal(versionInfo, handlers) {
  const changes = Array.isArray(versionInfo.changes) ? versionInfo.changes.slice(0, 5) : [];

  openModal(`
    ${renderModalHeader("🆕 Mise à jour disponible", "close-update")}
    <p><strong>Version ${escapeHtml(versionInfo.version)}</strong></p>
    ${versionInfo.title ? `<p>${escapeHtml(versionInfo.title)}</p>` : ""}
    ${changes.length ? `<ul class="update-list">${changes.map(change => `<li>${escapeHtml(change)}</li>`).join("")}</ul>` : ""}
    <div class="action-row">
      <button id="apply-update-button" class="button" type="button">🔄 Mettre à jour maintenant</button>
      <button id="later-update-button" class="button secondary-button" type="button">⏳ Plus tard</button>
    </div>
  `);

  modalRoot.querySelector("#close-update").onclick = closeModal;
  modalRoot.querySelector("#later-update-button").onclick = closeModal;
  modalRoot.querySelector("#apply-update-button").onclick = handlers.onApplyUpdate;
}

export function openDashboardActionModal(handlers) {
  openModal(`
    ${renderModalHeader("Action rapide", "close-action")}
    <div class="action-column">
      <button id="quick-add-measurement" class="button" type="button">📈 Ajouter une mesure</button>
      <button id="quick-charge" class="button secondary-button" type="button">🔋 Rechargé à 100 %</button>
      <button id="quick-create-battery" class="button secondary-button" type="button">➕ Créer une batterie</button>
    </div>
  `);

  modalRoot.querySelector("#close-action").onclick = closeModal;
  modalRoot.querySelector("#quick-add-measurement").onclick = handlers.onAddMeasurement;
  modalRoot.querySelector("#quick-charge").onclick = handlers.onQuickCharge;
  modalRoot.querySelector("#quick-create-battery").onclick = handlers.onCreateBattery;
}

export function openQuickMeasurementPicker(items, handlers, title = "Ajouter une mesure") {
  const active = items.filter(i => !i.battery.archived);

  openModal(`
    ${renderModalHeader(title, "close-picker")}
    <label class="search-box">Rechercher<input id="battery-search" type="search" placeholder="DJI, laser, trottinette..."></label>
    <div id="quick-battery-list">${renderQuickBatteryList(active)}</div>
  `);

  modalRoot.querySelector("#close-picker").onclick = closeModal;

  const search = modalRoot.querySelector("#battery-search");
  const list = modalRoot.querySelector("#quick-battery-list");

  const bind = () => list.querySelectorAll("[data-battery-id]").forEach(btn => btn.addEventListener("click", () => handlers.onSelectBattery(active.find(i => i.battery.id === btn.dataset.batteryId).battery)));

  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    list.innerHTML = renderQuickBatteryList(active.filter(i => searchBattery(i.battery, q)));
    bind();
  });

  bind();
}

export function openBatteryActionModal(battery, handlers) {
  const isArchived = battery.archived;

  openModal(`
    ${renderModalHeader(escapeHtml(battery.name), "close-battery-action")}
    <div class="action-column">
      ${isArchived ? `<button id="restore-battery" class="button" type="button">↩️ Restaurer</button><button id="delete-battery" class="button danger-button" type="button">🗑️ Supprimer définitivement</button>` : `<button id="add-measurement" class="button" type="button">📈 Ajouter une mesure</button><button id="add-charge" class="button secondary-button" type="button">🔋 Rechargé à 100 %</button><button id="add-usage" class="button secondary-button" type="button">🛠️ Signaler une utilisation</button><button id="edit-battery" class="button secondary-button" type="button">✏️ Modifier la batterie</button><button id="archive-battery" class="button warning-button" type="button">📦 Archiver la batterie</button>`}
    </div>
  `);

  modalRoot.querySelector("#close-battery-action").onclick = closeModal;

  if (isArchived) {
    modalRoot.querySelector("#restore-battery").onclick = handlers.onRestore;
    modalRoot.querySelector("#delete-battery").onclick = handlers.onDelete;
  } else {
    modalRoot.querySelector("#add-measurement").onclick = handlers.onAddMeasurement;
    modalRoot.querySelector("#add-charge").onclick = handlers.onAddCharge;
    modalRoot.querySelector("#add-usage").onclick = handlers.onAddUsage;
    modalRoot.querySelector("#edit-battery").onclick = handlers.onEdit;
    modalRoot.querySelector("#archive-battery").onclick = handlers.onArchive;
  }
}

export function openArchivesDeletePicker(items, handlers) {
  const archived = items.filter(i => i.battery.archived);

  openModal(`
    ${renderModalHeader("Supprimer définitivement", "close-archive-delete")}
    ${archived.length === 0 ? `<p class="empty-state">Aucune batterie archivée.</p>` : renderQuickBatteryList(archived)}
  `);

  modalRoot.querySelector("#close-archive-delete").onclick = closeModal;
  modalRoot.querySelectorAll("[data-battery-id]").forEach(btn => btn.addEventListener("click", () => handlers.onDeleteBattery(btn.dataset.batteryId)));
}

export function openBatteryFormModal(handlers, battery = null) {
  const inputType = battery?.inputType ?? inputTypeFromBattery(battery);

  openModal(`
    ${renderModalHeader(battery ? "Modifier batterie" : "Créer batterie", "close-battery-form")}
    <form id="battery-form" class="form-grid">
      <label>Nom<input name="name" type="text" value="${escapeHtml(battery?.name ?? "")}" required></label>
      <label>Mode de saisie<select name="inputType"><option value="percentage">Pourcentage</option><option value="led_simple">LEDs fixes</option><option value="led_advanced">LEDs fixes + clignotantes</option></select></label>
      <div id="led-config-section"><label>Configuration LEDs<div id="led-config-preview" class="led-preview"></div><input id="led-count-slider" name="ledCount" type="range" min="2" max="6" step="1" value="${battery?.ledConfig?.ledCount ?? 4}"><span class="helper-text"><span id="led-count-label">${battery?.ledConfig?.ledCount ?? 4}</span> LEDs</span></label></div>
      <label>Chimie<select name="chemistry"><option value="unknown">Autre / Je ne sais pas</option><option value="liion">Li-ion</option><option value="lipo">LiPo</option><option value="nimh">NiMH</option><option value="lead">Plomb</option></select></label>
      <label>Marque / modèle (facultatif)<input name="brandModel" type="text" value="${escapeHtml(battery?.brandModel ?? "")}"></label>
      <label>Stockage<select name="storageCondition"><option value="normal">Normal</option><option value="warm">Environnement chaud</option></select></label>
      <label>Fréquence personnalisée (jours, vide = fréquence globale)<input name="controlIntervalDays" type="number" min="7" max="365" step="1" value="${battery?.controlIntervalDays ?? ""}"></label>
      <label>Notes<textarea name="notes">${escapeHtml(battery?.notes ?? "")}</textarea></label>
      <div class="action-row"><button class="button" type="submit">💾 Enregistrer</button></div>
    </form>
  `);

  modalRoot.querySelector("#close-battery-form").onclick = closeModal;

  const form = modalRoot.querySelector("#battery-form");
  const section = modalRoot.querySelector("#led-config-section");
  const slider = modalRoot.querySelector("#led-count-slider");
  const preview = modalRoot.querySelector("#led-config-preview");
  const label = modalRoot.querySelector("#led-count-label");

  form.inputType.value = inputType;
  form.querySelector("[name=chemistry]").value = battery?.chemistry ?? "unknown";
  form.querySelector("[name=storageCondition]").value = battery?.storageCondition ?? "normal";

  const update = () => {
    const type = form.inputType.value;
    const isLed = type !== BATTERY_INPUT_TYPES.PERCENTAGE;
    section.hidden = !isLed;
    if (!isLed) return;
    const count = Number(slider.value);
    const behavior = type === BATTERY_INPUT_TYPES.LED_ADVANCED ? LED_BEHAVIORS.ADVANCED : LED_BEHAVIORS.SIMPLE;
    label.textContent = String(count);
    const pos = behavior === LED_BEHAVIORS.ADVANCED ? count * 2 - 1 : Math.max(1, count - 1);
    preview.innerHTML = renderLedPreviewHtml(count, behavior, pos);
  };

  form.inputType.onchange = update;
  slider.oninput = update;
  update();

  form.onsubmit = async e => {
    e.preventDefault();
    const data = new FormData(form);
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    const savedInputType = data.get("inputType");
    const isLed = savedInputType !== BATTERY_INPUT_TYPES.PERCENTAGE;
    try {
      await handlers.onSave({
      name: data.get("name"),
      inputType: savedInputType,
      ledConfig: isLed ? {
        ledCount: Number(data.get("ledCount")),
        behavior: savedInputType === BATTERY_INPUT_TYPES.LED_ADVANCED ? LED_BEHAVIORS.ADVANCED : LED_BEHAVIORS.SIMPLE
      } : null,
      chemistry: data.get("chemistry"),
      brandModel: data.get("brandModel"),
      storageCondition: data.get("storageCondition"),
      controlIntervalDays: data.get("controlIntervalDays") ? Number(data.get("controlIntervalDays")) : null,
      notes: data.get("notes")
      });
      closeModal(true);
    } catch (error) {
      submit.disabled = false;
      alert(error?.message ?? String(error));
    }
  };

}

export function openAddMeasurementModal(battery, handlers, existingMeasurement = null) {
  const isLed = battery.preferredInputMode === INPUT_MODES.LED && battery.ledConfig;
  const ledCount = battery.ledConfig?.ledCount ?? existingMeasurement?.observation?.ledCount ?? 4;
  const behavior = battery.ledConfig?.behavior ?? existingMeasurement?.observation?.behavior ?? LED_BEHAVIORS.SIMPLE;
  const maxPosition = behavior === LED_BEHAVIORS.ADVANCED ? ledCount * 2 : ledCount;
  const initialPosition = existingMeasurement?.observation?.sliderPosition ?? maxPosition;
  const initialPercent = existingMeasurement?.levelPercent ?? (behavior === LED_BEHAVIORS.ADVANCED ? convertLedAdvancedToPercent(ledCount, initialPosition) : convertLedSimpleToPercent(ledCount, initialPosition));
  const initialMeasuredAt = existingMeasurement?.measuredAt ?? nowLocalDateTime();

  openModal(`
    ${renderModalHeader(existingMeasurement ? "Modifier mesure" : "Ajouter mesure", "close-measurement-form")}
    <form id="measurement-form" class="form-grid">
      <label>Date et heure<input name="measuredAt" type="datetime-local" value="${initialMeasuredAt}" required></label>
      ${isLed ? `<div><div id="led-preview" class="led-preview"></div><input id="led-slider" name="sliderPosition" type="range" min="0" max="${maxPosition}" step="1" value="${initialPosition}"></div>` : ""}
      <label>Pourcentage<input name="levelPercent" type="number" inputmode="numeric" min="0" max="100" step="1" value="${initialPercent}" required></label>
      <label class="checkbox-row"><input name="excludeFromPrevious" type="checkbox" ${existingMeasurement?.excludeFromPrevious ? "checked" : ""}><span>Batterie utilisée depuis la dernière mesure</span></label>
      <div class="action-row"><button class="button" type="submit">💾 Enregistrer</button>${existingMeasurement ? `<button id="delete-measurement" class="button danger-button" type="button">🗑️ Supprimer</button>` : ""}</div>
    </form>
  `);

  modalRoot.querySelector("#close-measurement-form").onclick = closeModal;

  const form = modalRoot.querySelector("#measurement-form");
  const slider = modalRoot.querySelector("#led-slider");
  const preview = modalRoot.querySelector("#led-preview");

  if (slider && preview) {
    const updatePreviewOnly = () => {
      const pos = Number(slider.value);
      const percent = Number(form.levelPercent.value);
      preview.innerHTML = `${renderLedPreviewHtml(ledCount, behavior, pos)} <span class="led-preview-text">(${Number.isNaN(percent) ? "-" : percent} %)</span>`;
    };

    slider.oninput = () => {
      const pos = Number(slider.value);
      form.levelPercent.value = behavior === LED_BEHAVIORS.ADVANCED ? convertLedAdvancedToPercent(ledCount, pos) : convertLedSimpleToPercent(ledCount, pos);
      updatePreviewOnly();
    };

    form.levelPercent.oninput = () => {
      slider.value = String(getLedSliderPositionFromPercent(Number(form.levelPercent.value), ledCount, behavior));
      updatePreviewOnly();
    };

    updatePreviewOnly();
  }

  form.onsubmit = async e => {
    e.preventDefault();
    const data = new FormData(form);
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      await handlers.onSave({
      measuredAt: data.get("measuredAt"),
      levelPercent: Number(data.get("levelPercent")),
      sliderPosition: slider ? Number(data.get("sliderPosition")) : null,
      existingMeasurement,
      excludeFromPrevious: data.has("excludeFromPrevious")
      });
      closeModal(true);
    } catch(error) {
      submit.disabled = false;
      alert(error?.message ?? String(error));
    }
  };

  if (existingMeasurement) {
    modalRoot.querySelector("#delete-measurement").onclick = () => handlers.onDelete(existingMeasurement);
  }

}

export function openUsageEventModal(handlers, existing = null) {
  openModal(`
    ${renderModalHeader(existing ? "Modifier l'utilisation" : "Signaler une utilisation", "close-usage")}
    <form id="usage-form" class="form-grid">
      <label>Date et heure<input name="usedAt" type="datetime-local" value="${escapeHtml(existing?.usedAt ?? nowLocalDateTime())}" required></label>
      <label>Note (facultative)<textarea name="note">${escapeHtml(existing?.note ?? "")}</textarea></label>
      <div class="action-row"><button class="button" type="submit">💾 Enregistrer</button>${existing ? `<button class="button danger-button" id="delete-usage" type="button">🗑️ Supprimer</button>` : ""}</div>
    </form>`);
  modalRoot.querySelector("#close-usage").onclick=closeModal;
  modalRoot.querySelector("#usage-form").onsubmit=async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    const data=new FormData(form);
    const submit=form.querySelector('[type="submit"]');
    submit.disabled=true;
    try {
      await handlers.onSave({usedAt:data.get("usedAt"),note:data.get("note")});
      closeModal(true);
    } catch(error) {
      submit.disabled=false;
      alert(error?.message??String(error));
    }
  };
  modalRoot.querySelector("#delete-usage")?.addEventListener("click",()=>handlers.onDelete(existing));
}

export function openRestorePreviewModal(preview,handlers) {
  openModal(`${renderModalHeader("Restaurer les données", "close-restore")}
    <p>Cette sauvegarde contient <strong>${preview.batteries} batteries</strong>, <strong>${preview.measurements} mesures</strong> et <strong>${preview.usageEvents} utilisations</strong>.</p>
    <p class="helper-text">Date : ${escapeHtml(preview.exportedAt ?? "inconnue")}. Une copie locale sera téléchargée avant l'opération.</p>
    <div class="action-column"><button id="restore-merge" class="button" type="button">🔀 Fusionner les données</button><button id="restore-replace" class="button warning-button" type="button">↺ Remplacer les données locales</button></div>`);
  modalRoot.querySelector("#close-restore").onclick=closeModal;
  modalRoot.querySelector("#restore-merge").onclick=handlers.onMerge;
  modalRoot.querySelector("#restore-replace").onclick=handlers.onReplace;
}
export function openConflictsModal(conflicts, handlers) {
  openModal(`${renderModalHeader("Résoudre les conflits", "close-conflicts")}
    <p class="helper-text">Deux appareils ou sauvegardes ont modifié les mêmes éléments. Choisir la version à conserver pour chaque conflit.</p>
    <form id="conflicts-form" class="form-grid">
      ${conflicts.map((x,i)=>`<fieldset class="conflict-choice"><legend>${escapeHtml(x.name??x.id??x.key)}</legend><label class="checkbox-row"><input type="radio" name="conflict-${i}" value="local" checked>Garder ma version</label><label class="checkbox-row"><input type="radio" name="conflict-${i}" value="remote">Garder Dropbox / sauvegarde</label></fieldset>`).join("")}
      <button class="button" type="submit">✓ Appliquer mes choix</button>
    </form>`);
  modalRoot.querySelector("#close-conflicts").onclick=closeModal;
  modalRoot.querySelector("#conflicts-form").onsubmit=e=>{
    e.preventDefault();
    const formData=new FormData(e.currentTarget), decisions={};
    conflicts.forEach((x,i)=>decisions[x.key]=formData.get(`conflict-${i}`));
    handlers.onResolve(decisions);
  };
}
export function openDropboxBackupsModal(entries, handlers) {
  openModal(`${renderModalHeader("Sauvegardes Dropbox", "close-backups")}
    <div class="action-column">${entries.length ? entries.slice(0,30).map((entry,i)=>`<button class="button secondary-button" type="button" data-backup-index="${i}">📂 ${escapeHtml(entry.name)}</button>`).join("") : `<p class="helper-text">Aucune sauvegarde de récupération.</p>`}</div>`);
  modalRoot.querySelector("#close-backups").onclick=closeModal;
  modalRoot.querySelectorAll("[data-backup-index]").forEach(btn=>btn.onclick=()=>handlers.onSelect(entries[Number(btn.dataset.backupIndex)]));
}

export function closeModal(fromHistory = false) {
  if (!modalRoot.firstChild) return;
  modalRoot.innerHTML = "";
  document.body.classList.remove("modal-open");
  modalClosed(fromHistory);
}

function renderSummaryButton(filter, activeFilter, badgeClass, content) {
  return `<button class="badge ${badgeClass} summary-filter-button ${activeFilter === filter ? "active" : ""}" type="button" data-dashboard-filter="${filter}">${content}</button>`;
}

function filterItems(items, activeFilter) {
  if (!activeFilter || activeFilter === DASHBOARD_FILTERS.ALL) return items;
  return items.filter(i => i.status.status === activeFilter);
}

function batterySectionTitle(activeFilter) {
  switch (activeFilter) {
    case DASHBOARD_FILTERS.RED:
      return "Batteries - À recharger";
    case DASHBOARD_FILTERS.ORANGE:
      return "Batteries - À surveiller";
    case DASHBOARD_FILTERS.GREEN:
      return "Batteries - OK";
    case DASHBOARD_FILTERS.UNINITIALIZED:
      return "Batteries - Non initialisées";
    default:
      return "Batteries";
  }
}

function renderModalHeader(title, closeId) {
  return `<div class="modal-header"><h2>${title}</h2><button id="${closeId}" class="modal-close-button" type="button" aria-label="Fermer">✕</button></div>`;
}

function renderSortControl(id, value) {
  return `<div class="sort-row"><label>Trier par <select id="${id}" data-current="${value}"><option value="urgency">Urgence</option><option value="name">Nom</option><option value="estimatedLevel">≈ % restant</option><option value="lastMeasurement">Dernière mesure</option><option value="lastCharge">Dernière recharge</option><option value="status">Statut</option></select></label></div>`;
}

function bindSort(selector, handler) {
  const select = app.querySelector(selector);
  select.value = select.dataset.current;
  select.onchange = () => handler(select.value);
}

function bindBatteryButtons(handler) {
  app.querySelectorAll("[data-battery-id]").forEach(btn => btn.addEventListener("click", () => handler(btn.dataset.batteryId)));
}

function renderBatteryList(items) {
  return `<div class="battery-list">${items.map(({ battery, status }) => renderBatteryCard(battery, status)).join("")}</div>`;
}

function renderBatteryCard(battery, status) {
  const estimatedText = status.estimatedLevelIsAvailable ? `≈ ${status.estimatedLevelPercent} %` : (status.lastLevelPercent === null ? "?" : `${status.lastLevelPercent} %`);
  const relative = status.lastMeasurementDate ? formatRelativeDate(status.lastMeasurementDate) : "";
  const lineOne = relative ? `${estimatedText} <small>• ${relative}</small>` : estimatedText;
  const lastMeasure = status.lastLevelPercent === null || status.lastLevelPercent === undefined ? "-" : `${status.lastLevelPercent} %`;
  const measured = status.lastMeasurementDate ? `Mesurée ${formatRelativeDate(status.lastMeasurementDate)}` : "Aucune mesure";
  const className = statusClass(status.status);

  return `
    <button class="battery-card" type="button" data-battery-id="${escapeHtml(battery.id)}">
      <span class="battery-card-main">
        <span class="battery-card-name">${escapeHtml(battery.name)}</span>
        <span class="battery-card-estimate ${className}">${lineOne}</span>
        <span class="battery-card-info">Dernière mesure : ${lastMeasure}<br>${measured}</span>
      </span>
      <span class="battery-card-side">
        ${renderBatteryLevelIcon(status)}
        ${battery.archived ? `<span class="badge badge-gray">Archivée</span>` : formatStatus(status.status)}
      </span>
    </button>
  `;
}

function renderQuickBatteryList(items) {
  if (items.length === 0) return `<p class="empty-state">Aucune batterie trouvée.</p>`;
  return renderBatteryList(items);
}

function renderMeasurementHistory(measurementsWithRates) {
  const visible = sortMeasurementsDescending(measurementsWithRates).slice(0, 10);

  return `${visible.map(m => `<div class="history-item" data-measurement-id="${m.id}"><span>${formatMeasurementDateTime(m)}</span><strong>${m.levelPercent} %</strong><span class="history-rate">${m.rateLabel}</span></div>`).join("")}${measurementsWithRates.length > 10 ? `<p class="helper-text">10 dernières mesures affichées.</p>` : ""}`;
}

function renderLedPreviewHtml(ledCount, behavior, sliderPosition) {
  const state = behavior === LED_BEHAVIORS.ADVANCED ? buildLedAdvancedState(ledCount, sliderPosition) : buildLedSimpleState(ledCount, sliderPosition);
  const leds = [];
  for (let i = 0; i < state.solid; i++) leds.push(`<span class="led led-on"></span>`);
  for (let i = 0; i < state.blinking; i++) leds.push(`<span class="led led-blink"></span>`);
  for (let i = 0; i < state.off; i++) leds.push(`<span class="led led-off"></span>`);
  return leds.join("");
}

function renderBatteryLevelIcon(status) {
  const rawLevel = status.estimatedLevelIsAvailable ? status.estimatedLevelPercent : (status.lastLevelPercent ?? 0);
  const level = Math.max(0, Math.min(100, rawLevel));
  const visibleLevel = level > 0 ? Math.max(level, 8) : 0;

  const innerX = 12.5;
  const innerY = 20;
  const innerW = 23;
  const innerH = 41;

  const fillH = innerH * visibleLevel / 100;
  const fillY = innerY + innerH - fillH;
  const className = statusClass(status.status);

  return `
    <svg class="battery-level-icon ${className}" viewBox="0 0 48 72" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect class="battery-outline" x="14" y="8" width="20" height="8" rx="3" fill="none" stroke-width="3"/>
      <rect class="battery-outline" x="10" y="16" width="28" height="48" rx="5" fill="none" stroke-width="3"/>
      <rect class="battery-fill" x="${innerX}" y="${fillY.toFixed(1)}" width="${innerW}" height="${fillH.toFixed(1)}" rx="2"/>
    </svg>
  `;
}

function renderMiniChart(measurements, settings) {
  const points = [...measurements]
    .filter(m => typeof m.levelPercent === "number")
    .sort((a, b) => (a.measuredAt ?? `${a.date}T00:00`).localeCompare(b.measuredAt ?? `${b.date}T00:00`))
    .slice(-12);

  if (points.length < 2) {
    return `<p class="helper-text">Mini graphique disponible après au moins 2 mesures.</p>`;
  }

  const width = 340;
  const height = 110;
  const labelW = 38;
  const padding = 8;
  const chartX = labelW;
  const chartW = width - labelW - padding;

  const first = new Date(`${(points[0].measuredAt ?? `${points[0].date}T00:00`)}`);
  const last = new Date(`${(points.at(-1).measuredAt ?? `${points.at(-1).date}T00:00`)}`);
  const rangeMs = Math.max(1, last - first);

  const yFor = level => padding + ((100 - level) / 100) * (height - padding * 2);
  const colorFor = level => {
    if (level <= settings.criticalThresholdPercent) return "var(--danger)";
    if (level <= settings.alertThresholdPercent) return "var(--warning)";
    return "var(--success)";
  };

  const coords = points.map(point => {
    const date = new Date(`${(point.measuredAt ?? `${point.date}T00:00`)}`);
    const x = chartX + ((date - first) / rangeMs) * chartW;
    const y = yFor(point.levelPercent);
    return { x, y, level: point.levelPercent, label: formatMeasurementDateTime(point) };
  });

  const segments = [];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const color = colorFor(b.level);
    segments.push(`<line class="mini-chart-segment" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${color}"><title>${b.label} - ${b.level} %</title></line>`);
  }

  return `
    <svg class="mini-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Évolution récente du niveau de batterie">
      ${[100, 50, 0].map(level => `
        <text class="mini-chart-label" x="0" y="${(yFor(level) + 5).toFixed(1)}">${level} %</text>
        <line class="mini-chart-grid" x1="${chartX}" y1="${yFor(level).toFixed(1)}" x2="${width - padding}" y2="${yFor(level).toFixed(1)}"/>
      `).join("")}
      ${segments.join("")}
      ${coords.map(p => `<circle class="mini-chart-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${colorFor(p.level)}"><title>${p.label} - ${p.level} %</title></circle>`).join("")}
    </svg>
  `;
}

function inputTypeFromBattery(battery) {
  if (!battery) return BATTERY_INPUT_TYPES.PERCENTAGE;
  if (battery.inputType) return battery.inputType;
  if (battery.ledConfig?.behavior === LED_BEHAVIORS.ADVANCED) return BATTERY_INPUT_TYPES.LED_ADVANCED;
  if (battery.ledConfig) return BATTERY_INPUT_TYPES.LED_SIMPLE;
  return BATTERY_INPUT_TYPES.PERCENTAGE;
}

function formatStatus(status) {
  switch (status) {
    case STATUS.RED:
      return `<span class="badge badge-red"><img class="status-icon" src="assets/icons/status/critical.svg" alt=""> À recharger</span>`;
    case STATUS.ORANGE:
      return `<span class="badge badge-orange"><img class="status-icon" src="assets/icons/status/warning.svg" alt=""> À surveiller</span>`;
    case STATUS.GREEN:
      return `<span class="badge badge-green"><img class="status-icon" src="assets/icons/status/ok.svg" alt=""> OK</span>`;
    default:
      return `<span class="badge badge-gray"><img class="status-icon" src="assets/icons/status/unknown.svg" alt=""> Non initialisée</span>`;
  }
}

function statusClass(status) {
  switch (status) {
    case STATUS.RED:
      return "value-red";
    case STATUS.ORANGE:
      return "value-orange";
    case STATUS.GREEN:
      return "value-green";
    default:
      return "value-gray";
  }
}

function openModal(content) {
  modalOpened();
  document.body.classList.add("modal-open");
  modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal">${content}</div></div>`;
}

function escapeHtml(value) {
  return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function stripEmoji(value) {
  return String(value).replace(/[^\p{L}\p{N}\s\-]/gu, "").trim();
}
