const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { _electron } = require('playwright');
const root = path.resolve(__dirname,'..');
const output = path.join(root,'test-results');
const model = process.argv.find(value=>value.startsWith('--model='))?.slice(8) || 'gemini-3.5-flash-lite';
if(!['gemini-3.8-flash','gemini-3.5-flash-lite'].includes(model))throw new Error('This bounded test permits only the documented free-tier Gemini models.');
const pdfOnly = process.argv.includes('--pdf-only');
const readSecret = () => new Promise((resolve,reject)=>{
  let text=''; const input=process.stdin; const raw=Boolean(input.isTTY);
  if(raw)input.setRawMode(true);input.resume();
  process.stdout.write('Gemini API key (masked input; never logged):\n');
  const onData=bytes=>{
    for(const char of bytes.toString()){
      if(char==='\u0003'){cleanup();reject(new Error('Cancelled'));return;}
      if(char==='\n'||char==='\r'){cleanup();resolve(text.trim());return;}
      if(char==='\u007f'||char==='\b')text=text.slice(0,-1);else text+=char;
    }
  };
  const cleanup=()=>{input.removeListener('data',onData);if(raw)input.setRawMode(false);input.pause();};
  input.on('data',onData);
});
(async()=>{
  const key=await readSecret();if(!key)throw new Error('A key is required.');
  const redact=value=>String(value).split(key).join('[redacted]');
  await fs.mkdir(output,{recursive:true});
  const report={startedAt:new Date().toISOString(),model,provider:'Google Gemini, user-authorized bounded live tests',syntheticMediaOnly:true,stages:[]};
  const stage=async(name,task)=>{if(pdfOnly&&!name.startsWith('scanned'))return;const started=Date.now();try{const detail=await task();report.stages.push({name,passed:true,milliseconds:Date.now()-started,...detail});console.log(`PASS ${name}`);}catch(error){report.stages.push({name,passed:false,milliseconds:Date.now()-started,error:redact(error.message)});console.log(`FAIL ${name}: ${redact(error.message)}`);}};
  const wav=path.join(output,'live-synthetic-speech.wav');
  const quote=value=>`'${value.replaceAll("'","''")}'`;
  execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $f = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono); $s.SetOutputToWaveFile(${quote(wav)}, $f); $s.Speak('A cache stores recently used data. The time to live is sixty seconds.'); $s.Dispose()`],{windowsHide:true,stdio:'pipe'});
  let app,page;
  try{
    app=await _electron.launch({executablePath:require('electron'),args:[root,'--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-audio-capture=${wav}`],env:{...process.env,PARAKEET_USER_DATA:path.join(output,`live-private-${Date.now()}`)},timeout:45000});
    page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent!=='Checking connection');
    await page.evaluate(async({apiKey,model})=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,apiKey,provider:'gemini',baseUrl:'https://generativelanguage.googleapis.com/v1beta',model,transcriptionModel:'gemini-3.5-transcribe-live',answerMode:'balanced',networkMode:'standard',dataPolicy:'unpaid'});},{apiKey:key,model});
    await page.reload();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent==='AI provider configured');
    await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});
    await page.uncheck('#auto-answer');await page.selectOption('#audio-source','microphone');
    await stage('synthetic speech through AudioWorklet and Gemini Live',async()=>{
      await page.click('#capture-button');
      await page.waitForFunction(()=>document.querySelector('#capture-label')?.textContent==='Stop listening'||(document.querySelector('#toast')?.classList.contains('error')&&!document.querySelector('#toast').hidden),null,{timeout:30000});
      if(await page.locator('#capture-label').textContent()!=='Stop listening')throw new Error(await page.locator('#toast').textContent());
      await page.waitForFunction(()=>{const text=[...document.querySelectorAll('.transcript-segment p')].map(p=>p.textContent).join(' ');return /cache/i.test(text)&&/sixty|60/i.test(text);},null,{timeout:30000});
      await page.click('#capture-button');await page.waitForFunction(()=>document.querySelector('#capture-label')?.textContent==='Start listening');
      const text=await page.locator('#transcript-content').textContent();
      if(!/cache/i.test(text)||!/sixty|60/i.test(text))throw new Error('Expected cache and sixty/60 in the recognized synthetic speech.');
      return{recognizedExpectedTerms:true};
    });
    if(await page.locator('#capture-label').textContent()==='Stop listening'){await page.click('#capture-button');await page.waitForFunction(()=>document.querySelector('#capture-label')?.textContent==='Start listening');}
    const answer=async(expected)=>{if(expected)await page.waitForFunction(expected=>document.querySelector('.answer-question')?.textContent===expected,expected);await page.waitForFunction(()=>!document.querySelector('#generate-button').hidden,null,{timeout:155000});const error=await page.locator('#answer-error').textContent();if(error)throw new Error(error);return page.locator('#answer-text').textContent();};
    await stage('coding question to actual streamed Gemini answer',async()=>{
      await page.click('[data-style="coding"]');await page.fill('#question-input','Write a Python function two_sum(nums, target) that returns two distinct indices whose values sum to target, or [] if none. Handle duplicates. Use no imports and no type annotations. Explain time and space complexity briefly.');
      await page.click('#generate-button');const text=await answer();
      if(!/def\s+two_sum\s*\(/.test(text)||!await page.locator('#answer-text pre code').count())throw new Error('Expected a fenced Python two_sum implementation.');
      return{answer:redact(text),codeDisplayed:true};
    });
    await stage('screen preview and screenshot sent to actual Gemini vision',async()=>{
      await app.evaluate(async({BrowserWindow,desktopCapturer,screen})=>{
        const fixture=new BrowserWindow({width:1000,height:600,show:false,webPreferences:{offscreen:true,sandbox:true,contextIsolation:true,nodeIntegration:false}});
        await fixture.loadURL('data:text/html,'+encodeURIComponent('<html><body style="background:white;color:black;font:48px Arial;padding:60px"><h1>SCREEN TEST</h1><p>What is 17 + 28?</p><p>Reply with the number only.</p></body></html>'));
        const thumbnail=await fixture.webContents.capturePage();fixture.destroy();desktopCapturer.getSources=async()=>[{id:'screen:synthetic:0',display_id:String(screen.getPrimaryDisplay().id),name:'Synthetic screen test',thumbnail}];
      });
      await page.click('[data-style="concise"]');await page.fill('#question-input','Read the arithmetic problem in the screenshot. Reply with the number only.');await page.click('#screenshot-answer');
      await page.locator('#screen-analysis-dialog').waitFor({state:'visible'});await page.selectOption('#screen-quality','fast');await page.click('#screen-send');const text=await answer('Read the arithmetic problem in the screenshot. Reply with the number only.');
      if(!/\b45\b/.test(text))throw new Error(`Vision response did not contain the expected result: ${text.slice(0,300)}`);
      return{readSyntheticImageCorrectly:true,answer:redact(text)};
    });
    await stage('scanned synthetic resume PDF through native import and actual Gemini',async()=>{
      const pdfPath=path.join(output,'live-synthetic-scanned-resume.pdf');
      const pdfData=await app.evaluate(async({BrowserWindow})=>{
        const fixture=new BrowserWindow({width:900,height:700,show:false,webPreferences:{offscreen:true,sandbox:true,contextIsolation:true,nodeIntegration:false}});
        await fixture.loadURL('data:text/html,'+encodeURIComponent('<html><body style="background:white;color:black;font:28px Arial;padding:45px"><h1>Synthetic Candidate</h1><h2>EXPERIENCE</h2><p>Orion Systems, Engineer, 2022-2025.</p><p>Migrated PostgreSQL workloads to Kubernetes.</p><p>Reduced latency by 37%.</p><h2>SKILLS</h2><p>Python, SQL, Kubernetes.</p></body></html>'));
        const image=(await fixture.webContents.capturePage()).toDataURL();
        await fixture.loadURL('data:text/html,'+encodeURIComponent(`<html><body style="margin:0"><img style="width:100%" src="${image}"></body></html>`));
        await fixture.webContents.executeJavaScript('Promise.all([...document.images].map(image=>image.decode()))');
        const bytes=await fixture.webContents.printToPDF({printBackground:true});
        fixture.destroy();return bytes.toString('base64');
      });
      await fs.writeFile(pdfPath,Buffer.from(pdfData,'base64'));
      await app.evaluate(({dialog},filePath)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[filePath]});dialog.showMessageBox=async()=>({response:1});},pdfPath);
      // This fixture is entirely synthetic/non-personal. This selection does not assert a billing tier.
      await page.evaluate(async()=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,dataPolicy:'reviewed'});});
      const result=await page.evaluate(()=>window.copilot.importDocument({mode:'ai'}));
      if(!/Orion/i.test(result.text)||!/37%/.test(result.text)||!/PostgreSQL/i.test(result.text))throw new Error('Scanned PDF extraction missed required resume facts.');
      return{preservedEmployerAndMetric:true,pages:result.pages};
    });
  } finally{
    if(page&&!page.isClosed()){
      await page.evaluate(async()=>{await window.copilot.stopLive();const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,apiKey:''});await window.copilot.saveSettings({...s,apiKey:''});}).catch(()=>{});
    }
    await app?.close();
    report.completedAt=new Date().toISOString();report.passed=report.stages.length===(pdfOnly?1:4)&&report.stages.every(item=>item.passed);
    await fs.writeFile(path.join(output,'live-verification.json'),JSON.stringify(report,null,2));
    await fs.writeFile(path.join(output,`live-verification-${model}${pdfOnly?'-pdf':''}.json`),JSON.stringify(report,null,2));
    console.log(`Live verification: ${report.passed?'PASS':'INCOMPLETE/FAILED'}; redacted receipt in test-results/live-verification.json.`);
    if(!report.passed)process.exitCode=1;
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
