const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {_electron}=require('playwright');
const root=path.resolve(__dirname,'..'),packaged=process.argv.includes('--packaged');
const output=path.join(root,'test-results','production-'+Date.now()),profile=path.join(output,'profile');
const executablePath=packaged?path.join(root,'dist/win-unpacked/Parakeet Studio.exe'):require('electron');
(async()=>{
 await fs.mkdir(profile,{recursive:true});let app,page;let providerRequests=0,errorEnvelope='';const report={version:require('../package.json').version,packaged,syntheticOnly:true,cloudRequests:0,checks:[]};
 const server=http.createServer(async(req,res)=>{providerRequests++;for await(const _ of req){}if(req.url.endsWith('/models')){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({data:[{id:'local-answer'},{id:'local-speech'}]}));return;}if(errorEnvelope){const payload={error:{message:'Synthetic rejection '+req.headers['x-goog-api-key']}};res.writeHead(200,{'Content-Type':errorEnvelope==='json'?'application/json':'text/event-stream'});res.end(errorEnvelope==='json'?JSON.stringify(payload):'data: '+JSON.stringify(payload)+'\n\n');return;}res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Synthetic production answer.'}]},finishReason:'STOP'}]})+'\n\n');});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const baseUrl='http://127.0.0.1:'+server.address().port+'/v1beta';
 const launch=async()=>{app=await _electron.launch({executablePath,args:packaged?[]:[root],env:{...process.env,PARAKEET_USER_DATA:profile},timeout:45000});page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent!=='Checking connection');};
 const restart=async()=>{await page.reload();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent!=='Checking connection');await app.close();await launch();};
 const check=async(name,task)=>{await task();report.checks.push(name);console.log('PASS '+name);};
 const settings=change=>page.evaluate(async change=>{const old=await window.copilot.getSettings();return window.copilot.saveSettings({...old,...change});},change);
 const disk=async()=>Promise.all(['workspace.json','workspace.json.bak'].map(name=>fs.readFile(path.join(profile,name),'utf8')));
 const seed={context:{resume:'SYNTHETIC_PRIVATE_RESUME'},sessions:[{id:'one',createdAt:new Date().toISOString(),transcript:[{text:'SYNTHETIC_PRIVATE_TRANSCRIPT'}],exchanges:[]}]};
 try{
  await launch();await settings({baseUrl,apiKey:'synthetic-test-only',dataPolicy:'local'});await page.evaluate(value=>window.copilot.saveWorkspace(value),seed);
  await check('answer slots reserve before credential lookup; duplicate and excess requests never upload',async()=>{
   const before=providerRequests;
   await app.evaluate(({safeStorage})=>{globalThis.originalDecrypt=safeStorage.decryptStringAsync;globalThis.keyWaiters=[];globalThis.decryptCalls=0;safeStorage.decryptStringAsync=async function(...args){globalThis.decryptCalls++;await new Promise(resolve=>globalThis.keyWaiters.push(resolve));return globalThis.originalDecrypt.apply(safeStorage,args);};});
   try{
    await page.evaluate(()=>{const invoke=id=>window.copilot.generate({requestId:id,question:'Synthetic slot check'}).then(()=>({ok:true}),error=>({error:String(error)}));globalThis.slotCalls=[invoke('slot-a'),invoke('slot-a'),invoke('slot-b'),invoke('slot-c')];});
    for(let i=0;i<100;i++){if(await app.evaluate(()=>globalThis.decryptCalls)>=2)break;await new Promise(r=>setTimeout(r,10));}await new Promise(r=>setTimeout(r,50));assert.equal(await app.evaluate(()=>globalThis.decryptCalls),2);
    await page.evaluate(()=>window.copilot.cancel({requestId:'slot-a'}));await app.evaluate(()=>{for(const resume of globalThis.keyWaiters)resume();});
    const results=await page.evaluate(()=>Promise.all(globalThis.slotCalls));assert.match(results[1].error,/already running/);assert.match(results[3].error,/already running/);assert.ok(results[0].error);assert.equal(results[2].ok,true);assert.equal(providerRequests-before,1);
   }finally{await app.evaluate(({safeStorage})=>{for(const resume of globalThis.keyWaiters)resume();safeStorage.decryptStringAsync=globalThis.originalDecrypt;});await page.evaluate(()=>Promise.all(globalThis.slotCalls||[]));}
  });
  await check('JSON and streamed provider errors cannot expose a saved credential',async()=>{
   try{for(const mode of ['json','sse']){errorEnvelope=mode;const error=await page.evaluate(async mode=>{try{await window.copilot.generate({requestId:'secret-error-'+mode,question:'Synthetic credential test'});}catch(error){return String(error);}},mode);assert.ok(error.includes('[redacted]'));assert.ok(!error.includes('synthetic-test-only'));}}finally{errorEnvelope='';}
  });
  await check('Windows encryption rewrites both plaintext workspace copies and survives restart',async()=>{
   await settings({encryptWorkspace:true});for(const text of await disk()){assert.ok(text.includes('parakeet-workspace-dpapi-v1'));assert.ok(!text.includes('SYNTHETIC_PRIVATE'));}
   await restart();assert.equal((await page.evaluate(()=>window.copilot.loadWorkspace())).context.resume,seed.context.resume);
  });
  await check('retention removes expired saved sessions from primary and recovery snapshots',async()=>{
   await page.evaluate(async()=>{await window.copilot.saveWorkspace({sessions:[{id:'expired',createdAt:'2000-01-01'},{id:'recent',createdAt:new Date().toISOString()}]});});
   await settings({retentionDays:7});await restart();assert.deepEqual((await page.evaluate(()=>window.copilot.loadWorkspace())).sessions.map(s=>s.id),['recent']);
  });
  await check('failed privacy settings write restores the prior protected workspace',async()=>{
   await page.evaluate(value=>window.copilot.saveWorkspace(value),seed);
   await app.evaluate(async()=>{const fs=process.getBuiltinModule('node:fs/promises');globalThis.originalRename=fs.rename;fs.rename=async(...args)=>{if(String(args[1]).endsWith('settings.json')){const error=new Error('Synthetic low disk');error.code='ENOSPC';throw error;}return globalThis.originalRename(...args);};});
   try{await assert.rejects(()=>settings({historyMode:'ephemeral'}),/Synthetic low disk/);}finally{await app.evaluate(async()=>{process.getBuiltinModule('node:fs/promises').rename=globalThis.originalRename;delete globalThis.originalRename;});}
   assert.equal((await page.evaluate(()=>window.copilot.getSettings())).historyMode,'persist');for(const text of await disk()){assert.ok(text.includes('parakeet-workspace-dpapi-v1'));assert.ok(!text.includes('SYNTHETIC_PRIVATE'));}
   await restart();assert.equal((await page.evaluate(()=>window.copilot.loadWorkspace())).context.resume,seed.context.resume);
  });
  await check('forced app termination retains the last durably encrypted snapshot',async()=>{
   await page.evaluate(value=>window.copilot.saveWorkspace(value),seed);const exited=app.waitForEvent('close');await app.evaluate(()=>process.exit(77)).catch(()=>{});await exited;await launch();assert.equal((await page.evaluate(()=>window.copilot.loadWorkspace())).context.resume,seed.context.resume);
  });
  await check('memory-only clears primary and recovery copies, keeps current memory and restores empty',async()=>{
   await page.evaluate(value=>window.copilot.saveWorkspace(value),seed);await settings({historyMode:'ephemeral'});assert.equal((await page.evaluate(()=>window.copilot.loadWorkspace())).context.resume,seed.context.resume);
   for(const text of await disk())assert.deepEqual(JSON.parse(text),{context:{},sessions:[]});
   await page.evaluate(value=>window.copilot.saveWorkspace(value),seed);for(const text of await disk())assert.ok(!text.includes('SYNTHETIC_PRIVATE'));await restart();assert.equal((await page.evaluate(()=>window.copilot.loadWorkspace())).sessions.length,0);
  });
  await check('UI answer records content-free stage timings and marks memory-only saves',async()=>{
   await page.fill('#question-input','Explain a synthetic test');await page.click('#generate-button');await page.waitForFunction(()=>document.querySelector('#answer-text')?.textContent.includes('Synthetic production answer.'));
   const target=path.join(output,'diagnostics.json');await app.evaluate(({dialog},target)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:target});},target);
   for(let i=0;i<100;i++){await page.evaluate(()=>window.copilot.exportDiagnostics());const data=JSON.parse(await fs.readFile(target));if(data.attempts){assert.equal(data.rows[0].outcome,'success');assert.equal(data.rows[0].save,'memory-only');assert.equal(data.rows[0].savedMs,null);assert.ok(data.rows[0].firstTextMs>=0);assert.ok(!JSON.stringify(data).includes('synthetic test'));break;}if(i===99)assert.fail('No timing attempt recorded');await new Promise(r=>setTimeout(r,20));}
   await page.evaluate(()=>window.copilot.clearDiagnostics());await page.evaluate(()=>window.copilot.exportDiagnostics());assert.equal(JSON.parse(await fs.readFile(target)).attempts,0);
  });
  await check('local-server readiness is explicit and does not send conversation content',async()=>{
   const original=await page.evaluate(()=>window.copilot.getSettings());await settings({provider:'openai',model:'local-answer',transcriptionModel:'local-speech',dataPolicy:'local',apiKey:'local-placeholder'});
   try{await page.click('[data-view="settings"]');await page.click('#check-local-provider');await page.waitForFunction(()=>document.querySelector('#local-provider-status').textContent.startsWith('Server reached.'));assert.match(await page.locator('#local-provider-status').textContent(),/Answer model listed: yes/);}finally{await settings({...original,apiKey:'synthetic-test-only'});await page.click('[data-view="workspace"]');}
  });
  await check('keyboard-only screen crop moves, resizes and clears selection',async()=>{
   await app.evaluate(({desktopCapturer,nativeImage,screen})=>{const image=nativeImage.createFromBitmap(Buffer.alloc(800*600*4,255),{width:800,height:600});desktopCapturer.getSources=async()=>[{display_id:String(screen.getPrimaryDisplay().id),thumbnail:image}];});
   await page.click('#screenshot-answer');await page.locator('#screen-analysis-dialog').waitFor({state:'visible'});await page.locator('#screen-preview-surface').focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowDown');assert.ok(await page.locator('#screen-crop-selection').isVisible());assert.match(await page.locator('#screen-crop-status').textContent(),/50% wide by 55% high/);await page.keyboard.press('Escape');assert.equal(await page.locator('#screen-crop-selection').isVisible(),false);await page.locator('#screen-analysis-dialog button[value="cancel"]').click();
  });
  report.passed=true;
 }catch(error){report.passed=false;report.failure=error.stack;throw error;}finally{await app?.close();await new Promise(r=>server.close(r));report.completedAt=new Date().toISOString();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
