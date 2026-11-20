// Valeurs de départ indicatives ; la notice du fabricant reste prioritaire.
export const INITIAL_DAYS = Object.freeze({ lipo: 30, liion: 60, nimh: 60, lead: 30, unknown: 30 });
const DAY = 86400000;

export function measureTimestamp(item) {
  const raw = item?.measuredAt ?? (item?.date ? `${item.date}T00:00` : null);
  const value = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(value) ? value : NaN;
}
export function observedIntervals(measurements, usages = []) {
  const sorted = [...measurements].filter(m => Number.isFinite(measureTimestamp(m)) && Number.isFinite(m.levelPercent))
    .sort((a,b) => measureTimestamp(a)-measureTimestamp(b));
  const events = usages.map(u => new Date(u.usedAt).getTime()).filter(Number.isFinite);
  const intervals = [];
  for (let i=1; i<sorted.length; i++) {
    const a=sorted[i-1], b=sorted[i];
    const start=measureTimestamp(a), end=measureTimestamp(b), days=(end-start)/DAY;
    if (days <= 0 || b.excludeFromPrevious || b.type === "charge" || b.levelPercent===100 || a.type==="charge" && a.levelPercent!==100) continue;
    if (events.some(t=>t>start && t<=end)) continue;
    const drop=a.levelPercent-b.levelPercent;
    // Une remontée sans recharge ou une baisse négative est une anomalie, pas une décharge de zéro.
    if (drop < 0 || days < 0.04 || (drop / days) > 30) continue;
    intervals.push({ fromId:a.id, toId:b.id, days, drop, rate:drop/days, start, end, approximate: String(a.source||"").includes("led")||String(b.source||"").includes("led") });
  }
  return intervals;
}
export function analyzeIntervals(intervals) {
  const totalDays=intervals.reduce((s,i)=>s+i.days,0);
  if (!intervals.length || totalDays<=0) return { rate:null, confidence:"insuffisante", reason:"Aucun intervalle de décharge naturelle exploitable.", trend:"Données insuffisantes", intervals:0 };
  const rate=intervals.reduce((s,i)=>s+i.drop,0)/totalDays;
  const led=intervals.some(i=>i.approximate);
  const dispersion=Math.sqrt(intervals.reduce((s,i)=>s+i.days*Math.pow(i.rate-rate,2),0)/totalDays);
  const confidence=intervals.length>=4&&totalDays>=28&&!led&&dispersion<=Math.max(0.2,rate*0.5) ? "bonne" : intervals.length>=2&&totalDays>=7&&!led ? "moyenne" : "faible";
  const reason=intervals.length===1 ? "Un seul intervalle valide : estimation encore incertaine." : led ? "Les voyants LED donnent un niveau approximatif." : confidence==="bonne" ? `${intervals.length} intervalles cohérents sur ${Math.round(totalDays)} jours.` : `${intervals.length} intervalles sur ${Math.round(totalDays)} jours ; poursuivre les mesures.`;
  let trend="Données insuffisantes";
  if(intervals.length>=4 && totalDays>=21) {
    const half=Math.floor(intervals.length/2);
    const old=intervals.slice(0,half), recent=intervals.slice(half);
    const avg=a=>a.reduce((s,x)=>s+x.drop,0)/a.reduce((s,x)=>s+x.days,0);
    const diff=avg(recent)-avg(old), base=Math.max(0.05,avg(old));
    trend=diff>base*0.25?"Autodécharge en hausse":diff< -base*0.25?"Autodécharge en baisse":"Autodécharge stable";
  }
  return { rate, confidence, reason, trend, intervals:intervals.length, totalDays, dispersion };
}
export function recommendControl(battery, analysis, settings) {
  const chemistry=battery.chemistry||"unknown";
  const base=INITIAL_DAYS[chemistry]??30;
  const chosen=Number(battery.controlIntervalDays)||Number(settings.defaultControlIntervalDays)||30;
  let proposed=base;
  let reason="Intervalle initial prudent selon la chimie ; vérifier la notice du fabricant.";
  if (analysis.rate!==null && analysis.rate>0) {
    // Contrôler avant une baisse indicative de 10 points, indépendamment du seuil d'alerte.
    const rateLimited=Math.max(7,Math.min(base,Math.floor(10/analysis.rate)));
    if(rateLimited<proposed) { proposed=rateLimited; reason="Autodécharge mesurée : contrôle plus rapproché conseillé."; }
    else if (analysis.confidence==="bonne" && chemistry!=="unknown" && analysis.rate<0.1) {
      proposed=Math.min(120,Math.ceil(base*1.5));
      reason="Autodécharge faible et répétée : un contrôle plus espacé peut être envisagé.";
    }
  }
  if (battery.storageCondition==="warm") { proposed=Math.min(proposed,Math.max(7,Math.floor(base/2))); reason="Stockage chaud : rapprocher les contrôles."; }
  return { days:proposed, chosenDays:chosen, differs:proposed!==chosen, reason, chemistry };
}
export function nextControl(battery, measurements, settings, analysis, recommendation, now=Date.now()) {
  const dates=measurements.map(measureTimestamp).filter(Number.isFinite);
  const explicit=battery.lastControlAt ? new Date(battery.lastControlAt).getTime() : NaN;
  const last=Number.isFinite(explicit) ? explicit : Math.max(-Infinity,...dates);
  if (!Number.isFinite(last)) return { date:null, due:false, reason:"Première mesure à effectuer" };
  let when=last+recommendation.chosenDays*DAY;
  let reason="Contrôle périodique";
  const latest=[...measurements].filter(m=>Number.isFinite(measureTimestamp(m))).sort((a,b)=>measureTimestamp(a)-measureTimestamp(b)).at(-1);
  if (latest && analysis.rate>0 && ["moyenne","bonne"].includes(analysis.confidence)) {
    const threshold=Number(settings.criticalThresholdPercent);
    const daysToThreshold=(latest.levelPercent-threshold)/analysis.rate;
    if(Number.isFinite(daysToThreshold)) {
      const precaution=measureTimestamp(latest)+Math.max(0,daysToThreshold-7)*DAY;
      if(precaution<when){when=precaution;reason="Seuil prévisionnel avec marge de 7 jours";}
    }
  }
  const snooze=battery.reminderSnoozedUntil ? new Date(`${battery.reminderSnoozedUntil}T23:59:59`).getTime() : NaN;
  const due=when<=now;
  return { date:new Date(when).toISOString().slice(0,10), due, reminderVisible:due&&!(Number.isFinite(snooze)&&snooze>now), snoozedUntil:Number.isFinite(snooze)&&snooze>now?battery.reminderSnoozedUntil:null, reason };
}
