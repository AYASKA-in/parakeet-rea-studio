const test=require('node:test');const assert=require('node:assert/strict');
const {RuntimeGate,ShortcutRegistry}=require('../electron/desktop-runtime.cjs');
const {fitWindow}=require('../electron/overlay-layout.cjs');

test('sleep invalidates pending operations and recovery waits for capture acknowledgement',()=>{
  const gate=new RuntimeGate(),old=gate.begin();gate.pause('suspend');
  assert.throws(()=>gate.begin(),/recovery/);gate.resume('suspend');assert.equal(gate.blocked,true);
  gate.acknowledge(gate.epoch);assert.equal(gate.blocked,false);assert.throws(()=>gate.assert(old),/interrupted/);
  assert.doesNotThrow(()=>gate.assert(gate.begin()));
});
test('overlapping screen lock and suspend cannot release each other',()=>{
  const gate=new RuntimeGate();gate.pause('lock');const first=gate.epoch;gate.pause('suspend');
  gate.acknowledge(first);assert.equal(gate.settling,true);gate.resume('suspend');gate.acknowledge(gate.epoch);
  assert.equal(gate.blocked,true);assert.deepEqual(gate.snapshot().reasons,['lock']);gate.resume('lock');assert.equal(gate.blocked,false);
});
test('duplicate power events do not invalidate an in-progress stop acknowledgement',()=>{
  const gate=new RuntimeGate();assert.equal(gate.pause('lock'),true);const epoch=gate.epoch;
  assert.equal(gate.pause('lock'),false);assert.equal(gate.epoch,epoch);gate.acknowledge(epoch);gate.resume('lock');assert.equal(gate.blocked,false);
});
test('renderer failure invalidates old work without inventing a screen-lock state',()=>{
  const gate=new RuntimeGate(),old=gate.begin();gate.invalidate();assert.throws(()=>gate.assert(old),/interrupted/);
  assert.equal(gate.blocked,false);assert.equal(gate.snapshot().lastReason,null);
});
function shortcuts(){
  const bound=new Set(),calls=[],removed=[],unavailable=new Set(['B']);
  const adapter={register(key){calls.push(key);if(key==='C')throw Error('reserved');if(unavailable.has(key))return false;bound.add(key);return true;},unregister(key){removed.push(key);bound.delete(key);},isRegistered:key=>bound.has(key)};
  const registry=new ShortcutRegistry(adapter,['A','B','C'].map(id=>({id,label:id,accelerator:id,run(){}})));
  return {registry,bound,calls,removed,unavailable};
}
test('shortcut registration failures and exceptions are visible and do not stop other bindings',()=>{
  const f=shortcuts();assert.deepEqual(f.registry.refresh().map(x=>x.registered),[true,false,false]);assert.deepEqual(f.calls,['A','B','C']);
  f.unavailable.clear();assert.deepEqual(f.registry.refresh().map(x=>x.registered),[true,true,false]);assert.deepEqual(f.calls,['A','B','C','B','C']);
});
test('shortcut recovery re-registers owned bindings and retries missing registrations',()=>{
  const f=shortcuts();f.registry.refresh();f.bound.delete('A');f.registry.refresh();assert.equal(f.calls.filter(x=>x==='A').length,2);
  f.registry.refresh({reset:true});assert.deepEqual(f.removed,['A']);assert.equal(f.bound.has('A'),true);
});
test('window recovery preserves a visible window and fits disconnected or smaller work areas',()=>{
  const visible={x:-1200,y:40,width:460,height:560},area={x:-1280,y:0,width:1280,height:720};
  assert.deepEqual(fitWindow(visible,area),visible);
  for(const target of [area,{x:0,y:0,width:1920,height:1032},{x:120,y:-600,width:320,height:240}]){
    const fitted=fitWindow({x:9000,y:-9000,width:1600,height:1400},target);
    assert.ok(fitted.x>=target.x&&fitted.y>=target.y);assert.ok(fitted.x+fitted.width<=target.x+target.width);assert.ok(fitted.y+fitted.height<=target.y+target.height);
  }
  assert.throws(()=>fitWindow(visible,{x:0,y:0,width:0,height:0}),/work area/);
});
