import test from "node:test";
import assert from "node:assert/strict";
import { observedIntervals, analyzeIntervals, recommendControl, nextControl } from "../js/recommendations.js";
import { calculateBatteryStatus } from "../js/calculation.js";
const settings={criticalThresholdPercent:20,alertThresholdPercent:30,defaultControlIntervalDays:30};
const battery={id:"battery",chemistry:"lipo",controlIntervalDays:null,storageCondition:"normal"};
const measure=(id,date,level,excludeFromPrevious=false)=>({id,batteryId:"battery",type:"measure",source:"manual_percentage",measuredAt:date,levelPercent:level,excludeFromPrevious});
const m=[measure("a","2026-06-26T07:38",87),measure("b","2026-06-30T07:38",85),measure("c","2026-07-01T20:01",76,true)];
test("La chute causée par l'utilisation est exclue mais 76 % reste la référence",()=>{
 const intervals=observedIntervals(m);
 assert.equal(intervals.length,1);
 assert.equal(intervals[0].rate,0.5);
 const result=calculateBatteryStatus(battery,m,settings);
 assert.equal(result.averageDischargePerDay,0.5);
 assert.equal(result.lastLevelPercent,76);
 assert.equal(result.validIntervals,1);
});
test("Un événement d'utilisation entre les mesures exclut le segment",()=>{
 const intervals=observedIntervals(m.slice(0,2),[{usedAt:"2026-06-28T18:00"}]);
 assert.equal(intervals.length,0);
 const status=calculateBatteryStatus(battery,m.slice(0,2),settings,[{usedAt:"2026-06-28T18:00"}]);
 assert.equal(status.averageDischargePerDay,null);
 assert.equal(status.estimatedLevelIsAvailable,false);
});
test("Les mesures LED sont considérées approximatives",()=>{
 const samples=[...m.slice(0,2).map(x=>({...x,source:"manual_led_simple"}))];
 const analysis=analyzeIntervals(observedIntervals(samples));
 assert.equal(analysis.confidence,"faible");
});
test("La recommandation est une proposition, pas une modification de la batterie",()=>{
 const analysis=analyzeIntervals(observedIntervals(m));
 const result=recommendControl(battery,analysis,settings);
 assert.equal(result.chosenDays,30);
 assert.equal(result.days,20);
 assert.equal(battery.controlIntervalDays,null);
});
test("Une batterie non mesurée ne reçoit pas une date inventée",()=>{
 const analysis=analyzeIntervals([]),rec=recommendControl(battery,analysis,settings);
 assert.equal(nextControl(battery,[],settings,analysis,rec).date,null);
});
