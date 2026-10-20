const test=require('node:test');const assert=require('node:assert/strict');const {TimerPolicyLease}=require('../electron/audio-timing.cjs');
const tick=()=>new Promise(r=>setImmediate(r));const row=id=>({id,ok:true,control:1,state:1,startTicks:String(id*100)});
test('audio timer policy refreshes owned targets while preserving their original snapshots',async()=>{
 let targets=[{pid:10,creationTime:1}],applied=[],restored=[];
 const lease=new TimerPolicyLease({targets:()=>targets,apply:async ids=>{applied.push(ids);return ids.map(row);},restore:async rows=>{restored.push(rows);return rows;}});
 await lease.setActive(true);await lease.setActive(true);await lease.refresh();assert.deepEqual(applied,[[10],[10]]);
 targets=[...targets,{pid:20,creationTime:2}];await lease.refresh();assert.deepEqual(applied,[[10],[10],[10,20]]);
 await lease.stop();assert.equal(restored.length,1);assert.deepEqual(restored[0].map(x=>x.id),[10,20]);assert.equal(lease.snapshots.size,0);assert.equal(lease.timer,null);
});
test('stop during pending timer apply waits and restores its late successful snapshot',async()=>{
 let release,restored=[];const lease=new TimerPolicyLease({targets:()=>[{pid:10}],apply:()=>new Promise(r=>release=r),restore:async rows=>{restored=rows;return rows;}});
 const starting=lease.setActive(true);await tick();const stopping=lease.stop();release([row(10)]);await Promise.all([starting,stopping]);assert.equal(lease.active,false);assert.deepEqual(restored.map(x=>x.id),[10]);assert.equal(lease.snapshots.size,0);
});
test('timer failures warn once per session and still permit cleanup and a new attempt',async()=>{
 let warnings=0;const lease=new TimerPolicyLease({targets:()=>[{pid:10}],apply:async()=>{throw Error('unsupported');},restore:async()=>[],warn:()=>warnings++});
 await lease.setActive(true);await lease.refresh();assert.equal(warnings,1);await lease.stop();await lease.setActive(true);assert.equal(warnings,2);await lease.stop();
});
test('pending timer refreshes coalesce and a reused process identity is reapplied',async()=>{
 let release,calls=0,creationTime=1;const lease=new TimerPolicyLease({targets:()=>[{pid:10,creationTime}],apply:ids=>{calls++;return calls===1?new Promise(r=>release=r):Promise.resolve(ids.map(row));},restore:async rows=>rows});
 const first=lease.setActive(true);await tick();const second=lease.refresh(),third=lease.refresh();release([row(10)]);await Promise.all([first,second,third]);assert.equal(calls,1);creationTime=2;await lease.refresh();assert.equal(calls,2);await lease.stop();
});
