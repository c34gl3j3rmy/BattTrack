// Dropbox App Folder + OAuth PKCE. Aucune clé secrète n'est embarquée.
const APP_KEY_STORAGE="0mjrxiz6q1kwb9a";
const AUTH_STORAGE="batttrack-dropbox-auth";
const OAUTH_TEMP="batttrack-dropbox-pkce";
const SYNC_PATH="/batttrack-sync.json";
const scopes="files.content.read files.content.write files.metadata.read";

export function getDropboxAppKey() { return localStorage.getItem(APP_KEY_STORAGE)||""; }
export function hasDropboxSession() { return Boolean(JSON.parse(localStorage.getItem(AUTH_STORAGE)||"null")?.refreshToken); }
export function dropboxAuthStatus() { return hasDropboxSession()?"connecté":"non connecté"; }
export function disconnectDropbox() { localStorage.removeItem(AUTH_STORAGE); sessionStorage.removeItem(OAUTH_TEMP); }
function redirectUri() { return location.origin+location.pathname; }
function encodeUrl(buffer) { return btoa(String.fromCharCode(...new Uint8Array(buffer))).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,""); }
export async function connectDropbox(appKey) {
  const key=String(appKey||"").trim();
  if(!/^[a-zA-Z0-9_-]{6,64}$/.test(key)) throw new Error("Renseignez la clé publique de votre application Dropbox.");
  const verifier=encodeUrl(crypto.getRandomValues(new Uint8Array(48)));
  const challenge=encodeUrl(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier)));
  const state=encodeUrl(crypto.getRandomValues(new Uint8Array(20)));
  localStorage.setItem(APP_KEY_STORAGE,key);
  sessionStorage.setItem(OAUTH_TEMP,JSON.stringify({verifier,state,key,redirectUri:redirectUri()}));
  const params=new URLSearchParams({client_id:key,response_type:"code",token_access_type:"offline",redirect_uri:redirectUri(),code_challenge_method:"S256",code_challenge:challenge,state,scope:scopes});
  location.assign(`https://www.dropbox.com/oauth2/authorize?${params}`);
}
async function tokenRequest(params) {
  const response=await fetch("https://api.dropboxapi.com/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(params)});
  if(!response.ok) throw new Error(`Autorisation Dropbox refusée (${response.status}).`);
  return response.json();
}
export async function finishDropboxAuth() {
  const params=new URLSearchParams(location.search);
  if(!params.has("code")&&!params.has("error")) return false;
  const pending=JSON.parse(sessionStorage.getItem(OAUTH_TEMP)||"null");
  const clean=new URL(location.href); for(const key of ["code","state","error","error_description"]) clean.searchParams.delete(key);
  history.replaceState(history.state,"",clean.pathname+clean.search+clean.hash);
  if(params.has("error")) throw new Error(`Dropbox : ${params.get("error_description")||params.get("error")}`);
  if(!pending||pending.state!==params.get("state")) throw new Error("Connexion Dropbox interrompue : état de sécurité incorrect. Reconnectez-vous.");
  const token=await tokenRequest({client_id:pending.key,grant_type:"authorization_code",code:params.get("code"),redirect_uri:pending.redirectUri,code_verifier:pending.verifier});
  sessionStorage.removeItem(OAUTH_TEMP);
  if(!token.refresh_token) throw new Error("Dropbox n'a pas fourni de jeton de renouvellement.");
  localStorage.setItem(AUTH_STORAGE,JSON.stringify({refreshToken:token.refresh_token,accessToken:token.access_token,expiresAt:Date.now()+Math.max(0,token.expires_in-60)*1000,key:pending.key}));
  return true;
}
async function accessToken() {
  let auth=JSON.parse(localStorage.getItem(AUTH_STORAGE)||"null");
  if(!auth?.refreshToken) throw new Error("Dropbox non connecté.");
  if(auth.accessToken&&Date.now()<auth.expiresAt) return auth.accessToken;
  const token=await tokenRequest({grant_type:"refresh_token",refresh_token:auth.refreshToken,client_id:auth.key});
  auth={...auth,accessToken:token.access_token,expiresAt:Date.now()+Math.max(0,token.expires_in-60)*1000};
  localStorage.setItem(AUTH_STORAGE,JSON.stringify(auth));
  return auth.accessToken;
}
async function rpc(endpoint,arg) {
  const response=await fetch(`https://api.dropboxapi.com/2/${endpoint}`,{method:"POST",headers:{Authorization:`Bearer ${await accessToken()}`,"Content-Type":"application/json"},body:JSON.stringify(arg)});
  const json=await response.json().catch(()=>({}));
  if(!response.ok) {const e=new Error(`Dropbox (${response.status}) : ${json.error_summary||"requête refusée"}`);e.status=response.status;throw e;}
  return json;
}
export async function downloadSyncFile() {
  let before=null;
  try { before=await rpc("files/get_metadata",{path:SYNC_PATH}); }
  catch(error) { if(error.status!==409||!error.message.includes("not_found"))throw error; }
  const response=await fetch("https://content.dropboxapi.com/2/files/download",{method:"POST",headers:{Authorization:`Bearer ${await accessToken()}`,"Dropbox-API-Arg":JSON.stringify({path:SYNC_PATH})}});
  if(response.status===409) {
    const body=await response.text();
    if(body.includes("not_found")) return null;
    throw new Error("Fichier de synchronisation Dropbox inaccessible.");
  }
  if(!response.ok) throw new Error(`Téléchargement Dropbox impossible (${response.status}).`);
  const data=await response.json();
  const meta=await rpc("files/get_metadata",{path:SYNC_PATH});
  if(before?.rev!==meta.rev) {const error=new Error("Révision Dropbox modifiée pendant la lecture.");error.code="REV_CONFLICT";throw error;}
  return {data,rev:meta.rev};
}
export async function uploadSyncFile(data,revision) {
  const mode=revision?{ ".tag":"update", update:revision }:"add";
  const body=JSON.stringify(data);
  const response=await fetch("https://content.dropboxapi.com/2/files/upload",{method:"POST",headers:{Authorization:`Bearer ${await accessToken()}`,"Dropbox-API-Arg":JSON.stringify({path:SYNC_PATH,mode,autorename:false,mute:true}),"Content-Type":"application/octet-stream"},body});
  if(response.status===409) {const error=new Error("Le fichier Dropbox a changé pendant la synchronisation.");error.code="REV_CONFLICT";throw error;}
  if(!response.ok) throw new Error(`Écriture Dropbox impossible (${response.status}).`);
  return (await response.json()).rev;
}
export async function saveDropboxBackup(data) {
  const when=new Date().toISOString().replaceAll(":","-");
  const path=`/sauvegarde-${when}.json`;
  const response=await fetch("https://content.dropboxapi.com/2/files/upload",{method:"POST",headers:{Authorization:`Bearer ${await accessToken()}`,"Dropbox-API-Arg":JSON.stringify({path,mode:"add",autorename:false,mute:true}),"Content-Type":"application/octet-stream"},body:JSON.stringify(data)});
  if(!response.ok) throw new Error(`Sauvegarde Dropbox impossible (${response.status}).`);
  return path;
}
export async function listDropboxBackups() {
  const result=await rpc("files/list_folder",{path:"",recursive:false,limit:200});
  let entries=[...result.entries];
  let cursor=result.cursor, hasMore=result.has_more;
  while(hasMore && entries.length<500){
    const next=await rpc("files/list_folder/continue",{cursor});
    entries.push(...next.entries); cursor=next.cursor;hasMore=next.has_more;
  }
  return entries.filter(x=>x[".tag"]==="file"&&/^sauvegarde-/.test(x.name)).sort((a,b)=>b.name.localeCompare(a.name));
}
export async function downloadDropboxBackup(path) {
  if(!/^\/sauvegarde-[\dtzTZ.:-]+\.json$/i.test(path)) throw new Error("Chemin de sauvegarde invalide.");
  const response=await fetch("https://content.dropboxapi.com/2/files/download",{method:"POST",headers:{Authorization:`Bearer ${await accessToken()}`,"Dropbox-API-Arg":JSON.stringify({path})}});
  if(!response.ok) throw new Error("Sauvegarde Dropbox inaccessible.");
  return response.json();
}
