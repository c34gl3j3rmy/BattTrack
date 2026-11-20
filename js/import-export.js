import { exportAllData, replaceAllData, validateDataset, mergeImportedData, previewDataset } from "./db.js";
function downloadBlob(blob, filename) {
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");link.href=url;link.download=filename;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function downloadJsonBackup() {
  const data=await exportAllData();
  downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),`batttrack-${new Date().toISOString().slice(0,10)}.json`);
}
export async function readJsonBackup(file) {const text=await file.text();const data=JSON.parse(text);validateDataset(data);return data;}
export function validateImportedData(data) { try {validateDataset(data);return true;}catch {return false;} }
export async function replaceWithImportedData(data) {validateDataset(data);await replaceAllData(data);}
export { mergeImportedData, previewDataset };
function protectCsv(value) {
  const s=String(value??"");
  const safe=/^[=+@\-\t\r\n]/.test(s.trimStart())?`'${s}`:s;
  return '"'+safe.replaceAll('"','""')+'"';
}
export async function downloadCsvBackup(batteryId=null) {
  const data=await exportAllData();
  const names=new Map(data.batteries.map(b=>[b.id,b.name]));
  const rows=[...[...data.measurements].map(m=>({type:m.type==="charge"?"Recharge":"Mesure",batteryId:m.batteryId,at:m.measuredAt??`${m.date}T00:00`,level:m.levelPercent,excluded:m.excludeFromPrevious?"Oui":"Non",note:"",method:m.source??""})),
    ...(data.usageEvents??[]).map(u=>({type:"Utilisation",batteryId:u.batteryId,at:u.usedAt,level:"",excluded:"Oui",note:u.note??"",method:""}))]
    .filter(x=>!batteryId||x.batteryId===batteryId).sort((a,b)=>a.at.localeCompare(b.at));
  const lines=[["Batterie","Identifiant","Date","Heure","Événement","Niveau (%)","Méthode","Intervalle exclu","Note"],...rows.map(r=>[names.get(r.batteryId)??"",r.batteryId,r.at.slice(0,10),r.at.slice(11,16),r.type,r.level,r.method,r.excluded,r.note])];
  const csv="\ufeff"+lines.map(line=>line.map(protectCsv).join(";")).join("\r\n");
  downloadBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),`batttrack-mesures-${new Date().toISOString().slice(0,10)}.csv`);
}
