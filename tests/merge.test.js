import test from "node:test";
import assert from "node:assert/strict";
import { mergeSnapshots,emptySnapshot } from "../js/sync/merge.js";
function snapshot(items=[],more={}) {return {...emptySnapshot(), batteries:items,...more};}
const a={id:"a",name:"A",updatedAt:"2026-01-01"};
const b={id:"b",name:"B"};
test("Ajouts concurrents distincts sans conflit",()=>{
 const result=mergeSnapshots(emptySnapshot(),snapshot([a]),snapshot([b]));
 assert.equal(result.conflicts.length,0);
 assert.deepEqual(result.data.batteries.map(x=>x.id).sort(),["a","b"]);
});
test("Éditions concurrentes de la même batterie : conflit explicite",()=>{
 const base=snapshot([a]);
 const result=mergeSnapshots(base,snapshot([{...a,name:"A local"}]),snapshot([{...a,name:"A distant"}]));
 assert.deepEqual(result.conflicts.map(c=>c.key),["batteries:a"]);
 assert.equal(result.data.batteries.length,0);
 const resolved=mergeSnapshots(base,snapshot([{...a,name:"A local"}]),snapshot([{...a,name:"A distant"}]),{"batteries:a":"local"});
 assert.equal(resolved.data.batteries[0].name,"A local");
});
test("Suppression contre modification : conflit",()=>{
 const base=snapshot([a]);
 const local=snapshot([], {tombstones:[{key:"batteries:a",id:"a",store:"batteries"}]});
 const remote=snapshot([{...a,name:"Batterie modifiée"}]);
 assert.equal(mergeSnapshots(base,local,remote).conflicts.length,1);
});
test("Une suppression synchronisée ne ressuscite pas",()=>{
 const base=snapshot([a]);
 const tomb={key:"batteries:a",id:"a",store:"batteries"};
 const local=snapshot([],{tombstones:[tomb]});
 const remote=snapshot([a]);
 const result=mergeSnapshots(base,local,remote);
 assert.equal(result.conflicts.length,0);
 assert.equal(result.data.batteries.length,0);
 assert.equal(result.data.tombstones.length,1);
});
test('Explicitly keeping the edited version cancels its deletion marker',()=>{
  const base=snapshot([a]);
  const local=snapshot([],{tombstones:[{key:'batteries:a',id:'a',store:'batteries'}]});
  const remote=snapshot([{...a,name:'Batterie modifiee'}]);
  const resolved=mergeSnapshots(base,local,remote,{'batteries:a':'remote'});
  assert.equal(resolved.conflicts.length,0);
  assert.equal(resolved.data.batteries[0]?.name,'Batterie modifiee');
  assert.equal(resolved.data.tombstones.length,0);
});
test('Explicitly choosing deletion keeps the deletion marker',()=>{
  const base=snapshot([a]);
  const local=snapshot([],{tombstones:[{key:'batteries:a',id:'a',store:'batteries'}]});
  const remote=snapshot([{...a,name:'Batterie modifiee'}]);
  const resolved=mergeSnapshots(base,local,remote,{'batteries:a':'local'});
  assert.equal(resolved.conflicts.length,0);
  assert.equal(resolved.data.batteries.length,0);
  assert.equal(resolved.data.tombstones.length,1);
});
test('Deleting a parent while editing its measurement requires a parent decision',()=>{
  const parent={id:'battery-1',name:'D'};
  const original={id:'measure-1',batteryId:'battery-1',levelPercent:90};
  const edited={...original,levelPercent:75};
  const base=snapshot([parent],{measurements:[original]});
  const local=snapshot([],{measurements:[],tombstones:[
    {key:'batteries:battery-1',id:'battery-1',store:'batteries'},
    {key:'measurements:measure-1',id:'measure-1',store:'measurements'}
  ]});
  const remote=snapshot([parent],{measurements:[edited]});
  const stage1=mergeSnapshots(base,local,remote);
  assert.ok(stage1.conflicts.some(c=>c.key==='measurements:measure-1'));
  const stage2=mergeSnapshots(base,local,remote,{'measurements:measure-1':'remote'});
  assert.ok(stage2.conflicts.some(c=>c.key==='batteries:battery-1'));
  const resolved=mergeSnapshots(base,local,remote,{'measurements:measure-1':'remote','batteries:battery-1':'remote'});
  assert.equal(resolved.conflicts.length,0);
  assert.equal(resolved.data.batteries.length,1);
  assert.equal(resolved.data.measurements[0]?.levelPercent,75);
  assert.equal(resolved.data.tombstones.length,0);
});
