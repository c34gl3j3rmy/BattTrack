import { formatRelativeDate, formatMeasurementDateTime, sortMeasurementsDescending } from "../calculation.js";
export function escape(value) { return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
export function renderControlSummary(items) {
  const due=items.filter(x=>!x.battery.archived&&x.status.nextControl?.reminderVisible);
  const postponed=items.filter(x=>!x.battery.archived&&x.status.nextControl?.snoozedUntil);
  const future=items.filter(x=>!x.battery.archived&&x.status.nextControl?.date&&!x.status.nextControl.due).sort((a,b)=>a.status.nextControl.date.localeCompare(b.status.nextControl.date));
  return `<section class="card control-overview"><h3>Contrôles</h3><div class="v2-metrics"><span><strong>${due.length}</strong> à contrôler</span><span><strong>${future.length}</strong> à venir</span></div>
  ${due.length?`<p class="helper-text">À contrôler : ${due.slice(0,3).map(x=>escape(x.battery.name)).join(", ")}${due.length>3?"…":""}</p>`:""}
  ${postponed.length?`<p class="helper-text">Rappels reportés : ${postponed.length}</p>`:""}
  ${future[0]?`<p class="helper-text">Prochain contrôle : <strong>${escape(future[0].battery.name)}</strong> (${formatRelativeDate(future[0].status.nextControl.date)})</p>`:""}</section>`;
}
export function renderControlDetails(battery,status) {
  const r=status.recommendation;
  const next=status.nextControl;
  return `<section class="card"><h3>Suivi et contrôles</h3>
    <p>Chimie : <strong>${escape(({lipo:"LiPo",liion:"Li-ion",nimh:"NiMH",lead:"Plomb",unknown:"Autre / inconnue"})[battery.chemistry]||"Autre / inconnue")}</strong></p>
    <p>Fréquence appliquée : <strong>${r.chosenDays} jours</strong></p>
    <p>Fréquence conseillée : <strong>${r.days} jours</strong></p><p class="helper-text">${escape(r.reason)}</p>
    ${r.differs&&!battery.archived?`<button id="accept-recommendation" class="button secondary-button" type="button">✓ Adopter ${r.days} jours</button>`:""}
    <p>Prochain contrôle : <strong>${next.date?`${formatRelativeDate(next.date)} (${escape(next.date)})`:"Après une première mesure"}</strong></p>
    <p class="helper-text">${escape(next.reason)}</p>
    ${next.snoozedUntil?`<p class="helper-text">Rappel reporté jusqu'au ${escape(next.snoozedUntil)}. L'échéance réelle n'est pas modifiée.</p>`:""}
    ${next.due&&!next.snoozedUntil&&!battery.archived?`<button id="snooze-control" class="button secondary-button" type="button">⏱ Reporter le rappel de 7 jours</button>`:""}
    <p>Tendance : <strong>${escape(status.trend)}</strong></p>
  </section>`;
}
export function renderUnifiedHistory(measurements,usageEvents) {
  const events=[...measurements.map(x=>({...x,kind:"measurement",at:x.measuredAt??`${x.date}T00:00`})),...usageEvents.map(x=>({...x,kind:"usage",at:x.usedAt}))].sort((a,b)=>b.at.localeCompare(a.at));
  if(!events.length)return `<p class="empty-state">Aucun événement.</p>`;
  return events.slice(0,15).map(item=>item.kind==="usage"
    ?`<button class="history-item v2-history-button" type="button" data-usage-id="${escape(item.id)}"><span>${escape(formatMeasurementDateTime({measuredAt:item.usedAt}))}<small> · Utilisation</small></span><strong>Utilisée</strong><span class="history-rate">${escape(item.note||"Modifier")}</span></button>`
    :`<button class="history-item v2-history-button ${item.excludeFromPrevious?"measurement-flagged":""}" type="button" data-measurement-id="${escape(item.id)}"><span>${escape(formatMeasurementDateTime(item))}<small> · ${item.type==="charge"?"Recharge":"Mesure"}</small></span><strong>${Number(item.levelPercent)} %</strong><span class="history-rate">${item.rateLabel??"-"}</span></button>`).join("")+(events.length>15?`<p class="helper-text">15 derniers événements affichés.</p>`:"");
}
export function renderDropboxSettings(status,connected) {
  const labels={local:"Local uniquement",idle:"Connexion active",pending:"Modifications en attente",offline:"Hors ligne",syncing:"Synchronisation en cours",synced:"À jour",conflict:"Conflit à résoudre",error:"Échec de synchronisation"};
  return `<section class="settings-section"><h3>Dropbox</h3><p class="helper-text">État : <strong id="dropbox-status">${escape(labels[status.status]??"Non connecté")}</strong></p>
    <p class="helper-text" id="dropbox-last-sync">Dernier succès : ${status.lastSuccess?escape(new Date(status.lastSuccess).toLocaleString("fr-FR")):"jamais"}</p>
    <p class="helper-text">Les mesures restent disponibles hors ligne. Le même compte Dropbox doit être connecté sur chaque appareil.</p>
    ${connected?`<div class="action-column"><button id="dropbox-sync" class="button secondary-button" type="button">🔄 Synchroniser maintenant</button><button id="dropbox-backup" class="button secondary-button" type="button">💾 Sauvegarde de récupération</button><button id="dropbox-restore" class="button secondary-button" type="button">📂 Sauvegardes Dropbox</button><button id="dropbox-disconnect" class="button danger-button" type="button">Déconnecter Dropbox</button></div>`:
    `<p class="helper-text">Autorisez BattTrack à accéder uniquement à son dossier Dropbox. Aucune clé à saisir.</p><button id="dropbox-connect" class="button secondary-button" type="button">🔗 Connecter Dropbox</button>`}
  </section>`;
}
