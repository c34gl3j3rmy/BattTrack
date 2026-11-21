const CACHE_NAME = "batttrack-v2-0-1";
const APP_SHELL = [
  "./", "./index.html", "./manifest.json", "./version.json",
  "./css/tokens.css", "./css/style.css", "./css/chart.css", "./css/header-contrast.css", "./css/v2.css",
  "./js/app.js", "./js/battery.js", "./js/calculation.js", "./js/constants.js", "./js/db.js",
  "./js/import-export.js", "./js/measurement.js", "./js/settings.js", "./js/ui.js", "./js/navigation.js",
  "./js/recommendations.js", "./js/ui/v2-sections.js", "./js/ui/chart.js", "./js/sync/merge.js", "./js/sync/dropbox.js", "./js/sync/index.js",
  "./assets/favicon.png", "./assets/apple-touch-icon.png", "./assets/icon-192.png", "./assets/icon-512.png",
  "./assets/icon-192-maskable.png", "./assets/icon-512-maskable.png", "./assets/logo.png",
  "./assets/icons/status/ok.svg", "./assets/icons/status/warning.svg", "./assets/icons/status/critical.svg", "./assets/icons/status/unknown.svg",
  "./assets/icons/navigation/home.svg", "./assets/icons/navigation/settings.svg"
];
const isShell = new Set(APP_SHELL.map(path => new URL(path, self.registration.scope).href));
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names=await caches.keys();
    await Promise.all(names.filter(n=>n.startsWith("batttrack-")&&n!==CACHE_NAME).map(n=>caches.delete(n)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  if(event.request.method!=="GET"||new URL(event.request.url).origin!==self.location.origin)return;
  if(event.request.mode==="navigate") {
    event.respondWith(fetch(event.request).catch(()=>caches.match("./index.html")));
    return;
  }
  if(!isShell.has(event.request.url))return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
self.addEventListener("message", event => { if(event.data?.type==="SKIP_WAITING")self.skipWaiting(); });
