import { APP_VERSION_FALLBACK, DB_NAME, DB_VERSION, STORE_NAMES } from "./constants.js";
import { createDefaultSettings } from "./settings.js";
let dbInstance = null;
export async function initDb() { if (dbInstance) return dbInstance; dbInstance = await openDatabase(); await ensureDefaultRecords(); return dbInstance; }
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAMES.BATTERIES)) {
        const store = db.createObjectStore(STORE_NAMES.BATTERIES, { keyPath: "id" });
        store.createIndex("name", "name", { unique: false }); store.createIndex("archived", "archived", { unique: false }); store.createIndex("createdAt", "createdAt", { unique: false }); store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.MEASUREMENTS)) {
        const store = db.createObjectStore(STORE_NAMES.MEASUREMENTS, { keyPath: "id" });
        store.createIndex("batteryId", "batteryId", { unique: false }); store.createIndex("date", "date", { unique: false }); store.createIndex("measuredAt", "measuredAt", { unique: false }); store.createIndex("type", "type", { unique: false }); store.createIndex("source", "source", { unique: false }); store.createIndex("createdAt", "createdAt", { unique: false }); store.createIndex("batteryId_date", ["batteryId", "date"], { unique: false }); store.createIndex("batteryId_measuredAt", ["batteryId", "measuredAt"], { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_NAMES.SETTINGS)) db.createObjectStore(STORE_NAMES.SETTINGS, { keyPath: "key" });
      if (!db.objectStoreNames.contains(STORE_NAMES.METADATA)) db.createObjectStore(STORE_NAMES.METADATA, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
  });
}
async function ensureDefaultRecords() {
  const settings = await getSettings(); if (!settings) await saveSettings(createDefaultSettings());
  const now = new Date().toISOString();
  const previous = await getByKey(STORE_NAMES.METADATA, "database");
  await put(STORE_NAMES.METADATA, { key: "database", schemaVersion: DB_VERSION, appVersion: window.battTrackVersionInfo?.version ?? APP_VERSION_FALLBACK, createdAt: previous?.createdAt ?? now, updatedAt: now });
}
function transaction(storeName, mode = "readonly") { return dbInstance.transaction(storeName, mode).objectStore(storeName); }
function requestToPromise(request) { return new Promise((resolve, reject) => { request.onerror = () => reject(request.error); request.onsuccess = () => resolve(request.result); }); }
function measurementSortKey(measurement) { return measurement.measuredAt ?? `${measurement.date}T00:00`; }
export async function getAll(storeName) { return requestToPromise(transaction(storeName).getAll()); }
export async function getByKey(storeName, key) { return requestToPromise(transaction(storeName).get(key)); }
export async function put(storeName, value) { return requestToPromise(transaction(storeName, "readwrite").put(value)); }
export async function remove(storeName, key) { return requestToPromise(transaction(storeName, "readwrite").delete(key)); }
export async function clearStore(storeName) { return requestToPromise(transaction(storeName, "readwrite").clear()); }
export async function getAllBatteries() { return getAll(STORE_NAMES.BATTERIES); }
export async function getBatteryById(id) { return getByKey(STORE_NAMES.BATTERIES, id); }
export async function saveBattery(battery) { return put(STORE_NAMES.BATTERIES, battery); }
export async function deleteBattery(id) { return remove(STORE_NAMES.BATTERIES, id); }
export async function getMeasurementsByBatteryId(batteryId) { const store = transaction(STORE_NAMES.MEASUREMENTS); const index = store.index("batteryId"); const measurements = await requestToPromise(index.getAll(batteryId)); return measurements.sort((a,b) => measurementSortKey(a).localeCompare(measurementSortKey(b))); }
export async function saveMeasurement(measurement) { return put(STORE_NAMES.MEASUREMENTS, measurement); }
export async function deleteMeasurement(id) { return remove(STORE_NAMES.MEASUREMENTS, id); }
export async function deleteMeasurementsByBatteryId(batteryId) { const measurements = await getMeasurementsByBatteryId(batteryId); for (const m of measurements) await deleteMeasurement(m.id); }
export async function getSettings() { return getByKey(STORE_NAMES.SETTINGS, "global"); }
export async function saveSettings(settings) { return put(STORE_NAMES.SETTINGS, settings); }
export async function exportAllData() { return { exportedAt: new Date().toISOString(), batteries: await getAll(STORE_NAMES.BATTERIES), measurements: await getAll(STORE_NAMES.MEASUREMENTS), settings: await getAll(STORE_NAMES.SETTINGS), metadata: await getAll(STORE_NAMES.METADATA) }; }
export async function replaceAllData(data) {
  await clearStore(STORE_NAMES.BATTERIES); await clearStore(STORE_NAMES.MEASUREMENTS); await clearStore(STORE_NAMES.SETTINGS); await clearStore(STORE_NAMES.METADATA);
  for (const battery of data.batteries ?? []) await put(STORE_NAMES.BATTERIES, battery);
  for (const measurement of data.measurements ?? []) await put(STORE_NAMES.MEASUREMENTS, measurement);
  for (const settings of data.settings ?? []) await put(STORE_NAMES.SETTINGS, settings);
  for (const metadata of data.metadata ?? []) await put(STORE_NAMES.METADATA, metadata);
  await ensureDefaultRecords();
}
