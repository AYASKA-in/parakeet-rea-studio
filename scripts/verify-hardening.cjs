const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const http=require('node:http');const {spawn}=require('node:child_process');const {_electron}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'test-results');
const execute=require('node:util').promisify(require('node:child_process').execFile);
const packaged=process.argv.includes('--packaged');const executable=packaged?path.join(root,'dist/win-unpacked/Parakeet Studio.exe'):require('electron');
(async()=>{
 await fs.mkdir(output,{recursive:true});const profile=await fs.mkdtemp(path.join(output,'hardening-private-'));
 let requestCount=0,lastAuthorization='',holdResponse=false,responseClosed=false;
 const server=http.createServer(async(req,res)=>{requestCount++;lastAuthorization=req.headers['x-goog-api-key'];for await(const _ of req){}if(holdResponse){res.on('close',()=>{responseClosed=true;});res.writeHead(200,{'Content-Type':'text/event-stream'});res.write(`data: ${JSON.stringify({candidates:[{content:{parts:[{text:'SYNTHETIC STREAM PARTIAL'}]}}]})}\n\n`);return;}res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({candidates:[{content:{parts:[{text:'SYNTHETIC PARTIAL'}]},finishReason:'MAX_TOKENS'}]}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const baseUrl=`http://127.0.0.1:${server.address().port}/v1beta`;
 const report={startedAt:new Date().toISOString(),packaged,syntheticOnly:true,realProviderRequests:0,checks:[]};let app,page;
 const check=async(name,task)=>{await task();report.checks.push(name);console.log('PASS '+name);};
 const measureContrast=selector=>page.locator(selector).evaluate(el=>{
  const light=color=>(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number).map(n=>{const c=n/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  let parent=el,background=getComputedStyle(el).backgroundColor;
  while((background==='rgba(0, 0, 0, 0)'||!background)&&parent.parentElement){parent=parent.parentElement;background=getComputedStyle(parent).backgroundColor;}
  if(background==='rgba(0, 0, 0, 0)'||!background)background='rgb(255,255,255)';
  const a=light(getComputedStyle(el).color),b=light(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 });
 try{
  app=await _electron.launch({executablePath:executable,args:packaged?[]:[root],env:{...process.env,PARAKEET_USER_DATA:profile},timeout:45000});page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent!=='Checking connection');
  await page.evaluate(async baseUrl=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,baseUrl,apiKey:'synthetic-key-A',dataPolicy:'local'});},baseUrl);
  await check('Windows timer policy is scoped to listening and restored on stop',async()=>{
   const helper=packaged?path.join(root,'dist/win-unpacked/resources/TimerPolicy.exe'):path.join(root,'native/TimerPolicy.exe');
   const identity=await app.evaluate(()=>({pid:process.pid,executable:process.execPath}));
   const inspect=async()=>JSON.parse((await execute(helper,['inspect',identity.executable,String(identity.pid)],{windowsHide:true})).stdout)[0];
   const before=await inspect();assert.equal(before.ok,true,JSON.stringify({identity,before}));
   await page.evaluate(()=>window.copilot.setOverlay({listening:true}));let active;
   for(let i=0;i<60;i++){active=await inspect();if((active.control&4)===4&&(active.state&4)===0)break;await new Promise(r=>setTimeout(r,30));}
   assert.equal(active.control&4,4);assert.equal(active.state&4,0);
   await page.evaluate(()=>window.copilot.setOverlay({listening:false}));let restored;
   for(let i=0;i<60;i++){restored=await inspect();if((restored.control&4)===(before.control&4)&&(restored.state&4)===(before.state&4))break;await new Promise(r=>setTimeout(r,30));}
   assert.equal(restored.control&4,before.control&4);assert.equal(restored.state&4,before.state&4);
   await page.evaluate(()=>window.copilot.setOverlay({listening:true}));
   for(let i=0;i<60;i++){active=await inspect();if((active.control&4)===4)break;await new Promise(r=>setTimeout(r,30));}
   await app.evaluate(({powerMonitor})=>powerMonitor.emit('suspend'));
   for(let i=0;i<60;i++){restored=await inspect();if((restored.control&4)===(before.control&4))break;await new Promise(r=>setTimeout(r,30));}
   assert.equal(restored.control&4,before.control&4);
   await app.evaluate(({powerMonitor})=>powerMonitor.emit('resume'));await page.waitForFunction(async()=>!(await window.copilot.getRuntime()).blocked);
  });
  await check('Windows helper rejects a mismatched executable identity without changing policy',async()=>{
   const helper=packaged?path.join(root,'dist/win-unpacked/resources/TimerPolicy.exe'):path.join(root,'native/TimerPolicy.exe');
   const pid=await app.evaluate(()=>process.pid);const result=JSON.parse((await execute(helper,['apply',path.join(root,'synthetic-wrong-executable.exe'),String(pid)],{windowsHide:true})).stdout)[0];assert.equal(result.ok,false);assert.equal(result.error,5);
  });
  await check('legacy settings and history migrate with the key preserved and policy gated',async()=>{
   await app.close();
   const legacy=JSON.parse(await fs.readFile(path.join(profile,'settings.json'),'utf8'));delete legacy.dataPolicy;delete legacy.credentialBinding;
   await fs.writeFile(path.join(profile,'settings.json'),JSON.stringify(legacy));await fs.writeFile(path.join(profile,'workspace.json'),JSON.stringify({context:{resume:'SYNTHETIC LEGACY CONTEXT'},sessions:[]}));
   app=await _electron.launch({executablePath:executable,args:packaged?[]:[root],env:{...process.env,PARAKEET_USER_DATA:profile},timeout:45000});page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent==='Choose data-use policy');
   const loaded=await page.evaluate(async()=>({s:await window.copilot.getSettings(),w:await window.copilot.loadWorkspace()}));assert.equal(loaded.s.hasApiKey,true);assert.equal(loaded.s.dataPolicy,'unknown');assert.equal(loaded.w.context.resume,'SYNTHETIC LEGACY CONTEXT');
   await page.evaluate(async()=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,dataPolicy:'local'});});
  });
  await page.reload();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent==='AI provider configured');
  await check('failed save stays dirty and Retry saving persists the pending snapshot',async()=>{
   await page.click('[data-view="context"]');await fs.mkdir(path.join(profile,'workspace.json.tmp'));
   await page.fill('#context-role','SYNTHETIC DIRTY ROLE');await page.locator('#retry-context-save').waitFor({state:'visible'});
   await fs.rmdir(path.join(profile,'workspace.json.tmp'));await page.click('#retry-context-save');await page.waitForFunction(()=>document.querySelector('#transcript-save-status').textContent==='Transcript and drafts saved on this device');
   assert.equal(JSON.parse(await fs.readFile(path.join(profile,'workspace.json'),'utf8')).context.role,'SYNTHETIC DIRTY ROLE');
  });
  await check('clear-context UI refreshes recovery snapshots',async()=>{
   await page.click('#clear-context');await page.locator('#clear-context-dialog').waitFor({state:'visible'});await page.click('#clear-context-dialog button[value="confirm"]');await page.waitForFunction(()=>document.querySelector('#toast').textContent.startsWith('Personal context cleared'));
   for(const name of ['workspace.json','workspace.json.bak'])assert.ok(!(await fs.readFile(path.join(profile,name),'utf8')).includes('SYNTHETIC DIRTY ROLE'));
  });
  await check('outgoing-text preview is available before generating',async()=>{
   await page.click('[data-view="workspace"]');await page.fill('#question-input','Explain arrays');await page.click('#preview-request');await page.locator('#outbound-review-dialog').waitFor({state:'visible'});assert.match(await page.inputValue('#outbound-review-text'),/Explain arrays/);await page.click('#outbound-review-dialog button');
  });
  await check('origin changes clear credentials and backup',async()=>{
   const result=await page.evaluate(async()=>{const s=await window.copilot.getSettings();return window.copilot.saveSettings({...s,baseUrl:'https://different.example.invalid/v1beta',dataPolicy:'reviewed'});});assert.equal(result.hasApiKey,false);
   assert.ok(!JSON.parse(await fs.readFile(path.join(profile,'settings.json.bak'),'utf8')).encryptedKey);
  });
  await page.evaluate(async baseUrl=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,baseUrl,apiKey:'synthetic-key-A',dataPolicy:'local'});},baseUrl);
  await check('in-flight request retains its immutable credential snapshot',async()=>{
   await app.evaluate(({safeStorage})=>{const original=safeStorage.isAsyncEncryptionAvailable.bind(safeStorage);let first=true;safeStorage.isAsyncEncryptionAvailable=()=>{if(first){first=false;globalThis.auditDecryptPaused=true;return new Promise(resolve=>{globalThis.releaseAuditDecrypt=()=>resolve(true);});}return original();};});
   const running=page.evaluate(async()=>{try{await window.copilot.generate({requestId:'snapshot-race',question:'synthetic test'});}catch(error){return String(error);}});
   for(let i=0;i<100;i++){if(await app.evaluate(()=>Boolean(globalThis.auditDecryptPaused)))break;await new Promise(r=>setTimeout(r,20));}
   assert.equal(await app.evaluate(()=>Boolean(globalThis.auditDecryptPaused)),true);
   await page.evaluate(async()=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,baseUrl:'https://different.example.invalid/v1beta',apiKey:'synthetic-key-B',dataPolicy:'reviewed'});});
   await app.evaluate(()=>globalThis.releaseAuditDecrypt());assert.match(await running,/output limit/);assert.equal(lastAuthorization,'synthetic-key-A');
  });
  await check('Live startup reserves settings and Stop cancels a pending key lookup before connection',async()=>{
   await page.evaluate(async baseUrl=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,provider:'gemini',baseUrl,apiKey:'synthetic-key-A',dataPolicy:'local'});},baseUrl);
   await app.evaluate(({safeStorage})=>{const original=safeStorage.isAsyncEncryptionAvailable.bind(safeStorage);let first=true;globalThis.liveDecryptPaused=false;safeStorage.isAsyncEncryptionAvailable=()=>{if(first){first=false;globalThis.liveDecryptPaused=true;return new Promise(resolve=>{globalThis.releaseLiveDecrypt=()=>resolve(true);});}return original();};});
   const before=requestCount;
   const starting=page.evaluate(async()=>{try{return await window.copilot.startLive({sources:['microphone','system']});}catch(error){return String(error);}});
   for(let i=0;i<100;i++){if(await app.evaluate(()=>Boolean(globalThis.liveDecryptPaused)))break;await new Promise(r=>setTimeout(r,20));}
   assert.equal(await app.evaluate(()=>Boolean(globalThis.liveDecryptPaused)),true);
   const blocked=await page.evaluate(async()=>{const s=await window.copilot.getSettings();try{await window.copilot.saveSettings({...s});return false;}catch(error){return /Stop listening/.test(String(error));}});assert.equal(blocked,true);
   await page.evaluate(()=>window.copilot.stopLive());await app.evaluate(()=>globalThis.releaseLiveDecrypt());
   assert.match(await starting,/stopped/);assert.equal(requestCount,before);
   await page.evaluate(async()=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s});});
  });
  await check('display change during credential lookup rejects a screenshot before provider upload',async()=>{
   await app.evaluate(({desktopCapturer,nativeImage,screen})=>{desktopCapturer.getSources=async()=>[{display_id:String(screen.getPrimaryDisplay().id),name:'Synthetic',thumbnail:nativeImage.createFromBitmap(Buffer.alloc(320*180*4,255),{width:320,height:180})}];});
   await app.evaluate(({safeStorage})=>{const original=safeStorage.isAsyncEncryptionAvailable.bind(safeStorage);let first=true;globalThis.screenDecryptPaused=false;safeStorage.isAsyncEncryptionAvailable=()=>{if(first){first=false;globalThis.screenDecryptPaused=true;return new Promise(resolve=>{globalThis.releaseScreenDecrypt=()=>resolve(true);});}return original();};});
   const count=requestCount;
   const running=page.evaluate(async()=>{const capture=await window.copilot.captureScreenshot({});try{await window.copilot.generate({requestId:'screen-race',question:'Synthetic',imageDataUrl:capture.dataUrl,captureId:capture.captureId});}catch(error){return String(error);}});
   for(let i=0;i<100;i++){if(await app.evaluate(()=>Boolean(globalThis.screenDecryptPaused)))break;await new Promise(r=>setTimeout(r,20));}
   assert.equal(await app.evaluate(()=>Boolean(globalThis.screenDecryptPaused)),true);
   await app.evaluate(({screen})=>{screen.emit('display-metrics-changed',{},screen.getPrimaryDisplay(),['bounds']);globalThis.releaseScreenDecrypt();});
   assert.match(await running,/Screenshot expired or the display changed/);assert.equal(requestCount,count);
  });
  await check('shortcut registration failure is visible and Retry attempts the unavailable key again',async()=>{
   await app.evaluate(({globalShortcut})=>{globalShortcut.unregister('CommandOrControl+Shift+M');globalThis.shortcutAttempts=0;globalThis.originalShortcutRegister=globalShortcut.register.bind(globalShortcut);globalShortcut.register=(key,callback)=>{if(key==='CommandOrControl+Shift+M'){globalThis.shortcutAttempts++;return false;}return globalThis.originalShortcutRegister(key,callback);};});
   await page.click('[data-view="settings"]');await page.click('#retry-shortcuts');
   await page.waitForFunction(()=>document.querySelector('#shortcut-conflicts').textContent.includes('Show workspace'));
   report.shortcutContrast=await measureContrast('#shortcut-status');assert.ok(report.shortcutContrast>=4.5);
   const first=await app.evaluate(()=>globalThis.shortcutAttempts);assert.ok(first>0);
   await page.screenshot({path:path.join(output,'shortcut-conflicts.png'),fullPage:true});
   await page.click('#retry-shortcuts');assert.ok(await app.evaluate(()=>globalThis.shortcutAttempts)>first);
   await app.evaluate(({globalShortcut})=>{globalShortcut.register=globalThis.originalShortcutRegister;});
   await page.click('[data-view="workspace"]');
  });
  await check('sleep during key lookup rejects old work after resume without provider egress',async()=>{
   await app.evaluate(({safeStorage})=>{const original=safeStorage.isAsyncEncryptionAvailable.bind(safeStorage);let first=true;globalThis.powerDecryptPaused=false;safeStorage.isAsyncEncryptionAvailable=()=>{if(first){first=false;globalThis.powerDecryptPaused=true;return new Promise(resolve=>{globalThis.releasePowerDecrypt=()=>resolve(true);});}return original();};});
   const count=requestCount;
   const running=page.evaluate(async()=>{try{await window.copilot.generate({requestId:'power-race',question:'Synthetic operation waiting for credentials'});}catch(error){return String(error);}});
   for(let i=0;i<100;i++){if(await app.evaluate(()=>Boolean(globalThis.powerDecryptPaused)))break;await new Promise(r=>setTimeout(r,20));}
   assert.equal(await app.evaluate(()=>Boolean(globalThis.powerDecryptPaused)),true);
   await app.evaluate(({powerMonitor})=>powerMonitor.emit('suspend'));
   const blocked=await page.evaluate(async()=>{try{await window.copilot.generate({requestId:'blocked-power',question:'Synthetic'});}catch(error){return String(error);}});assert.match(blocked,/recovery/);
   await app.evaluate(({powerMonitor})=>powerMonitor.emit('resume'));
   await page.waitForFunction(async()=>!(await window.copilot.getRuntime()).blocked);
   await app.evaluate(()=>globalThis.releasePowerDecrypt());assert.match(await running,/interrupted by desktop recovery/);assert.equal(requestCount,count);
  });
  await check('resume does not override a remaining screen lock and unlock keeps recording stopped',async()=>{
   await app.evaluate(({powerMonitor})=>{powerMonitor.emit('lock-screen');powerMonitor.emit('suspend');powerMonitor.emit('resume');});
   const locked=await page.evaluate(()=>window.copilot.getRuntime());assert.equal(locked.blocked,true);assert.deepEqual(locked.reasons,['lock']);
   await app.evaluate(({powerMonitor})=>powerMonitor.emit('unlock-screen'));
   await page.waitForFunction(async()=>!(await window.copilot.getRuntime()).blocked);
   assert.equal(await page.textContent('#capture-label'),'Start listening');await page.locator('#desktop-recovery-notice').waitFor({state:'visible'});
   report.recoveryContrast=await measureContrast('#desktop-recovery-message');assert.ok(report.recoveryContrast>=4.5);
   await page.screenshot({path:path.join(output,'desktop-recovery.png'),fullPage:true});
  });
  await check('locking during renderer audio startup does not revive capture after unlock',async()=>{
   await app.evaluate(({safeStorage})=>{const original=safeStorage.isAsyncEncryptionAvailable.bind(safeStorage);let first=true;globalThis.captureDecryptPaused=false;safeStorage.isAsyncEncryptionAvailable=()=>{if(first){first=false;globalThis.captureDecryptPaused=true;return new Promise(resolve=>{globalThis.releaseCaptureDecrypt=()=>resolve(true);});}return original();};});
   const count=requestCount;await page.click('#capture-button');
   for(let i=0;i<100;i++){if(await app.evaluate(()=>Boolean(globalThis.captureDecryptPaused)))break;await new Promise(r=>setTimeout(r,20));}
   assert.equal(await app.evaluate(()=>Boolean(globalThis.captureDecryptPaused)),true);
   await app.evaluate(({powerMonitor})=>powerMonitor.emit('lock-screen'));
   await page.waitForFunction(()=>document.querySelector('#capture-label').textContent==='Start listening');
   await app.evaluate(({powerMonitor})=>powerMonitor.emit('unlock-screen'));
   await page.waitForFunction(async()=>!(await window.copilot.getRuntime()).blocked);
   await app.evaluate(()=>globalThis.releaseCaptureDecrypt());await new Promise(resolve=>setTimeout(resolve,250));
   assert.equal(await page.textContent('#capture-label'),'Start listening');assert.equal(requestCount,count);
  });
  await check('capture finishing after lock cannot reopen a screenshot review',async()=>{
   await app.evaluate(({desktopCapturer})=>{globalThis.captureSourcesOriginal=desktopCapturer.getSources;globalThis.screenCapturePaused=false;desktopCapturer.getSources=async(...args)=>{globalThis.screenCapturePaused=true;await new Promise(resolve=>{globalThis.releaseScreenCapture=resolve;});return globalThis.captureSourcesOriginal(...args);};});
   const count=requestCount;await page.click('#screenshot-answer');
   for(let i=0;i<100;i++){if(await app.evaluate(()=>Boolean(globalThis.screenCapturePaused)))break;await new Promise(r=>setTimeout(r,20));}
   assert.equal(await app.evaluate(()=>Boolean(globalThis.screenCapturePaused)),true);
   await app.evaluate(({powerMonitor})=>{powerMonitor.emit('lock-screen');powerMonitor.emit('unlock-screen');});
   await page.waitForFunction(async()=>!(await window.copilot.getRuntime()).blocked);
   await app.evaluate(()=>globalThis.releaseScreenCapture());
   await page.waitForFunction(()=>!document.querySelector('#screen-analysis-dialog').open&&document.querySelector('#screenshot-answer').textContent==='Answer screenshot');
   assert.equal(requestCount,count);await app.evaluate(({desktopCapturer})=>{desktopCapturer.getSources=globalThis.captureSourcesOriginal;});
  });
  await check('document picker finishing after lock is rejected before reading or opening review',async()=>{
   await app.evaluate(({dialog})=>{globalThis.documentPickerOriginal=dialog.showOpenDialog;globalThis.documentPickerPaused=false;dialog.showOpenDialog=()=>{globalThis.documentPickerPaused=true;return new Promise(resolve=>{globalThis.releaseDocumentPicker=()=>resolve({canceled:false,filePaths:['D:/__parakeet_synthetic_never_read__/fixture.pdf']});});};});
   await page.click('[data-view="context"]');await page.click('#import-resume');
   assert.equal(await app.evaluate(()=>Boolean(globalThis.documentPickerPaused)),true);
   await app.evaluate(({powerMonitor})=>{powerMonitor.emit('suspend');powerMonitor.emit('resume');});
   await page.waitForFunction(async()=>!(await window.copilot.getRuntime()).blocked);
   await app.evaluate(()=>globalThis.releaseDocumentPicker());
   await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('interrupted by desktop recovery'));
   assert.equal(await page.evaluate(()=>document.querySelector('#resume-review-dialog').open),false);
   await app.evaluate(({dialog})=>{dialog.showOpenDialog=globalThis.documentPickerOriginal;});await page.click('[data-view="workspace"]');
  });
  await check('display changes recover off-screen windows without showing a hidden overlay',async()=>{
   await page.evaluate(()=>window.copilot.toggleOverlay());
   for(let i=0;i<100;i++){if(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().some(w=>w.webContents.getURL().endsWith('/overlay.html'))))break;await new Promise(resolve=>setTimeout(resolve,30));}
   await page.evaluate(()=>window.copilot.requestAction('hide-overlay'));
   await app.evaluate(({BrowserWindow,screen})=>{const windows=BrowserWindow.getAllWindows(),main=windows.find(w=>new URL(w.webContents.getURL()).pathname.endsWith('/index.html')),overlay=windows.find(w=>w.webContents.getURL().endsWith('/overlay.html'));if(!main||!overlay)throw Error('Missing test windows: '+JSON.stringify(windows.map(w=>({id:w.id,url:w.webContents.getURL(),title:w.getTitle()}))));overlay.setBounds({x:9000,y:-9000,width:700,height:800});main.setBounds({x:9000,y:-9000,width:3000,height:2000});screen.emit('display-metrics-changed',{},screen.getPrimaryDisplay(),['workArea']);});
   let result;
   for(let i=0;i<100;i++){
    result=await app.evaluate(({BrowserWindow,screen})=>{const windows=BrowserWindow.getAllWindows();return{fit:windows.every(w=>{const b=w.getBounds(),a=screen.getDisplayMatching(b).workArea;return b.x>=a.x&&b.y>=a.y&&b.x+b.width<=a.x+a.width&&b.y+b.height<=a.y+a.height;}),hidden:!windows.find(w=>w.webContents.getURL().endsWith('/overlay.html')).isVisible(),protected:windows.every(w=>w.isContentProtected())};});
    if(result.fit&&result.hidden)break;await new Promise(resolve=>setTimeout(resolve,30));
   }
   assert.deepEqual(result,{fit:true,hidden:true,protected:true});
  });
  await check('sleep cancels an active answer stream and preserves a partial draft without replay',async()=>{
   holdResponse=true;responseClosed=false;await page.fill('#question-input','Synthetic stream interruption test');await page.click('#generate-button');
   await page.waitForFunction(()=>document.querySelector('#answer-text')?.textContent.includes('SYNTHETIC STREAM PARTIAL'));
   const count=requestCount;await app.evaluate(({powerMonitor})=>powerMonitor.emit('suspend'));
   await page.waitForFunction(()=>!document.querySelector('#generate-button').hidden);
   assert.match(await page.textContent('#answer-text'),/SYNTHETIC STREAM PARTIAL/);
   await page.waitForFunction(async()=>{const w=await window.copilot.loadWorkspace();return w.sessions.some(s=>s.exchanges.some(e=>e.question==='Synthetic stream interruption test'&&e.status==='partial'));});
   await app.evaluate(({powerMonitor})=>powerMonitor.emit('resume'));
   await page.waitForFunction(async()=>!(await window.copilot.getRuntime()).blocked);
   await new Promise(resolve=>setTimeout(resolve,250));assert.equal(responseClosed,true);assert.equal(requestCount,count);holdResponse=false;
  });
  await check('cleared context is absent from primary and recovery snapshots',async()=>{
   await page.evaluate(async()=>{await window.copilot.saveWorkspace({context:{resume:'SYNTHETIC PRIVATE MARKER'},sessions:[{id:'s',context:{resume:'SYNTHETIC PRIVATE MARKER'},transcript:[],exchanges:[]}]});await window.copilot.saveWorkspace({context:{resume:''},sessions:[{id:'s',context:{resume:''},transcript:[],exchanges:[]}]});});
   for(const name of ['workspace.json','workspace.json.bak'])assert.ok(!(await fs.readFile(path.join(profile,name),'utf8')).includes('SYNTHETIC PRIVATE MARKER'));
  });
  await check('101st session rejects without modifying 100 saved sessions',async()=>{
   const result=await page.evaluate(async()=>{const sessions=Array.from({length:100},(_,i)=>({id:String(i),transcript:[],exchanges:[]}));await window.copilot.saveWorkspace({sessions});let rejected=false;try{await window.copilot.saveWorkspace({sessions:[...sessions,{id:'101'}]});}catch{rejected=true;}return{rejected,saved:(await window.copilot.loadWorkspace()).sessions.length};});assert.deepEqual(result,{rejected:true,saved:100});
  });
  await check('unknown policy blocks before any network request',async()=>{
   const count=requestCount;const error=await page.evaluate(async()=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,dataPolicy:'unknown'});try{await window.copilot.generate({requestId:'unknown-policy',question:'test'});}catch(error){return String(error);}});assert.match(error,/Choose a data-use policy/);assert.equal(requestCount,count);
  });
  await check('practice preview excludes context, prior answers and transcript; PDF is blocked',async()=>{
   const result=await page.evaluate(async()=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,dataPolicy:'unpaid'});const preview=await window.copilot.previewRequest({question:'Explain arrays',context:{resume:'PRIVATE_MARKER'},transcript:'PRIVATE_MARKER',previousAnswers:[{answer:'PRIVATE_MARKER'}]});let blocked=false;try{await window.copilot.importDocument({mode:'ai'});}catch{blocked=true;}return{preview:JSON.stringify(preview),blocked};});assert.ok(!result.preview.includes('PRIVATE_MARKER'));assert.equal(result.blocked,true);
  });
  await check('JSON truncation fails visibly and retains emitted partial text',async()=>{
   await page.evaluate(async baseUrl=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,baseUrl,apiKey:'synthetic-key-A',dataPolicy:'local'});},baseUrl);
   const result=await page.evaluate(async()=>{let partial='';const cleanup=window.copilot.onAnswer(e=>partial+=e.delta);try{await window.copilot.generate({requestId:'json-truncation',question:'synthetic'});}catch(error){return{partial,error:String(error)};}finally{cleanup();}});assert.equal(result.partial,'SYNTHETIC PARTIAL');assert.match(result.error,/output limit/);
  });
  await check('duplicate process exits without a second workspace writer',async()=>{
   await app.evaluate(()=>{globalThis.secondInstanceCount=0;});await app.evaluate(({app})=>app.on('second-instance',()=>globalThis.secondInstanceCount++));
   const child=spawn(executable,packaged?[]:[root],{env:{...process.env,PARAKEET_USER_DATA:profile},windowsHide:true,stdio:'ignore'});
   const code=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(new Error('Duplicate launch did not exit.'));},10000);child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('exit',code=>{clearTimeout(timer);resolve(code);});});assert.equal(code,0);assert.equal(await app.evaluate(()=>globalThis.secondInstanceCount),1);
  });
  report.passed=true;
 }finally{
  if(page&&!page.isClosed())await page.evaluate(async()=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,apiKey:''});}).catch(()=>{});
  await app?.close();server.close();report.completedAt=new Date().toISOString();await fs.writeFile(path.join(output,packaged?'hardening-packaged.json':'hardening-source.json'),JSON.stringify(report,null,2));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
