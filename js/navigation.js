// Un seul historique pour les écrans et les modales de la PWA.
let onRoute=null, onCloseModal=null;
let current={view:"dashboard"};
function urlFor(route) {
  const url=new URL(location.href);
  url.hash=route.batteryId?`battery=${encodeURIComponent(route.batteryId)}`:route.view==="archives"?"archives":"";
  return url.pathname+url.search+url.hash;
}
export function initNavigation(navigateTo,closeOverlay) {
  onRoute=navigateTo;
  onCloseModal=closeOverlay;
  const hash=location.hash;
  history.replaceState({battTrack:true,view:"dashboard"},"",urlFor({view:"dashboard"}));
  current={view:"dashboard"};
  window.addEventListener("popstate",event=>{
    const next=event.state?.battTrack?event.state:{view:"dashboard"};
    if(!next.modal) onCloseModal?.();
    if(next.view!==current.view||next.batteryId!==current.batteryId) {
      current={view:next.view,batteryId:next.batteryId};
      onRoute?.(current);
    }
  });
  if(hash.startsWith("#battery=")) return {view:"battery-details",batteryId:decodeURIComponent(hash.slice(9)),push:true};
  if(hash==="#archives") return {view:"archives",push:true};
  return {view:"dashboard"};
}
export function navigate(route,{push=false,replace=false}={}) {
  current={view:route.view,batteryId:route.batteryId};
  const next={battTrack:true,...current};
  if(replace || (!push && history.state?.modal)) history.replaceState(next,"",urlFor(current));
  else if(push && (history.state?.view!==next.view || history.state?.batteryId!==next.batteryId)) history.pushState(next,"",urlFor(current));
}
export function modalOpened() {
  if(!history.state?.modal) history.pushState({...history.state,battTrack:true,modal:true},"",location.href);
}
export function modalClosed(fromHistory=false) {
  if(!fromHistory && history.state?.modal) history.back();
}
