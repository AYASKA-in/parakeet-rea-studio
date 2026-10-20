const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process'),{_electron}=require('playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'test-results','benchmark-desktop-'+Date.now()),pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await fs.mkdir(output,{recursive:true});const profile=path.join(output,'profile'),report={syntheticOnly:true,personalProfileRead:false,maximumCalls:12,stages:[]};let app,page;
 const save=()=>fs.writeFile(path.join(output,'progress.json'),JSON.stringify(report,null,2));
 try{
  app=await _electron.launch({executablePath:require('electron'),args:[root],env:{...process.env,PARAKEET_USER_DATA:profile},timeout:45000});page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent!=='Checking connection');
  await page.evaluate(async()=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,dataPolicy:'unpaid',historyMode:'ephemeral'});});await page.reload();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent==='Connect your AI provider');await page.click('[data-view="settings"]');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setTitle('Parakeet Studio — Synthetic benchmark setup'));
  await page.locator('#settings-save-status').evaluate(el=>el.textContent='Synthetic benchmark setup: enter your own free-tier key and save. Up to 12 synthetic requests; no private resume/audio/screens. Close this window to cancel.');
  report.phase='awaiting-key';report.output=output;await save();console.log('Benchmark setup window ready. Enter key directly in its Settings and save; do not paste in chat.');
  if(process.env.PARAKEET_EVAL_API_KEY){await page.fill('#provider-key',process.env.PARAKEET_EVAL_API_KEY);await page.click('#save-settings');}
  const deadline=Date.now()+15*60000;let settings;
  while(Date.now()<deadline){settings=await page.evaluate(()=>window.copilot.getSettings());if(settings.hasApiKey)break;await pause(1000);}if(!settings?.hasApiKey)throw new Error('No test key configured before timeout.');
  if(settings.provider!=='gemini'||settings.baseUrl!=='https://generativelanguage.googleapis.com/v1beta'||settings.model!=='gemini-3.5-flash-lite'||settings.transcriptionModel!=='gemini-3.5-transcribe-live')throw new Error('This bounded benchmark permits only the documented Gemini free-tier model configuration.');
  const key=await app.evaluate(async({app,safeStorage})=>{const settings=JSON.parse(await process.getBuiltinModule('node:fs/promises').readFile(process.getBuiltinModule('node:path').join(app.getPath('userData'),'settings.json'),'utf8'));return(await safeStorage.decryptStringAsync(Buffer.from(settings.encryptedKey,'base64'))).result;});
  report.phase='running';await save();
  for(const kind of ['coding','screens','resumes','asr']){
   const child=spawn(process.execPath,[path.join(root,'scripts/evaluate.cjs'),'--live','--kind='+kind,'--provider=gemini','--model='+(kind==='asr'?settings.transcriptionModel:settings.model),'--max-calls=3'],{env:{...process.env,PARAKEET_EVAL_API_KEY:key},windowsHide:true,stdio:['ignore','pipe','pipe']});
   let log='';child.stdout.on('data',data=>{const text=data.toString().split(key).join('[redacted]');log+=text;process.stdout.write(text);});child.stderr.on('data',()=>{});const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve(code??1));});report.stages.push({kind,exitCode:code});await save();if(code!==0){report.phase='stopped-on-failed-stage';process.exitCode=1;break;}
  }
  if(report.phase==='running')report.phase='complete';
 }catch(error){report.phase='unavailable';report.error='Validation could not complete. Check the private test window and stage reports; no credential was printed.';process.exitCode=1;}
 finally{if(page&&!page.isClosed())await page.evaluate(async()=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,apiKey:''});}).catch(()=>{});await app?.close();report.completedAt=new Date().toISOString();await save();}
})().catch(()=>{console.error('Benchmark setup failed.');process.exitCode=1;});
