// Explicit, synthetic-only desktop timing. Never opens normal workspace/history.
const fs=require('node:fs/promises'),syncFs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http'),crypto=require('node:crypto'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const {_electron,chromium}=require('playwright'),{WebSocketServer}=require('ws');
const {DEFAULT_SETTINGS}=require('../electron/core.cjs'),{readPcmWave,summarize}=require('../evals/desktop-live.cjs');
const root=path.resolve(__dirname,'..'),arg=(key,fallback)=>process.argv.find(x=>x.startsWith('--'+key+'='))?.split('=').slice(1).join('=')||fallback;
const local=process.argv.includes('--local'),live=process.argv.includes('--live');
const question='Explain why binary search requires sorted input. Answer in two short sentences.';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function observeAnswer({overlay=false}={}){
 const state={armed:false};window.__e2eObserve=state;
 if(!overlay)document.addEventListener('click',event=>{if(state.armed&&event.target.closest('#generate-button,#screenshot-answer'))state.actionAt=performance.timeOrigin+performance.now();},true);
 if(!overlay)window.copilot.onLiveTranscript(value=>{if(state.armed){state.transcriptAt=performance.timeOrigin+performance.now();state.transcript=value.text;}});
 new MutationObserver(()=>{
  if(!state.armed)return;const now=performance.timeOrigin+performance.now(),el=document.querySelector(overlay?'#overlay-answer':'#answer-text');
  if(!overlay&&document.querySelector('#generate-button')?.hidden)state.generating=true;
  if(!el||el.classList.contains('empty'))return;const text=el.textContent.trim();if(!text)return;
  if(!state.first){state.first=now;state.prefix=text.slice(0,500);}
  if(!state.first40&&text.replace(/[`#*_\s]/g,'').length>=40){state.first40=now;state.prefix40=text.slice(0,700);}
  if(!overlay&&state.generating&&!document.querySelector('#generate-button')?.hidden){state.complete??=now;if(document.querySelector('#transcript-save-status')?.textContent==='Transcript and drafts saved on this device')state.saved??=now;}
 }).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','class']});
 window.__e2eArm=()=>{for(const key of Object.keys(state))delete state[key];state.armed=true;};
}
async function main(){
 assert(local!==live,'Choose exactly one of --local or --live.');const maximum=Number(arg('max-calls',12));assert(Number.isInteger(maximum)&&maximum>=1&&maximum<=12,'Use max-calls=1..12.');
 if(live)assert(process.argv.includes('--saved-connection'),'Live mode requires explicit --saved-connection.');
 const output=path.join(root,'test-results','desktop-live-'+Date.now()),profile=path.join(output,'profile');await fs.mkdir(profile,{recursive:true});
 const ledgerPath=live?path.resolve(arg('budget-ledger',path.join(root,'.local-project','desktop-live-budget.json'))):path.join(output,'budget.json');
 await fs.mkdir(path.dirname(ledgerPath),{recursive:true});
 if(syncFs.existsSync(ledgerPath))throw Error('Budget ledger exists; review its used calls before another run.');
 await fs.writeFile(ledgerPath,JSON.stringify({maximumCalls:maximum,used:0,requests:[],syntheticOnly:true,output:path.relative(root,output)}));
 const report={schemaVersion:1,version:require('../package.json').version,syntheticOnly:true,cloud:live,maximumRequests:maximum,realMicrophoneUsed:false,realDesktopPixelsUsed:false,audioPath:'Synthetic WebAudio microphone -> production AudioCapture/worklet -> live transcription -> question queue -> answer stream -> workspace/overlay -> durable save',screenScope:'Synthetic pixels replace native desktop acquisition; production capture encoding, validation and request path remain.',timingScope:'Typed/capture action or scheduled synthetic signal endpoint -> DOM text, generation completion and acknowledged save. DOM timestamps are not physical display paint. First40 is a length proxy, not semantic useful-answer timing.',networkScope:'Unshaped current connection, plus HTTP-only application pacing (300ms initial delay, 256Kbps request body, 1Mbps response). WebSocket audio is not shaped; this is not OS link emulation.',cases:[],startedAt:new Date().toISOString()};
 report.sourceCommit=require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();const sourceFiles=['package.json','scripts/benchmark-desktop-live.cjs','evals/desktop-live.cjs','evals/v08.cjs'];for(const dir of ['electron','renderer'])for(const name of await fs.readdir(path.join(root,dir)))if(/\.(?:cjs|js|css|html)$/.test(name))sourceFiles.push(dir+'/'+name);report.sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,crypto.createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex')])));
 let app,server,wss;const sockets=new Set();
 try{
  const synth=path.join(output,'synthesize.ps1'),wav=path.join(output,'question.wav');
  await fs.writeFile(synth,'Add-Type -AssemblyName System.Speech\n$s=New-Object System.Speech.Synthesis.SpeechSynthesizer\n$f=New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono)\ntry { $s.SetOutputToWaveFile($args[0],$f); $s.Speak("Explain why binary search requires sorted input. Answer in two short sentences.") } finally { $s.Dispose() }');
  await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-File',synth,wav],{windowsHide:true,timeout:30000});
  const bytes=await fs.readFile(wav),audio=readPcmWave(bytes),image=path.join(output,'question.png');
  const browser=await chromium.launch({channel:'msedge',headless:true});try{const fixture=require('../evals/v08.cjs').screens[0];const p=await browser.newPage({viewport:{width:fixture.width,height:fixture.height},deviceScaleFactor:2});await p.setContent(fixture.html);await p.screenshot({path:image});}finally{await browser.close();}
  report.fixtureHashes={audio:crypto.createHash('sha256').update(bytes).digest('hex'),image:crypto.createHash('sha256').update(await fs.readFile(image)).digest('hex')};report.syntheticAudio={seconds:audio.durationSeconds,scheduledEndpointSeconds:audio.endpointSeconds,voice:'Installed Windows synthetic voice, one phrase; no human speaker coverage'};
  let baseUrl=DEFAULT_SETTINGS.baseUrl,encryptedKey;
  if(local){
   server=http.createServer(async(req,res)=>{for await(const _ of req){}res.writeHead(200,{'Content-Type':'text/event-stream'});const event=(text,stop=false)=>'data: '+JSON.stringify({candidates:[{content:{parts:[{text}]},...(stop?{finishReason:'STOP'}:{})}]})+'\n\n';res.write(event('Binary search discards half of the sorted values at each step. '));setTimeout(()=>res.end(event('Without sorted input, that elimination is invalid.',true)),80);});server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));baseUrl='http://127.0.0.1:'+server.address().port+'/v1beta';
   wss=new WebSocketServer({server});wss.on('connection',socket=>socket.on('message',raw=>{const payload=JSON.parse(raw);if(payload.setup)socket.send(JSON.stringify({setupComplete:{}}));if(payload.realtimeInput?.audioStreamEnd&&!socket.finalSent){socket.finalSent=true;socket.send(JSON.stringify({serverContent:{inputTranscription:{text:question,finished:true}}}));}}));
  }else{
   const source=path.join(process.env.APPDATA,'Parakeet Studio'),saved=JSON.parse(await fs.readFile(path.join(source,'settings.json'),'utf8'));assert.equal(saved.provider,'gemini');assert.equal(saved.baseUrl,DEFAULT_SETTINGS.baseUrl);assert(saved.encryptedKey);encryptedKey=saved.encryptedKey;await fs.copyFile(path.join(source,'Local State'),path.join(profile,'Local State'));
  }
  // The copied credential remains encrypted. All other settings/context are synthetic defaults.
  await fs.writeFile(path.join(profile,'settings.json'),JSON.stringify({...DEFAULT_SETTINGS,baseUrl,encryptedKey,dataPolicy:live?'unpaid':'local',historyMode:'persist'}));
  app=await _electron.launch({executablePath:require('electron'),args:[root],env:{...process.env,PARAKEET_USER_DATA:profile}});const page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent!=='Checking connection');
  if(local)await page.evaluate(async baseUrl=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,baseUrl,apiKey:'synthetic-local-only',dataPolicy:'local'});},baseUrl);
  await app.evaluate(({dialog,desktopCapturer,nativeImage,screen},{image,diagnosticFile,ledgerPath,live,root})=>{
   const fs=process.getBuiltinModule('node:fs');globalThis.__e2eTransport='unshaped';
   const load=()=>JSON.parse(fs.readFileSync(ledgerPath,'utf8')),write=value=>fs.writeFileSync(ledgerPath,JSON.stringify(value,null,2));
   const taskRequire=process.getBuiltinModule('node:module').createRequire(root+'/package.json');const reserve=kind=>taskRequire('./evals/desktop-live.cjs').reserveRequest(ledgerPath,kind);
   const block=category=>{const value=load();value.blocked=category;write(value);};
   const originalFetch=globalThis.fetch;globalThis.fetch=async(url,options={})=>{
    const parsed=new URL(url);if(live&&parsed.hostname!=='generativelanguage.googleapis.com')throw Object.assign(Error('Unexpected benchmark destination.'),{name:'AbortError'});reserve('answer-http');
    const paced=globalThis.__e2eTransport==='http-paced';if(paced)await new Promise(resolve=>setTimeout(resolve,300+Buffer.byteLength(options.body||'')/32000*1000));
    const response=await originalFetch(url,options);if([401,403,429].includes(response.status))block('authentication-or-quota');if(!paced||!response.body)return response;
    const reader=response.body.getReader();const body=new ReadableStream({async pull(controller){try{const {value,done}=await reader.read();if(done){controller.close();return;}await new Promise(resolve=>setTimeout(resolve,value.byteLength/125000*1000));controller.enqueue(value);}catch(error){controller.error(error);}},cancel:reason=>reader.cancel(reason)});return new Response(body,{status:response.status,headers:response.headers});
   };
   const OriginalSocket=globalThis.WebSocket;globalThis.WebSocket=class extends OriginalSocket{constructor(url,...args){if(live&&new URL(url).hostname!=='generativelanguage.googleapis.com')throw Object.assign(Error('Unexpected benchmark destination.'),{name:'AbortError'});reserve('transcription-websocket');super(url,...args);this.addEventListener('message',event=>{try{const payload=JSON.parse(event.data);if(payload.error&&([401,403,429].includes(Number(payload.error.code))||/quota|permission|unauthenticat/i.test(payload.error.status||'')))block('authentication-or-quota');}catch{}});this.addEventListener('close',event=>{if([1008,1003,1007].includes(event.code))block('live-policy-or-authentication');});}};
   dialog.showSaveDialog=async()=>({canceled:false,filePath:diagnosticFile});dialog.showMessageBox=async(_window,options)=>({response:options.title==='Non-personal practice audio only'?1:0});
   desktopCapturer.getSources=async()=>[{display_id:String(screen.getPrimaryDisplay().id),name:'Synthetic benchmark image',thumbnail:nativeImage.createFromPath(image)}];
  },{image,diagnosticFile:path.join(output,'diagnostics.json'),ledgerPath,live,root});
  const installSyntheticAudio=({pcm,endpointSeconds})=>{
   window.__e2eInput=null;
   navigator.mediaDevices.enumerateDevices=async()=>[];
   navigator.mediaDevices.getDisplayMedia=async()=>{throw Error('Real display media is disabled in the benchmark.');};
   navigator.mediaDevices.getUserMedia=async()=>{
    const ctx=new AudioContext({sampleRate:16000}),destination=ctx.createMediaStreamDestination();await ctx.resume();
    window.__e2eInput={ctx,destination,async play(){await ctx.resume();const raw=Uint8Array.from(atob(pcm),x=>x.charCodeAt(0)),view=new DataView(raw.buffer),buffer=ctx.createBuffer(1,raw.length/2,16000),samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;const source=ctx.createBufferSource();source.buffer=buffer;source.connect(destination);const at=ctx.currentTime+.1;const origin=performance.timeOrigin+performance.now()+(at-ctx.currentTime)*1000;source.start(at);return {startedAt:origin,endpointAt:origin+endpointSeconds*1000};}};return destination.stream;
   };
  };
  await page.reload();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent==='AI provider configured');
  await page.evaluate(installSyntheticAudio,{pcm:audio.pcm.toString('base64'),endpointSeconds:audio.endpointSeconds});await page.evaluate(observeAnswer,{});
  await page.evaluate(()=>window.copilot.toggleOverlay());let overlay;for(let i=0;i<50&&!overlay;i++){overlay=app.windows().find(p=>p.url().includes('overlay.html'));if(!overlay)await delay(100);}assert(overlay,'Overlay window unavailable');await overlay.waitForLoadState();await overlay.evaluate(observeAnswer,{overlay:true});
  const plan=[...['unshaped','unshaped','http-paced'].flatMap((transport,round)=>['typed','screen','audio'].map(kind=>({id:kind+'-'+round,kind,transport})))];
  for(const item of plan){
   const ledger=JSON.parse(await fs.readFile(ledgerPath));if(ledger.blocked||ledger.used+(item.kind==='audio'?2:1)>maximum){report.stopped=ledger.blocked||'Insufficient remaining request budget for the next case';break;}ledger.currentCase=item.id;await fs.writeFile(ledgerPath,JSON.stringify(ledger));await app.evaluate((_,transport)=>{globalThis.__e2eTransport=transport;},item.transport);
   await page.click('#new-session');await page.waitForFunction(()=>!document.querySelector('#answer-text')?.textContent);await overlay.waitForFunction(()=>document.querySelector('#overlay-answer')?.classList.contains('empty'));await page.evaluate(()=>window.__e2eArm());await overlay.evaluate(()=>window.__e2eArm());
   let origin,playback;const prior=report.cases.length;
   if(item.kind==='audio'){
    await page.check('#auto-answer');await page.selectOption('#audio-source','microphone');await page.click('#capture-button');await page.waitForFunction(()=>document.querySelector('#capture-label').textContent==='Stop listening',null,{timeout:30000});playback=await page.evaluate(()=>window.__e2eInput.play());origin=playback.endpointAt;
   }else{
    await page.uncheck('#auto-answer');await page.fill('#question-input',item.kind==='typed'?question:'Fix the visible JavaScript function. Explain briefly and return executable code.');origin=await page.evaluate(()=>performance.timeOrigin+performance.now());await page.click(item.kind==='typed'?'#generate-button':'#screenshot-answer');origin=await page.evaluate(()=>window.__e2eObserve.actionAt);assert(Number.isFinite(origin),'Actual click timestamp missing');
   }
   let diagnostic,metric;const deadline=Date.now()+90000;
   do{await page.evaluate(()=>window.copilot.exportDiagnostics());diagnostic=JSON.parse(await fs.readFile(path.join(output,'diagnostics.json')));if(diagnostic.attempts>prior){metric=diagnostic.rows.at(-1);break;}const current=JSON.parse(await fs.readFile(ledgerPath));if(current.blocked)throw Error('Cloud benchmark stopped: '+current.blocked);await delay(100);}while(Date.now()<deadline);
   const row={...item,metric:metric||null};
   if(metric){const visible=await page.evaluate(()=>({...window.__e2eObserve,clock:performance.timeOrigin})),over=await overlay.evaluate(()=>({...window.__e2eObserve,clock:performance.timeOrigin}));
    row.visiblePrefixes={workspace:visible.prefix||'',first40:visible.prefix40||'',overlay:over.prefix||''};
    row.timings={firstVisibleMs:visible.first?visible.first-origin:null,first40VisibleMs:visible.first40?visible.first40-origin:null,overlayFirstVisibleMs:over.first?over.first-origin:null,completeMs:visible.complete?visible.complete-origin:null,savedMs:visible.saved?visible.saved-origin:null,saveAfterCompleteMs:metric.savedMs!==null&&metric.completedMs!==null?metric.savedMs-metric.completedMs:null,transcriptFinalMs:visible.transcriptAt?visible.transcriptAt-origin:null};
    row.recognizedSyntheticText=visible.transcript||null;
    const workspace=await page.evaluate(()=>window.copilot.loadWorkspace()),exchange=workspace.sessions[0]?.exchanges.at(-1),disk=JSON.parse(await fs.readFile(path.join(profile,'workspace.json'),'utf8')),persisted=disk.sessions?.flatMap(s=>s.exchanges||[]).find(e=>e.id===exchange?.id);
    row.persistedAnswerMatches=Boolean(exchange?.answer)&&persisted?.status==='complete'&&persisted.answer===exchange.answer;
    row.syntheticAnswer=exchange?.answer||'';row.timingsPresent=['firstVisibleMs','first40VisibleMs','overlayFirstVisibleMs','completeMs','savedMs'].every(key=>Number.isFinite(row.timings[key]));row.prematureAnswer=row.timings.firstVisibleMs<0||row.timings.overlayFirstVisibleMs<0;
   }
   report.cases.push(row);await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({case:item.id,outcome:metric?.outcome||'no-completion',calls:JSON.parse(await fs.readFile(ledgerPath)).used}));
   if(item.kind==='audio'){await page.click('#capture-button');await page.waitForFunction(()=>document.querySelector('#capture-label').textContent==='Start listening');await page.evaluate(()=>window.__e2eInput?.ctx.close());}
   if(!metric||metric.outcome!=='success'||metric.save!=='durable'||!row.persistedAnswerMatches){report.stopped='Incomplete answer or save failure';break;}
  }
  report.passed=report.cases.length===9&&report.cases.every(r=>r.metric?.outcome==='success'&&r.persistedAnswerMatches&&r.timingsPresent&&!r.prematureAnswer);
 }catch(error){report.passed=false;report.failure=String(error.message).replace(/(?:AIza|AQ\.)[\w.-]+/g,'[redacted]').slice(0,400);process.exitCode=1;}
 finally{
  await app?.close();for(const socket of wss?.clients||[])socket.terminate();if(wss)await new Promise(resolve=>wss.close(resolve));for(const socket of sockets)socket.destroy();if(server)await new Promise(resolve=>server.close(resolve));
  await fs.rm(path.join(profile,'Local State'),{force:true});await fs.rm(path.join(profile,'settings.json'),{force:true});await fs.rm(path.join(profile,'settings.json.bak'),{force:true});
  const ledger=JSON.parse(await fs.readFile(ledgerPath));report.requestsUsed=ledger.used;report.cloudRequests=live?ledger.used:0;report.groups=summarize(report.cases);report.completedAt=new Date().toISOString();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cloudRequests:report.cloudRequests,report:path.relative(root,path.join(output,'report.json'))}));if(!report.passed)process.exitCode=1;
 }
}
if(require.main===module)main().catch(error=>{console.error(String(error.message).replace(/(?:AIza|AQ\.)[\w.-]+/g,'[redacted]'));process.exitCode=1;});
module.exports={observeAnswer};
