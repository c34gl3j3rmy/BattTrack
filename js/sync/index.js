import { exportSyncData, exportAllData, applySyncedData, getSyncValue, saveSyncValue } from "../db.js";
import { mergeSnapshots, emptySnapshot } from "./merge.js";
import { hasDropboxSession, downloadSyncFile, uploadSyncFile, saveDropboxBackup } from "./dropbox.js";

let syncing=null;
let timer=null;
const listeners=new Set();
let status={status:"local",lastSuccess:null,error:null,conflicts:[]};
function emit(patch) {status={...status,...patch};listeners.forEach(fn=>fn({...status}));}
export function subscribeSync(listener) {listeners.add(listener);listener({...status});return ()=>listeners.delete(listener);}
export function getSyncStatus(){return {...status};}
export async function initializeSync() {
  const base=await getSyncValue("base");
  const pending=await getSyncValue("pending");
  emit({status:hasDropboxSession()?(pending?"pending":"idle"):"local",lastSuccess:base?.syncedAt??null});
  window.addEventListener("batttrack:datachanged",scheduleSync);
  window.addEventListener("online",scheduleSync);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)scheduleSync();});
  if(hasDropboxSession()) scheduleSync();
}
export function scheduleSync() {
  if(!hasDropboxSession()) {emit({status:"local"});return;}
  emit({status: navigator.onLine?"pending":"offline"});
  clearTimeout(timer);
  timer=setTimeout(()=>{syncNow().catch(error=>console.warn("Synchronisation",error));},1700);
}
export async function syncNow(resolutions={}) {
  if(syncing) return syncing;
  syncing=performSync(resolutions).finally(()=>{syncing=null;});
  return syncing;
}
async function performSync(resolutions) {
  if(!hasDropboxSession()) {emit({status:"local"});throw new Error("Connectez Dropbox dans les paramètres.");}
  if(!navigator.onLine){emit({status:"offline"});throw new Error("Hors ligne : modifications conservées sur cet appareil.");}
  const block=await getSyncValue("syncBlock");
  if(block?.reason && !resolutions.__manual) {
    // Une restauration remplace localement le jeu de données. Ne pas réinjecter silencieusement des données distantes.
    emit({status:"error",error:block.reason});
    throw new Error(`${block.reason}. Reconnecter Dropbox et fusionner explicitement les données avant de reprendre.`);
  }
  if(!resolutions.__manual && document.querySelector("#battery-form, #measurement-form, #usage-form")) {
    emit({status:"pending"});
    scheduleSync();
    return {conflicts:[],pending:true};
  }
  emit({status:"syncing",error:null});
  try {
    for(let attempt=0;attempt<3;attempt++) {
      const pendingBefore=await getSyncValue("pending");
      const current=await downloadSyncFile();
      const baseSaved=await getSyncValue("base");
      if(!current&&baseSaved?.rev) throw new Error("Fichier Dropbox absent après une synchronisation antérieure. Intervention nécessaire.");
      const local=await exportSyncData();
      const remote=current?.data??emptySnapshot();
      if(current && (remote.formatVersion!==2 || !Array.isArray(remote.batteries) || !Array.isArray(remote.measurements)))
        throw new Error("Format Dropbox inconnu : synchronisation interrompue pour protéger les données.");
      const base=baseSaved?.data??emptySnapshot();
      const firstEmpty=!baseSaved&&local.batteries.length===0&&local.measurements.length===0&&local.usageEvents.length===0;
      const {data,conflicts}=firstEmpty&&current?{data:remote,conflicts:[]}:mergeSnapshots(base,local,remote,resolutions);
      if(conflicts.length){emit({status:"conflict",conflicts,error:"Des modifications concurrentes doivent être examinées."});return {conflicts};}
      // Révision conditionnelle : une modification simultanée relance une nouvelle fusion.
      try {
        const revision=await uploadSyncFile(data,current?.rev??null);
        const pendingAfter=await getSyncValue("pending");
        if(pendingAfter?.id!==pendingBefore?.id) {
          await saveSyncValue({key:"base",data,rev:revision,syncedAt:new Date().toISOString()});
          scheduleSync();
          return {conflicts:[],pending:true};
        }
        try { await applySyncedData(data,revision,pendingBefore?.id); }
        catch(error){
          if(error.code!=="LOCAL_CHANGED") throw error;
          // Une écriture locale a démarré pendant la transaction : ne pas écraser son résultat.
          await saveSyncValue({key:"base",data,rev:revision,syncedAt:new Date().toISOString()});
          scheduleSync();
          return {conflicts:[],pending:true};
        }
        await saveSyncValue({key:"syncBlock",reason:null,clearedAt:new Date().toISOString()});
        const lastSuccess=new Date().toISOString();
        emit({status:"synced",conflicts:[],lastSuccess,error:null});
        window.dispatchEvent(new Event("batttrack:synced"));
        return {conflicts:[]};
      }catch(error) {if(error.code==="REV_CONFLICT"&&attempt<2)continue;throw error;}
    }
    throw new Error("Dropbox a été modifié trop souvent. Réessayez.");
  } catch(error) {emit({status:"error",error:error.message});throw error;}
}
export async function backupNow(){
  const data=await exportAllData();
  const path=await saveDropboxBackup(data);
  await saveSyncValue({key:"lastBackup",path,at:new Date().toISOString()});
  return path;
}
