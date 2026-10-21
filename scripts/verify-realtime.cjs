// Synthetic-only desktop regression. Isolated profile, fake microphone, loopback provider.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {_electron}=require('playwright');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const root=path.resolve(__dirname,'..'),output=path.join(root,'test-results','realtime-'+Date.now());
 await fs.mkdir(output,{recursive:true});let app,server;const sockets=new Set(),requests=[],errors=[];
 const report={version:require('../package.json').version,syntheticOnly:true,cloudRequests:0,realMicrophoneUsed:false,realScreenCaptured:false,checks:[]};
 try{
  const {encodeWav}=await import(require('node:url').pathToFileURL(path.join(root,'renderer/audio.js')).href);
  const audio=path.join(output,'silent-fixture.wav');await fs.writeFile(audio,Buffer.from(encodeWav([new Float32Array(48000*10)],48000)));
  server=http.createServer(async(req,res)=>{
   let body='';for await(const chunk of req)body+=chunk;
   if(!req.url.includes('streamGenerateContent')){res.writeHead(404);res.end();return;}
   requests.push(JSON.parse(body));res.writeHead(200,{'Content-Type':'text/event-stream'});
   const event=text=>'data: '+JSON.stringify({candidates:[{content:{parts:[{text}]}}]})+'\n\n';
   res.write(event('Use a bounded cache and retain the required constraints. '));
   const timer=setTimeout(()=>res.end('data: '+JSON.stringify({candidates:[{content:{parts:[{text:'Verify empty inputs and eviction behavior.'}]},finishReason:'STOP'}]})+'\n\n'),requests.length===1?8000:100);
   res.on('close',()=>clearTimeout(timer));
  });
  server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  app=await _electron.launch({executablePath:process.argv.includes('--packaged')?path.join(root,'dist/win-unpacked/Parakeet Studio.exe'):require('electron'),args:[...(process.argv.includes('--packaged')?[]:[root]),'--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-audio-capture='+audio],env:{...process.env,PARAKEET_USER_DATA:path.join(output,'profile')}});
  const page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));
  await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent!=='Checking connection');
  await page.evaluate(async baseUrl=>{const settings=await window.copilot.getSettings();await window.copilot.saveSettings({...settings,provider:'gemini',baseUrl,model:'gemini-3.5-flash-lite',transcriptionModel:'gemini-3.5-transcribe-live',apiKey:'synthetic-only',dataPolicy:'local',answerMode:'balanced',historyMode:'persist'});},'http://127.0.0.1:'+server.address().port+'/v1beta');
  await app.evaluate(({ipcMain})=>{
   for(const name of ['live:start','live:audio','live:end-audio','live:stop']){ipcMain.removeHandler(name);ipcMain.handle(name,async()=>({ok:true}));}
  });
  await page.reload();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent==='AI provider configured');
  await page.check('#auto-answer');await page.selectOption('#audio-source','microphone');
  await page.click('#capture-button');await page.waitForFunction(()=>document.querySelector('#capture-label').textContent==='Stop listening');
  const emit=async text=>app.evaluate(({BrowserWindow},text)=>BrowserWindow.getAllWindows().find(w=>!w.isDestroyed()&&w.webContents.getURL().includes('index.html')).webContents.send('live:transcript',{text,source:'microphone'}),text);
  await emit('Implement a cache with at most 50 entries.');
  await page.locator('#pending-question').waitFor({state:'visible'});await page.click('#pending-question-hold');await delay(2600);
  assert.equal(requests.length,0,'Hold must prevent auto drafting');
  assert.equal(await page.textContent('#pending-question-hold'),'Resume auto draft');
  await page.click('#pending-question-hold');
  await page.waitForFunction(()=>document.querySelector('#answer-text')?.textContent.includes('bounded cache'),null,{timeout:8000});
  assert.equal(requests.length,1);
  await emit('Actually use at most 15 entries, not 50.');
  await page.waitForFunction(()=>document.querySelector('#pending-question-status')?.textContent.includes('Question corrected'));
  await page.waitForFunction(()=>!document.querySelector('#generate-button').hidden);
  await delay(2500);assert.equal(requests.length,1,'Correction must not silently request a replacement');
  assert.match(await page.textContent('#pending-question-text'),/Implement a cache/);
  assert.match(await page.textContent('#pending-question-text'),/15 entries, not 50/);
  const overlay=await page.evaluate(()=>window.copilot.getOverlay());assert.match(overlay.pendingQuestion,/15 entries/);
  await page.click('#pending-question-send');
  await page.waitForFunction(()=>!document.querySelector('#generate-button').hidden);
  assert.equal(requests.length,2);assert.match(JSON.stringify(requests[1]),/Implement a cache/);assert.match(JSON.stringify(requests[1]),/15 entries, not 50/);
  report.checks.push('hold/resume','late correction retains context','obsolete generation cancelled','no automatic replacement','explicit revised answer');
  await page.click('#capture-button');await page.waitForFunction(()=>document.querySelector('#capture-label').textContent==='Start listening');
  await app.evaluate(({desktopCapturer,dialog},output)=>{
   dialog.showSaveDialog=async()=>({canceled:false,filePath:output+'/diagnostics.json'});
   desktopCapturer.getSources=async()=>{await new Promise(resolve=>setTimeout(resolve,180));throw new Error('Synthetic display unavailable');};
  },output);
  await page.click('#screenshot-answer');
  await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Screenshot failed'));
  await page.evaluate(()=>window.copilot.exportDiagnostics());
  let diagnostics=JSON.parse(await fs.readFile(path.join(output,'diagnostics.json'),'utf8'));
  let row=diagnostics.rows.at(-1);assert.equal(row.kind,'screen');assert.equal(row.failureCategory,'capture');assert.equal(row.completedMs,null);assert.ok(row.attemptEndMs>=150);assert.equal(row.save,'not-applicable');
  report.checks.push('failed capture counted without invented completion');
  await app.evaluate(({desktopCapturer,nativeImage,screen})=>{
   desktopCapturer.getSources=async()=>{await new Promise(resolve=>setTimeout(resolve,180));return [{display_id:String(screen.getPrimaryDisplay().id),name:'Synthetic display',thumbnail:nativeImage.createFromBitmap(Buffer.from([255,255,255,255]),{width:1,height:1})}];};
  });
  await page.fill('#question-input','Explain the synthetic screen.');
  await page.click('#screenshot-answer');await page.waitForFunction(()=>document.querySelector('#screenshot-answer').textContent==='Answer screenshot'&&!document.querySelector('#generate-button').hidden);
  await page.evaluate(()=>window.copilot.exportDiagnostics());diagnostics=JSON.parse(await fs.readFile(path.join(output,'diagnostics.json'),'utf8'));
  row=diagnostics.rows.at(-1);assert.equal(row.kind,'screen');assert.equal(row.outcome,'success');assert.ok(row.captureEndMs>=150);assert.ok(row.requestMs>=row.captureEndMs);assert.ok(row.firstRenderedMs>=row.firstTextMs);assert.ok(row.savedMs>=row.completedMs);
  assert.equal(diagnostics.attempts,4);assert.equal(diagnostics.rows[0].outcome,'cancelled');assert.equal(diagnostics.rows[0].completedMs,null);
  report.checks.push('successful capture included in end-to-end timing','first rendered text measured','cancelled answer not counted complete');
  assert.deepEqual(errors,[]);report.passed=true;report.syntheticProviderRequests=requests.length;
  console.log('PASS '+report.checks.length+' synthetic desktop correction/capture/timing checks.');
 }catch(error){report.passed=false;report.failure=error.stack;process.exitCode=1;console.error(error.stack);}
 finally{await app?.close();for(const socket of sockets)socket.destroy();if(server)await new Promise(resolve=>server.close(resolve));report.completedAt=new Date().toISOString();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(output);}
})();
