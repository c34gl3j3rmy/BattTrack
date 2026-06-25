import { MEASUREMENT_TYPES, STATUS, DASHBOARD_SORTS } from "./constants.js";
export function calculateBatteryStatus(battery, measurements, settings) {
  const sortedMeasurements = sortMeasurementsAscending(measurements);
  if (sortedMeasurements.length === 0) return createUninitializedStatus(battery.id);
  const cycles = buildCycles(sortedMeasurements);
  const points = normalizeMeasurementsByCycle(cycles);
  const regression = calculateLinearRegression(points);
  const lastMeasurement = sortedMeasurements.at(-1);
  const dischargePerDay = regression.slope < 0 ? Math.abs(regression.slope) : 0;
  const estimatedLevelPercent = estimateCurrentLevel(lastMeasurement, dischargePerDay);
  const estimatedThresholdDate = calculateEstimatedThresholdDate(measurementDatePart(lastMeasurement), lastMeasurement.levelPercent, dischargePerDay, settings.criticalThresholdPercent);
  const status = calculateStatus({ estimatedLevelPercent, lastLevelPercent: lastMeasurement.levelPercent, settings });
  return { batteryId: battery.id, lastLevelPercent: lastMeasurement.levelPercent, estimatedLevelPercent, estimatedLevelIsAvailable: estimatedLevelPercent !== null, lastMeasurementDate: measurementDatePart(lastMeasurement), lastChargeDate: getLastChargeDate(sortedMeasurements), measurementCount: sortedMeasurements.length, cycleCount: cycles.length, averageDischargePerDay: dischargePerDay, estimatedThresholdDate, status, confidence: calculateConfidence(points, regression.rmse) };
}
export function buildCycles(measurements) { const cycles=[]; let currentCycle=[]; for (const measurement of measurements) { if (measurement.type===MEASUREMENT_TYPES.CHARGE || currentCycle.length===0) { if (currentCycle.length>0) cycles.push(currentCycle); currentCycle=[measurement]; } else currentCycle.push(measurement); } if (currentCycle.length>0) cycles.push(currentCycle); return cycles; }
export function normalizeMeasurementsByCycle(cycles) { const points=[]; for (const cycle of cycles) { const start=cycle[0]; for (const m of cycle) points.push({x:daysBetween(measurementDatePart(start),measurementDatePart(m)), y:m.levelPercent, measurementId:m.id}); } return points; }
export function calculateLinearRegression(points) { if (points.length < 2) return { slope:0, intercept:points[0]?.y ?? 0, rmse:null }; const n=points.length, sumX=points.reduce((s,p)=>s+p.x,0), sumY=points.reduce((s,p)=>s+p.y,0), sumXY=points.reduce((s,p)=>s+p.x*p.y,0), sumXX=points.reduce((s,p)=>s+p.x*p.x,0); const denominator=n*sumXX-sumX*sumX; if (denominator===0) return { slope:0, intercept:sumY/n, rmse:null }; const slope=(n*sumXY-sumX*sumY)/denominator; const intercept=(sumY-slope*sumX)/n; const rmse=Math.sqrt(points.map(p=>Math.pow(p.y-(slope*p.x+intercept),2)).reduce((s,v)=>s+v,0)/n); return { slope, intercept, rmse }; }
export function estimateCurrentLevel(lastMeasurement, dischargePerDay) { if (!dischargePerDay || dischargePerDay <= 0) return null; const elapsed=daysBetween(lastMeasurement.date, todayIso()); return Math.max(0, Math.min(100, Math.round(lastMeasurement.levelPercent - dischargePerDay * elapsed))); }
export function calculateEstimatedThresholdDate(referenceDate, lastLevelPercent, dischargePerDay, thresholdPercent) { if (lastLevelPercent <= thresholdPercent) return referenceDate; if (!dischargePerDay || dischargePerDay <= 0) return null; const daysUntilThreshold=Math.ceil((lastLevelPercent-thresholdPercent)/dischargePerDay); const date=new Date(`${referenceDate}T00:00:00`); date.setDate(date.getDate()+daysUntilThreshold); return date.toISOString().slice(0,10); }
export function calculateStatus({ estimatedLevelPercent, lastLevelPercent, settings }) { const level = estimatedLevelPercent ?? lastLevelPercent; if (level <= settings.criticalThresholdPercent) return STATUS.RED; if (level <= settings.alertThresholdPercent) return STATUS.ORANGE; return STATUS.GREEN; }
export function calculateConfidence(points, rmse) { if (points.length<2) return "inconnue"; if (points.length<4) return "faible"; if (rmse!==null && rmse>12) return "moyenne"; if (points.length<8) return "moyenne"; return "bonne"; }
export function calculateMeasurementRates(measurements) { const sorted=sortMeasurementsAscending(measurements); return sorted.map((m,index)=>{ if(index===0) return {...m, ratePerDay:null, rateLabel:"-"}; const prev=sorted[index-1]; if(m.type===MEASUREMENT_TYPES.CHARGE) return {...m, ratePerDay:null, rateLabel:"Nouveau cycle"}; const days=daysBetween(measurementDatePart(prev),measurementDatePart(m)); if(days<=0) return {...m, ratePerDay:null, rateLabel:"-"}; const rate=(prev.levelPercent-m.levelPercent)/days; return {...m, ratePerDay:rate, rateLabel:`${rate>=0?"-":"+"}${Math.abs(rate).toFixed(2).replace(".",",")} %/j`}; }); }
export function sortBatteryStatusItems(items, sortMode) { const priority={ [STATUS.RED]:0, [STATUS.ORANGE]:1, [STATUS.UNINITIALIZED]:2, [STATUS.GREEN]:3 }; const list=[...items]; return list.sort((a,b)=>{ if(sortMode===DASHBOARD_SORTS.NAME) return a.battery.name.localeCompare(b.battery.name,"fr"); if(sortMode===DASHBOARD_SORTS.ESTIMATED_LEVEL) return nullableLevel(a.status.estimatedLevelPercent)-nullableLevel(b.status.estimatedLevelPercent) || a.battery.name.localeCompare(b.battery.name,"fr"); if(sortMode===DASHBOARD_SORTS.STATUS || sortMode===DASHBOARD_SORTS.URGENCY) { const diff=priority[a.status.status]-priority[b.status.status]; return diff || a.battery.name.localeCompare(b.battery.name,"fr"); } if(sortMode===DASHBOARD_SORTS.LAST_MEASUREMENT) return compareNullableDatesDesc(a.status.lastMeasurementDate,b.status.lastMeasurementDate) || a.battery.name.localeCompare(b.battery.name,"fr"); if(sortMode===DASHBOARD_SORTS.LAST_CHARGE) return compareNullableDatesDesc(a.status.lastChargeDate,b.status.lastChargeDate) || a.battery.name.localeCompare(b.battery.name,"fr"); return a.battery.name.localeCompare(b.battery.name,"fr"); }); }
function nullableLevel(v){ return v === null || v === undefined ? 999 : v; }
function compareNullableDatesDesc(a,b){ if(!a&&!b)return 0; if(!a)return 1; if(!b)return -1; return b.localeCompare(a); }
function createUninitializedStatus(batteryId){ return { batteryId, lastLevelPercent:null, estimatedLevelPercent:null, estimatedLevelIsAvailable:false, lastMeasurementDate:null, lastChargeDate:null, measurementCount:0, cycleCount:0, averageDischargePerDay:0, estimatedThresholdDate:null, status:STATUS.UNINITIALIZED, confidence:"inconnue" }; }
function getLastChargeDate(measurements){ const charge=measurements.filter(m=>m.type===MEASUREMENT_TYPES.CHARGE).at(-1); return charge ? measurementDatePart(charge) : null; }) || null; }
export function todayIso(){ return new Date().toISOString().slice(0,10); }
export function daysBetween(startDate,endDate){ const start=new Date(`${startDate}T00:00:00`); const end=new Date(`${endDate}T00:00:00`); return Math.round((end-start)/86400000); }
export function formatRelativeDate(dateIso){ if(!dateIso)return "-"; const days=daysBetween(dateIso,todayIso()); if(days===0)return "aujourd'hui"; if(days===1)return "il y a 1 j"; if(days<0)return `dans ${Math.abs(days)} j`; return `il y a ${days} j`; }


export function measurementSortKey(measurement) {
  return measurement.measuredAt ?? `${measurement.date}T00:00`;
}

export function sortMeasurementsAscending(measurements) {
  return [...measurements].sort((a, b) => measurementSortKey(a).localeCompare(measurementSortKey(b)));
}

export function sortMeasurementsDescending(measurements) {
  return [...measurements].sort((a, b) => measurementSortKey(b).localeCompare(measurementSortKey(a)));
}

export function formatMeasurementDateTime(measurement) {
  const value = measurement.measuredAt ?? `${measurement.date}T00:00`;
  const [date, time = "00:00"] = value.split("T");
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year} ${time}`;
}

export function measurementDatePart(measurement) {
  return (measurement.measuredAt ?? `${measurement.date}T00:00`).slice(0, 10);
}
