const path=require('node:path');const {execFile}=require('node:child_process');
class TimerPolicyLease {
 constructor({targets,apply,restore,warn=()=>{},intervalMs=2000}){Object.assign(this,{targets,apply,restore,warn,intervalMs});this.snapshots=new Map();this.pending=Promise.resolve();this.epoch=0;this.active=false;}
 enqueue(task){this.pending=this.pending.then(task).catch(()=>this.warning());return this.pending;}
 warning(){if(!this.warned){this.warned=true;this.warn('Windows audio timing optimization is unavailable. If processing falls behind, capture will stop; check the audio device and restart.');}}
 setActive(active){active=Boolean(active);if(active===this.active)return this.pending;this.active=active;++this.epoch;
  if(active){this.warned=false;this.timer=setInterval(()=>void this.refresh(),this.intervalMs);this.timer.unref?.();return this.refresh();}
  clearInterval(this.timer);this.timer=null;return this.enqueue(async()=>{const saved=[...this.snapshots.values()];this.snapshots.clear();if(saved.length){const result=await this.restore(saved);if(result.some(x=>!x.ok))this.warning();}});
 }
 refresh(){if(this.refreshQueued)return this.pending;this.refreshQueued=true;const epoch=this.epoch;return this.enqueue(async()=>{try{
  if(!this.active||epoch!==this.epoch)return;
  const targets=this.targets().filter(x=>Number.isInteger(x.pid)&&x.pid>0);if(!targets.length)return;
  const result=await this.apply(targets.map(x=>x.pid));
  for(const row of result){if(!row.ok){this.warning();continue;}if(row.gone)continue;const target=targets.find(x=>x.pid===row.id);if(target){const key=`${target.pid}:${target.creationTime}`;if(!this.snapshots.has(key))this.snapshots.set(key,row);}}
 }finally{this.refreshQueued=false;}});}
 stop(){return this.setActive(false);}
}
function windowsTimingLease({app,warn}){
 const helper=app.isPackaged?path.join(process.resourcesPath,'TimerPolicy.exe'):path.join(__dirname,'../native/TimerPolicy.exe');
 const run=(mode,items)=>new Promise((resolve,reject)=>execFile(helper,[mode,process.execPath,...items],{windowsHide:true,timeout:5000,maxBuffer:65536},(error,stdout)=>{if(error)return reject(error);try{resolve(JSON.parse(stdout));}catch(error){reject(error);}}));
 return new TimerPolicyLease({targets:()=>process.platform==='win32'?app.getAppMetrics().map(x=>({pid:x.pid,creationTime:x.creationTime})):[],apply:ids=>run('apply',ids.map(String)),restore:rows=>run('restore',rows.map(x=>`${x.id}:${x.control}:${x.state}:${x.startTicks}`)),warn});
}
module.exports={TimerPolicyLease,windowsTimingLease};
