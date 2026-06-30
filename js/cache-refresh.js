async function refreshAppWithoutUserData() {
  const confirmed = confirm("Actualiser l'application ?\n\nLes fichiers de BattTrack seront rechargés. Vos batteries et vos mesures seront conservées.");
  if (!confirmed) return;

  try {
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    }

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(async registration => {
        try {
          await registration.update();
        } finally {
          await registration.unregister();
        }
      }));
    }
  } catch (error) {
    console.warn("Actualisation complète impossible", error);
  }

  const url = new URL(window.location.href);
  url.searchParams.set("refresh", Date.now().toString());
  window.location.replace(url.toString());
}

document.addEventListener("click", event => {
  const button = event.target?.closest?.("#check-update-button, #clear-cache-button");
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  refreshAppWithoutUserData();
}, true);
