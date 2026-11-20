// Fusion à trois voies, sans priorité arbitraire à la date de modification d'un appareil.
const STORES = ["batteries", "measurements", "usageEvents", "tombstones"];
export function emptySnapshot() { return { formatVersion:2, batteries:[], measurements:[], usageEvents:[], tombstones:[], settings:{} }; }
function equal(a,b) { return JSON.stringify(a??null) === JSON.stringify(b??null); }
function rows(snapshot, field) { return new Map((snapshot?.[field]??[]).map(x=>[field==="tombstones"?x.key:x.id,x])); }
export function mergeSnapshots(baseInput, local, remote, resolutions = {}) {
  const base=baseInput??emptySnapshot();
  const output=emptySnapshot(), conflicts=[];
  for(const field of STORES) {
    const old=rows(base,field), a=rows(local,field), b=rows(remote,field);
    const keys=new Set([...old.keys(),...a.keys(),...b.keys()]);
    for(const id of keys) {
      const original=old.get(id), mine=a.get(id), theirs=b.get(id);
      let chosen;
      if(equal(mine,theirs)) chosen=mine;
      else if(equal(mine,original)) chosen=theirs;
      else if(equal(theirs,original)) chosen=mine;
      else if(resolutions[`${field}:${id}`]==="local") chosen=mine;
      else if(resolutions[`${field}:${id}`]==="remote") chosen=theirs;
      else { conflicts.push({key:`${field}:${id}`,field,id,local:mine??null,remote:theirs??null,original:original??null}); continue; }
      if(chosen) output[field].push(chosen);
    }
  }
  const settingsKeys=new Set([...Object.keys(base.settings??{}),...Object.keys(local.settings??{}),...Object.keys(remote.settings??{})]);
  for(const key of settingsKeys) {
    const original=base.settings?.[key], mine=local.settings?.[key], theirs=remote.settings?.[key];
    let chosen;
    if(equal(mine,theirs)) chosen=mine;
    else if(equal(mine,original)) chosen=theirs;
    else if(equal(theirs,original)) chosen=mine;
    else if(resolutions[`settings:${key}`]==="local") chosen=mine;
    else if(resolutions[`settings:${key}`]==="remote") chosen=theirs;
    else { conflicts.push({key:`settings:${key}`,field:"settings",id:key,local:mine??null,remote:theirs??null,original:original??null}); continue; }
    if(chosen !== undefined) output.settings[key]=chosen;
  }
  // A deliberate keep-local/keep-remote decision on a record also resolves its delete marker.
  const explicitlyKept = new Set();
  for (const field of ["batteries", "measurements", "usageEvents"]) {
    for (const item of output[field]) {
      const key = `${field}:${item.id}`;
      if (resolutions[key] === "local" || resolutions[key] === "remote") explicitlyKept.add(key);
    }
  }
  output.tombstones = output.tombstones.filter(t => !explicitlyKept.has(t.key));
  const deleted=new Set(output.tombstones.map(t=>t.key));
  for(const field of ["batteries","measurements","usageEvents"]) output[field]=output[field].filter(x=>!deleted.has(`${field}:${x.id}`));
  // An edited child of a deleted battery cannot be dropped without a decision.
  const batteryIds=new Set(output.batteries.map(b=>b.id));
  const baseParents=rows(base,"batteries"), localParents=rows(local,"batteries"), remoteParents=rows(remote,"batteries");
  const parentConflicts=new Set(conflicts.map(x=>x.key));
  for(const field of ["measurements","usageEvents"]) {
    const oldChildren=rows(base,field);
    for(const item of output[field]) {
      if(batteryIds.has(item.batteryId) || equal(item,oldChildren.get(item.id))) continue;
      const parentId=item.batteryId, key=`batteries:${parentId}`;
      if(!resolutions[key]) {
        if(!parentConflicts.has(key)) {
          conflicts.push({key,field:"batteries",id:parentId,local:localParents.get(parentId)??null,remote:remoteParents.get(parentId)??null,original:baseParents.get(parentId)??null});
          parentConflicts.add(key);
        }
      } else {
        const selected=(resolutions[key]==="local"?localParents:remoteParents).get(parentId);
        if(selected && !batteryIds.has(parentId)) {
          output.batteries.push(selected);
          batteryIds.add(parentId);
          output.tombstones=output.tombstones.filter(t=>t.key!==key);
        }
      }
    }
  }
  for(const field of ["measurements","usageEvents"]) output[field]=output[field].filter(x=>batteryIds.has(x.batteryId));
  return { data:output, conflicts };
}
