import test from "node:test";
import assert from "node:assert/strict";
import { validateDataset,previewDataset } from "../js/db.js";
const b={id:"a-b",name:"Drone"},m={id:"m-1",batteryId:"a-b",measuredAt:"2026-06-26T12:00",levelPercent:88};
test("Ancienne sauvegarde V1 reconnue sans nouvelle table",()=>{
 assert.equal(validateDataset({batteries:[b],measurements:[m],settings:[]}),true);
 assert.equal(previewDataset({batteries:[b],measurements:[m]}).usageEvents,0);
});
test("Une mesure orpheline est refusée avant restauration",()=>{
 assert.throws(()=>validateDataset({batteries:[],measurements:[m]}),/orpheline/);
});
test("Les identifiants malveillants sont refusés",()=>{
 assert.throws(()=>validateDataset({batteries:[{id:'x" onmouseover="alert(1)',name:"A"}],measurements:[]}),/Identifiant/);
});
test("Un fichier de récupération avec usage est reconnu",()=>{
 const data={batteries:[b],measurements:[m],usageEvents:[{id:"u-1",batteryId:"a-b",usedAt:"2026-06-26T13:00"}]};
 assert.equal(previewDataset(data).usageEvents,1);
});
