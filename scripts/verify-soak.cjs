// Real wall-clock packaged-app endurance test. All audio and provider output are synthetic.
const fs=require('node:fs/promises');const path=require('node:path');const http=require('node:http');const assert=require('node:assert/strict');const crypto=require('node:crypto');
const {_electron}=require('playwright');const {WebSocketServer}=require('ws');
const root=path.resolve(__dirname,'..');
const minutes=Number(process.argv.find(x=>x.startsWith('--minutes='))?.split('=')[1]||120);
if(!Number.isFinite(minutes)||minutes<=0||minutes>240)throw Error('Use --minutes=1..240');
const source=process.argv.includes('--single')?'microphone':'both';
const hardware=process.argv.includes('--hardware');
const sourceBuild=process.argv.includes('--source');
const visible=process.argv.includes('--visible');
const nativeFixture=!process.argv.includes('--web-audio-fixture');
const output=path.join(root,'test-results',`${hardware?'hardware':'soak'}-${source}-${Date.now()}`);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 await fs.mkdir(output,{recursive:true});const profile=path.join(output,'profile');
 const report={version:require('../package.json').version,minutesRequested:minutes,source,hardware,encryptedWorkspace:process.argv.includes('--encrypt'),syntheticOnly:true,cloudRequests:0,realDeviceCapture:false,hiddenWindows:!visible,samples:[],faults:[],reviewActions:[],errors:[],transcripts:0,answers:0,audioFrames:0,audioBytes:0,connections:0};
 let app,page,blocker,server,ws;const sent=new Set(),received=new Set();let answerRequests=0;
 const persist=()=>fs.writeFile(path.join(output,'progress.json'),JSON.stringify(report,null,2));
 try{
  const audioModule=await fs.readFile(path.join(root,'renderer/audio.js'),'utf8');const {encodeWav}=await import(`data:text/javascript;base64,${Buffer.from(audioModule).toString('base64')}`);
  const samples=new Float32Array(48000*10);for(let i=0;i<48000;i++)samples[i]=Math.sin(2*Math.PI*220*i/48000)*.05;
  const audioFile=path.join(output,'synthetic-input.wav');await fs.writeFile(audioFile,Buffer.from(encodeWav([samples],48000)));report.audioFixture=nativeFixture?'Chromium registered fake-microphone input for each source; no actual microphone or system playback':'WebAudio MediaStreamDestination fixture';
  server=http.createServer(async(req,res)=>{for await(const _ of req){}answerRequests++;report.answers++;
   res.writeHead(200,{'Content-Type':'text/event-stream'});res.end(`data: ${JSON.stringify({candidates:[{content:{parts:[{text:'Synthetic endurance answer. Preserve retry_limit=7.'}]},finishReason:'STOP'}]})}\n\n`);
  });
  ws=new WebSocketServer({server});
  ws.on('connection',socket=>{report.connections++;let last=-1;const connection=report.connections;
   socket.on('error',error=>report.errors.push({kind:'socket',message:error.message}));
   socket.on('message',bytes=>{const value=JSON.parse(bytes.toString());
    if(value.setup)socket.send(JSON.stringify({setupComplete:{}}));
    if(value.realtimeInput?.audio){report.audioFrames++;report.audioBytes+=Buffer.from(value.realtimeInput.audio.data,'base64').length;
     const slot=Math.floor((Date.now()-report.startedMs)/30000);
     // One finalized turn per connection per 30 seconds; deterministic IDs permit persistence checks.
     if(slot!==last){last=slot;const id=`SOAK_${connection}_${slot}`;sent.add(id);socket.send(JSON.stringify({serverContent:{inputTranscription:{text:`Explain synthetic checkpoint ${id} with retry_limit=7?`},turnComplete:true}}));}
    }
    if(value.realtimeInput?.audioStreamEnd)socket.send(JSON.stringify({serverContent:{turnComplete:true}}));
   });
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  report.packaged=!sourceBuild;
  app=await _electron.launch({executablePath:sourceBuild?require('electron'):path.join(root,'dist/win-unpacked/Parakeet Studio.exe'),args:[...(nativeFixture?['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-audio-capture=${audioFile}`]:[]),...(process.argv.includes('--foreground-renderer')?['--disable-renderer-backgrounding']:[]),...(sourceBuild?[root]:[])],env:{...process.env,PARAKEET_USER_DATA:profile},timeout:45000});page=await app.firstWindow();
  report.appIdentity=await app.evaluate(({app})=>({version:app.getVersion(),foregroundRenderer:app.commandLine.hasSwitch('disable-renderer-backgrounding')}));assert.equal(report.appIdentity.version,report.version);assert.equal(report.appIdentity.foregroundRenderer,true);
  report.harnessSha256=crypto.createHash('sha256').update(await fs.readFile(__filename)).digest('hex');if(!sourceBuild)report.appAsarSha256=crypto.createHash('sha256').update(await fs.readFile(path.join(root,'dist/win-unpacked/resources/app.asar'))).digest('hex');
  page.on('pageerror',error=>report.errors.push({kind:'renderer',message:error.message}));
  await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent!=='Checking connection');
  await page.evaluate(async ({baseUrl,encrypt})=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,encryptWorkspace:encrypt,provider:'gemini',baseUrl,apiKey:'synthetic-soak-only',dataPolicy:'local',networkMode:'standard',answerMode:'fast'});
   await window.copilot.saveWorkspace({context:{},sessions:Array.from({length:99},(_,i)=>({id:`history-${i}`,title:`Synthetic history ${i}`,createdAt:new Date().toISOString(),transcript:Array.from({length:40},(_,j)=>({id:`h-${i}-${j}`,text:`Synthetic retained segment ${j}`,source:'system',timestamp:Date.now()})),exchanges:[],context:{}}))});
  },{baseUrl:`http://127.0.0.1:${server.address().port}/v1beta`,encrypt:process.argv.includes('--encrypt')});
  await page.reload();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent==='AI provider configured');
  await page.evaluate(async nativeFixture=>{
   globalThis.soakContexts=[];globalThis.soakEvents=[];
   const {AudioCapture}=await import('./audio.js');const checkClock=AudioCapture.prototype.checkClock;
   if(checkClock){globalThis.soakClock=[];AudioCapture.prototype.checkClock=function(session,wallNow=performance.now()){if(session.clockMark){soakClock.push({wall:wallNow,audio:session.context.currentTime,elapsed:wallNow-session.clockMark.wall,processed:(session.context.currentTime-session.clockMark.audio)*1000});if(soakClock.length>200)soakClock.shift();}return checkClock.call(this,session,wallNow);};}
   const stream=async(frequency)=>{const context=new AudioContext({sampleRate:16000});const buffer=context.createBuffer(1,160000,16000);const data=buffer.getChannelData(0);for(let i=0;i<16000;i++)data[i]=Math.sin(2*Math.PI*frequency*i/16000)*.05;const node=context.createBufferSource();node.buffer=buffer;node.loop=true;const destination=context.createMediaStreamDestination();node.connect(destination);node.start();await context.resume();soakContexts.push(context);return destination.stream;};
   if(nativeFixture){const getUserMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getDisplayMedia=()=>getUserMedia({audio:true,video:false});}
   else {navigator.mediaDevices.getUserMedia=()=>stream(220);navigator.mediaDevices.getDisplayMedia=()=>stream(440);}
   window.copilot.onLiveTranscript(event=>soakEvents.push({kind:'transcript',...event}));window.copilot.onLiveError(event=>soakEvents.push({kind:'error',event}));window.copilot.onLiveStatus(event=>soakEvents.push({kind:'status',event}));
  },nativeFixture);
  await page.selectOption('#audio-source',source);await page.check('#auto-answer');
  report.startedMs=Date.now();report.startedAt=new Date(report.startedMs).toISOString();
  await page.click('#capture-button');await page.waitForFunction(()=>document.querySelector('#capture-label').textContent==='Stop listening');
  blocker=await app.evaluate(({powerSaveBlocker,powerMonitor,BrowserWindow},{hardware,visible})=>{globalThis.hardwareEvents=[];for(const name of ['suspend','resume','lock-screen','unlock-screen'])powerMonitor.on(name,()=>hardwareEvents.push({name,at:new Date().toISOString()}));const id=hardware?null:powerSaveBlocker.start('prevent-display-sleep');if(!visible)for(const win of BrowserWindow.getAllWindows())win.hide();return id;},{hardware,visible});
  report.idleSuspensionBlockedForTest=!hardware;report.displaySleepBlockedForTest=!hardware;await persist();console.log(`START ${source} ${minutes} minutes; ${output}`);
  let nextFault=Number(process.argv.find(x=>x.startsWith('--fault-after-seconds='))?.split('=')[1]||600)*1000,lastCheckpoint=0,reviewAt=Infinity;
  while(Date.now()-report.startedMs<minutes*60000){
   await pause(Math.min(30000,Math.max(1,minutes*60000-(Date.now()-report.startedMs))));
   const elapsedMs=Date.now()-report.startedMs;
   if(!hardware&&elapsedMs>=nextFault){const count=ws.clients.size;for(const socket of ws.clients)socket.close(1012,'Synthetic reconnect test');report.faults.push({elapsedMs,type:'live-disconnect',sockets:count});nextFault+=15*60000;reviewAt=elapsedMs+5000;}
   if(elapsedMs>=reviewAt){const reviewed=await page.evaluate(()=>{const button=document.querySelector('#pending-question-send');if(button&&!button.disabled&&button.getClientRects().length){button.click();return true;}return false;});if(reviewed){report.reviewActions.push({elapsedMs,action:'explicit synthetic question review/send after reconnect'});reviewAt=Infinity;}}
   const metrics=await app.evaluate(({app})=>app.getAppMetrics().map(x=>({pid:x.pid,type:x.type,cpu:x.cpu.percentCPUUsage,workingSetKB:x.memory.workingSetSize})));
   const state=await page.evaluate(async()=>({label:document.querySelector('#capture-label').textContent,clock:globalThis.soakClock,events:soakEvents.splice(0),runtime:await window.copilot.getRuntime(),workspace:await window.copilot.loadWorkspace()}));report.audioClock=state.clock;
   for(const event of state.events)if(event.kind==='transcript'){report.transcripts++;const id=event.text?.match(/SOAK_\d+_\d+/)?.[0];if(id)received.add(id);}else if(event.kind==='error')report.errors.push({elapsedMs,kind:'live',event:event.event});
   const sample={elapsedMs,workingSetMiB:metrics.reduce((n,p)=>n+p.workingSetKB/1024,0),electronCpuSum:metrics.reduce((n,p)=>n+p.cpu,0),processes:metrics.length,frames:report.audioFrames,answers:report.answers,transcripts:report.transcripts,sessions:state.workspace.sessions.length,workspaceBytes:(await fs.stat(path.join(profile,'workspace.json'))).size,label:state.label};
   report.samples.push(sample);
   if(hardware){report.hardwareEvents=await app.evaluate(()=>hardwareEvents);if(report.hardwareEvents.some(x=>x.name==='resume')&&!state.runtime.blocked){assert.equal(state.label,'Start listening','Listening restarted without an explicit action after real sleep');report.stoppedAfterResume=true;await page.evaluate(()=>document.querySelector('#capture-button').click());await page.waitForFunction(()=>document.querySelector('#capture-label').textContent==='Stop listening',null,{timeout:30000});await pause(3000);report.explicitRestartPassed=true;break;}}
   else {assert.equal(state.label,'Stop listening','Capture unexpectedly stopped');assert.equal(state.runtime.blocked,false,'Desktop recovery interrupted continuous soak');}
   assert.equal(sample.sessions,100);
   if(Math.floor(elapsedMs/60000)>lastCheckpoint){lastCheckpoint=Math.floor(elapsedMs/60000);console.log(`MINUTE ${lastCheckpoint}: ${sample.frames} frames; ${sample.transcripts} final turns; ${sample.answers} answers; ${Math.round(sample.workingSetMiB)} MiB`);}
   await persist();
  }
  await page.evaluate(()=>document.querySelector('#capture-button').click());await page.waitForFunction(()=>document.querySelector('#capture-label').textContent==='Start listening',null,{timeout:20000});await pause(1800);
  const workspace=await page.evaluate(()=>window.copilot.loadWorkspace());const saved=JSON.stringify(workspace);
  report.savedNotices=workspace.sessions.flatMap(session=>session.transcript||[]).filter(segment=>segment.source==='status').map(segment=>segment.text);
  report.missingSavedIds=[...sent].filter(id=>!saved.includes(id));assert.deepEqual(report.missingSavedIds,[],'Finalized synthetic transcript missing from saved history');
  report.answerRequests=answerRequests;assert.ok(answerRequests>0);if(hardware)assert.equal(report.explicitRestartPassed,true,'A genuine OS resume event and explicit capture restart were not observed');else assert.ok(report.audioFrames>minutes*200,'Audio did not sustain expected throughput');
  assert.deepEqual(report.errors,[],'Unexpected renderer or Live errors');report.status='passed';
 }catch(error){report.status='failed';report.failure=error.stack;process.exitCode=1;}
 finally{
  report.endedAt=new Date().toISOString();report.actualDurationMs=report.startedMs?Date.now()-report.startedMs:0;
  if(app){try{await app.evaluate(({powerSaveBlocker},id)=>{if(Number.isInteger(id))powerSaveBlocker.stop(id);},blocker);}catch{}try{await app.close();}catch{}}
  if(ws){for(const socket of ws.clients)socket.terminate();await new Promise(r=>ws.close(r));}if(server)await new Promise(r=>server.close(r));
  await persist();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(`${report.status.toUpperCase()} ${output} (${Math.round(report.actualDurationMs/1000)} seconds)`);
 }
})();
