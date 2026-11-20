import { APP_VERSION_FALLBACK, DB_NAME, DB_VERSION, STORE_NAMES as S } from "./constants.js";
import { createDefaultSettings } from "./settings.js";

let dbInstance = null;
const DATA_STORES = [S.BATTERIES, S.MEASUREMENTS, S.USAGE, S.SETTINGS, S.METADATA, S.TOMBSTONES];

export async function initDb() {
  if (dbInstance) return dbInstance;
  dbInstance = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Fermez les autres onglets BattTrack pour mettre à jour la base."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(S.BATTERIES)) {
        const store = db.createObjectStore(S.BATTERIES, { keyPath: "id" });
        for (const name of ["name", "archived", "createdAt", "updatedAt"]) store.createIndex(name, name);
      }
      if (!db.objectStoreNames.contains(S.MEASUREMENTS)) {
        const store = db.createObjectStore(S.MEASUREMENTS, { keyPath: "id" });
        for (const name of ["batteryId", "date", "measuredAt", "type", "source", "createdAt"]) store.createIndex(name, name);
        store.createIndex("batteryId_date", ["batteryId", "date"]);
        store.createIndex("batteryId_measuredAt", ["batteryId", "measuredAt"]);
      }
      for (const name of [S.SETTINGS, S.METADATA, S.SYNC]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(S.USAGE)) {
        const store = db.createObjectStore(S.USAGE, { keyPath: "id" });
        store.createIndex("batteryId", "batteryId");
      }
      if (!db.objectStoreNames.contains(S.TOMBSTONES)) db.createObjectStore(S.TOMBSTONES, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
  });
  dbInstance.onversionchange = () => { dbInstance.close(); dbInstance = null; };
  if (!await getSettings()) await saveSettings(createDefaultSettings());
  const existing = await getByKey(S.METADATA, "database");
  await putRaw(S.METADATA, { key: "database", schemaVersion: DB_VERSION, appVersion: APP_VERSION_FALLBACK, createdAt: existing?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() });
  return dbInstance;
}

function waitRequest(request) {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
function runTransaction(stores, operation) {
  return new Promise((resolve, reject) => {
    const tx = dbInstance.transaction(stores, "readwrite");
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error ?? new Error("Transaction IndexedDB échouée."));
    tx.onabort = () => reject(tx.error ?? new Error("Transaction IndexedDB annulée."));
    try { result = operation(tx); } catch (error) { tx.abort(); reject(error); }
  });
}
export async function getAll(storeName) { return waitRequest(dbInstance.transaction(storeName).objectStore(storeName).getAll()); }
export async function getByKey(storeName, key) { return waitRequest(dbInstance.transaction(storeName).objectStore(storeName).get(key)); }
export async function putRaw(storeName, value) { return runTransaction([storeName], tx => tx.objectStore(storeName).put(value)); }
export async function put(storeName, value) { return putRaw(storeName, value); }
export async function remove(storeName, key) { return runTransaction([storeName], tx => tx.objectStore(storeName).delete(key)); }
export async function clearStore(storeName) { return runTransaction([storeName], tx => tx.objectStore(storeName).clear()); }
function markDirty(tx) { tx.objectStore(S.SYNC).put({ key: "pending", updatedAt: new Date().toISOString(), id: crypto.randomUUID() }); }
function changed() { if (typeof window !== "undefined") window.dispatchEvent(new Event("batttrack:datachanged")); }
function saveEntity(store, entity) {
  return runTransaction([store, S.SYNC, S.TOMBSTONES], tx => {
    tx.objectStore(store).put(entity);
    tx.objectStore(S.TOMBSTONES).delete(`${store}:${entity.id}`);
    markDirty(tx);
  }).then(changed);
}
function removeEntity(store, id) {
  return runTransaction([store, S.SYNC, S.TOMBSTONES], tx => {
    tx.objectStore(store).delete(id);
    tx.objectStore(S.TOMBSTONES).put({ key: `${store}:${id}`, store, id, deletedAt: new Date().toISOString() });
    markDirty(tx);
  }).then(changed);
}
export async function getAllBatteries() { return getAll(S.BATTERIES); }
export async function getBatteryById(id) { return getByKey(S.BATTERIES, id); }
export async function saveBattery(battery) { return saveEntity(S.BATTERIES, battery); }
export async function deleteBattery(id) { return removeEntity(S.BATTERIES, id); }
function measurementSortKey(m) { return m.measuredAt ?? `${m.date}T00:00`; }
export async function getMeasurementsByBatteryId(batteryId) {
  const store = dbInstance.transaction(S.MEASUREMENTS).objectStore(S.MEASUREMENTS);
  const list = await waitRequest(store.index("batteryId").getAll(batteryId));
  return list.sort((a, b) => measurementSortKey(a).localeCompare(measurementSortKey(b)));
}
export async function saveMeasurement(value) { return saveEntity(S.MEASUREMENTS, value); }
export async function deleteMeasurement(id) { return removeEntity(S.MEASUREMENTS, id); }
export async function deleteMeasurementsByBatteryId(batteryId) {
  const list = await getMeasurementsByBatteryId(batteryId);
  return runTransaction([S.MEASUREMENTS, S.TOMBSTONES, S.SYNC], tx => {
    for (const value of list) {
      tx.objectStore(S.MEASUREMENTS).delete(value.id);
      tx.objectStore(S.TOMBSTONES).put({ key: `${S.MEASUREMENTS}:${value.id}`, store: S.MEASUREMENTS, id: value.id, deletedAt: new Date().toISOString() });
    }
    markDirty(tx);
  }).then(changed);
}
export async function deleteBatteryCascade(id) {
  const measurements=await getMeasurementsByBatteryId(id);
  const events=await getUsageEventsByBatteryId(id);
  await runTransaction([S.BATTERIES,S.MEASUREMENTS,S.USAGE,S.TOMBSTONES,S.SYNC], tx => {
    const tomb=tx.objectStore(S.TOMBSTONES);
    const stamp=new Date().toISOString();
    for(const [store,items] of [[S.BATTERIES,[{id}]],[S.MEASUREMENTS,measurements],[S.USAGE,events]]) {
      for(const item of items) {
        tx.objectStore(store).delete(item.id);
        tomb.put({key:`${store}:${item.id}`,store,id:item.id,deletedAt:stamp});
      }
    }
    markDirty(tx);
  });
  changed();
}
export async function getUsageEventsByBatteryId(batteryId) {
  const store = dbInstance.transaction(S.USAGE).objectStore(S.USAGE);
  const list = await waitRequest(store.index("batteryId").getAll(batteryId));
  return list.sort((a,b) => a.usedAt.localeCompare(b.usedAt));
}
export async function saveUsageEvent(event) { return saveEntity(S.USAGE, event); }
export async function deleteUsageEvent(id) { return removeEntity(S.USAGE, id); }
export async function getSettings() { return getByKey(S.SETTINGS, "global"); }
export async function saveSettings(value) {
  return runTransaction([S.SETTINGS, S.SYNC], tx => { tx.objectStore(S.SETTINGS).put(value); markDirty(tx); }).then(changed);
}
export async function getSyncValue(key) { return getByKey(S.SYNC, key); }
export async function saveSyncValue(value) { return putRaw(S.SYNC, value); }

export async function exportAllData() {
  return { formatVersion: 2, exportedAt: new Date().toISOString(),
    batteries: await getAll(S.BATTERIES), measurements: await getAll(S.MEASUREMENTS),
    usageEvents: await getAll(S.USAGE), settings: await getAll(S.SETTINGS),
    metadata: await getAll(S.METADATA), tombstones: await getAll(S.TOMBSTONES) };
}
export function validateDataset(data) {
  if (!data || !Array.isArray(data.batteries) || !Array.isArray(data.measurements)) throw new Error("Sauvegarde invalide : batteries ou mesures absentes.");
  const fields=[["batteries","id"],["measurements","id"],["usageEvents","id"],["tombstones","key"]];
  for (const [field, key] of fields) {
    if (data[field] !== undefined && !Array.isArray(data[field])) throw new Error(`Sauvegarde invalide : ${field}.`);
    const list=data[field]??[];
    if (list.length>100000) throw new Error(`Sauvegarde trop volumineuse : ${field}.`);
    if (list.some(x => !x || typeof x[key] !== "string" || !/^[a-zA-Z0-9:_-]{1,128}$/.test(x[key]))) throw new Error(`Identifiant incorrect dans ${field}.`);
    if (new Set(list.map(x => x[key])).size !== list.length) throw new Error(`Doublons dans ${field}.`);
  }
  for (const battery of data.batteries) {
    if(typeof battery.name!=="string" || battery.name.length>300)throw new Error("Nom de batterie invalide.");
    if(battery.chemistry && !["unknown","liion","lipo","nimh","lead"].includes(battery.chemistry)) throw new Error("Chimie de batterie inconnue.");
    if(battery.controlIntervalDays!=null && !(Number.isInteger(battery.controlIntervalDays)&&battery.controlIntervalDays>=7&&battery.controlIntervalDays<=365))throw new Error("Fréquence de contrôle invalide.");
  }
  for (const measure of data.measurements) {
    if(typeof measure.batteryId!=="string" || !Number.isFinite(measure.levelPercent)||measure.levelPercent<0||measure.levelPercent>100)throw new Error("Mesure invalide.");
    if(!Number.isFinite(new Date(measure.measuredAt??`${measure.date}T00:00`).getTime()))throw new Error("Date de mesure invalide.");
  }
  for (const use of data.usageEvents??[]) {
    if(typeof use.batteryId!=="string" || typeof use.usedAt!=="string" || !Number.isFinite(new Date(use.usedAt).getTime()))throw new Error("Événement d'utilisation invalide.");
  }
  if (data.settings !== undefined && !Array.isArray(data.settings) && (typeof data.settings !== "object" || data.settings === null)) throw new Error("Sauvegarde invalide : paramètres.");
  if (data.metadata !== undefined && !Array.isArray(data.metadata)) throw new Error("Sauvegarde invalide : métadonnées.");
  const batteryIds = new Set(data.batteries.map(b => b.id));
  if (data.measurements.some(m => !batteryIds.has(m.batteryId))) throw new Error("Sauvegarde invalide : mesure orpheline.");
  if ((data.usageEvents ?? []).some(u => !batteryIds.has(u.batteryId))) throw new Error("Sauvegarde invalide : utilisation orpheline.");
  return true;
}
export function previewDataset(data) {
  validateDataset(data);
  return { batteries: data.batteries.length, measurements: data.measurements.length, usageEvents: (data.usageEvents ?? []).length, exportedAt: data.exportedAt ?? null };
}
export async function replaceAllData(data) {
  validateDataset(data);
  if (data.settings && !Array.isArray(data.settings))throw new Error("Le fichier est une copie de synchronisation, pas une sauvegarde de restauration.");
  await runTransaction([...DATA_STORES, S.SYNC], tx => {
    for (const store of DATA_STORES) tx.objectStore(store).clear();
    for (const [store, values] of [[S.BATTERIES,data.batteries],[S.MEASUREMENTS,data.measurements],[S.USAGE,data.usageEvents ?? []],[S.SETTINGS,data.settings ?? []],[S.METADATA,data.metadata ?? []],[S.TOMBSTONES,data.tombstones ?? []]]) {
      for (const value of values) tx.objectStore(store).put(value);
    }
    if (!data.settings?.some(x => x.key === "global")) tx.objectStore(S.SETTINGS).put(createDefaultSettings());
    const meta=(data.metadata??[]).find(x=>x.key==="database");
    tx.objectStore(S.METADATA).put({
      ...meta,key:"database",schemaVersion:DB_VERSION,appVersion:APP_VERSION_FALLBACK,
      createdAt:meta?.createdAt??new Date().toISOString(),updatedAt:new Date().toISOString()
    });
    tx.objectStore(S.SYNC).clear();
    tx.objectStore(S.SYNC).put({key:"syncBlock",reason:"Restauration locale : synchronisation manuelle requise"});
    markDirty(tx);
  });
  changed();
}
export async function mergeImportedData(remote, decisions = {}) {
  validateDataset(remote);
  if(remote.settings&&!Array.isArray(remote.settings))throw new Error("Utilisez une sauvegarde de récupération pour fusionner les données.");
  const local = await exportAllData();
  const merged = { ...local };
  const conflicts = [];
  for (const field of ["batteries", "measurements", "usageEvents"]) {
    const byId = new Map(local[field].map(x => [x.id, x]));
    for (const value of remote[field] ?? []) {
      const existing = byId.get(value.id);
      if (!existing) byId.set(value.id, value);
      else if (JSON.stringify(existing) !== JSON.stringify(value)) {
        const choice = decisions[`${field}:${value.id}`];
        if (!choice) conflicts.push({ key: `${field}:${value.id}`, field, name: value.name ?? value.id });
        else if (choice === "remote") byId.set(value.id, value);
      }
    }
    merged[field] = [...byId.values()];
  }
  if (conflicts.length) return { conflicts, applied: false };
  merged.tombstones=(merged.tombstones??[]).filter(t=>!(merged[t.store]??[]).some(x=>x.id===t.id));
  validateDataset(merged);
  await replaceAllData(merged);
  return { conflicts: [], applied: true };
}
export async function exportSyncData() {
  const data = await exportAllData();
  const shared = await getSettings();
  return { formatVersion: 2, batteries: data.batteries, measurements: data.measurements, usageEvents: data.usageEvents, tombstones: data.tombstones,
    settings: { criticalThresholdPercent: shared.criticalThresholdPercent, alertThresholdPercent: shared.alertThresholdPercent, defaultControlIntervalDays: shared.defaultControlIntervalDays } };
}
export async function applySyncedData(data, rev, expectedPendingId) {
  validateDataset(data);
  const localSettings=await getSettings();
  let localChanged=false;
  try {await runTransaction([S.BATTERIES,S.MEASUREMENTS,S.USAGE,S.TOMBSTONES,S.SETTINGS,S.SYNC], tx => {
    const pending=tx.objectStore(S.SYNC).get("pending");
    pending.onsuccess=()=>{
      if(pending.result?.id !== expectedPendingId) {
        localChanged=true;
        tx.abort();
        return;
      }
      for (const store of [S.BATTERIES,S.MEASUREMENTS,S.USAGE,S.TOMBSTONES]) tx.objectStore(store).clear();
      for (const [store, values] of [[S.BATTERIES,data.batteries],[S.MEASUREMENTS,data.measurements],[S.USAGE,data.usageEvents ?? []],[S.TOMBSTONES,data.tombstones ?? []]]) {
        for (const value of values) tx.objectStore(store).put(value);
      }
      tx.objectStore(S.SETTINGS).put({ ...localSettings, ...(data.settings ?? {}), key:"global" });
      tx.objectStore(S.SYNC).put({ key: "base", data, rev, syncedAt: new Date().toISOString() });
      tx.objectStore(S.SYNC).delete("pending");
      tx.objectStore(S.SYNC).delete("syncBlock");
    };
  });}catch(error){if(localChanged){const changed=new Error("Modification locale pendant la synchronisation.");changed.code="LOCAL_CHANGED";throw changed;}throw error;}
}
export async function resetSyncAssociation() {
  await runTransaction([S.SYNC],tx=>{
    for(const key of ["base","syncBlock","conflicts"])tx.objectStore(S.SYNC).delete(key);
    tx.objectStore(S.SYNC).put({key:"pending",id:crypto.randomUUID(),updatedAt:new Date().toISOString()});
  });
}
