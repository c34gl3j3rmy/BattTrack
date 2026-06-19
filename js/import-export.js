import { exportAllData, replaceAllData } from "./db.js";
export async function downloadJsonBackup() {
  const data = await exportAllData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a"); link.href = url; link.download = `battery-reminder-${date}.json`; link.click();
  URL.revokeObjectURL(url);
}
export async function readJsonBackup(file) { const text = await file.text(); return JSON.parse(text); }
export function validateImportedData(data) { return Boolean(data && Array.isArray(data.batteries) && Array.isArray(data.measurements)); }
export async function replaceWithImportedData(data) { if (!validateImportedData(data)) throw new Error("Fichier de sauvegarde invalide."); await replaceAllData(data); }
