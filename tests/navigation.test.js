import test from 'node:test';
import assert from 'node:assert/strict';
import { initNavigation, navigate, modalOpened, modalClosed } from '../js/navigation.js';

test('Android back closes modal, then returns to dashboard', () => {
  const listeners = {};
  const url = new URL('https://example.com/BattTrack/');
  const entries = [{state:null, url:url.pathname}], pos = {value:0};
  globalThis.location = url;
  globalThis.window = {addEventListener(type,fn){listeners[type]=fn;}};
  globalThis.history = {
    get state(){return entries[pos.value].state;},
    replaceState(state,unused,path){entries[pos.value]={state,url:path};},
    pushState(state,unused,path){entries.splice(pos.value+1); entries.push({state,url:path});pos.value++;},
    back(){if(pos.value>0){pos.value--;listeners.popstate?.({state:entries[pos.value].state});}}
  };
  const routes=[];
  let closed=0;
  assert.equal(initNavigation(route=>routes.push(route.view),()=>closed++).view,'dashboard');
  navigate({view:'battery-details',batteryId:'drone'},{push:true});
  assert.equal(history.state.batteryId,'drone');
  modalOpened();
  assert.equal(history.state.modal,true);
  history.back();
  assert.equal(closed,1);
  assert.deepEqual(routes,[]);
  history.back();
  assert.deepEqual(routes,['dashboard']);
  assert.equal(history.state.view,'dashboard');
});
