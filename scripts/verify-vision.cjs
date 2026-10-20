const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {_electron}=require('playwright');
const root=path.resolve(__dirname,'..'), output=path.join(root,'test-results/vision-glass');
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

const scenes=[
 {name:'screen-text',quality:'fast',html:'<h1>Deployment notes</h1><p>Release token: ORBIT-742</p><p>Retry limit: 7</p><p>Do not retry HTTP 401.</p><p style="font-size:14px">Small text: PostgreSQL pool_size=24; timeout_ms=1750.</p>',question:'Read the release token, retry limit, HTTP status that must not be retried, and the two small-text configuration values. Return the exact values.',check:t=>['ORBIT-742','401','24','1750'].every(x=>t.includes(x))&&/\b7\b/.test(t)},
 {name:'screen-code',quality:'balanced',html:'<h1>Debug this Python function</h1><p>Sorted ascending input. Return any matching index, otherwise -1.</p><pre style="font:22px/1.55 Consolas">def binary_search(nums, target):\n    lo, hi = 0, len(nums) - 1\n    while lo &lt; hi:\n        mid = (lo + hi) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[mid] &lt; target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1</pre>',question:'Read the code in the screenshot. Explain the bug and give the corrected Python function in a fenced block. Preserve the function name and arguments. Briefly cover empty and one-element inputs.',check:t=>/def\s+binary_search\s*\(nums,\s*target\)/.test(t)&&/while\s+lo\s*<=\s*hi/.test(t)&&/empty|one.element|single/i.test(t)},
 {name:'screen-diagram',quality:'balanced',html:'<h1>Checkout architecture</h1><svg width="1150" height="250" viewBox="0 0 1150 250"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#111"/></marker></defs><g fill="#dff3ff" stroke="#111" stroke-width="3"><rect x="20" y="50" width="240" height="100"/><rect x="390" y="50" width="290" height="100"/><rect x="820" y="50" width="290" height="100"/></g><g font-size="27" fill="#111" text-anchor="middle"><text x="140" y="110">Browser</text><text x="535" y="110">API gateway</text><text x="965" y="110">Orders database</text><text x="320" y="60">HTTPS</text><text x="750" y="60">SQL</text></g><g stroke="#111" stroke-width="4" marker-end="url(#arrow)"><path d="M260,100 L385,100"/><path d="M680,100 L815,100"/></g></svg>',question:'Read the architecture diagram. List the three components in arrow order, and the label on each connection. Do not add components that are not shown.',check:t=>/Browser/i.test(t)&&/API gateway/i.test(t)&&/Orders database/i.test(t)&&/HTTPS/.test(t)&&/SQL/.test(t)&&t.toLowerCase().indexOf('browser')<t.toLowerCase().indexOf('api gateway')},
 {name:'screen-image',quality:'fast',html:'<h1>Image recognition test</h1><canvas id="shapes" width="1100" height="330"></canvas><script>const c=document.querySelector("canvas").getContext("2d");c.fillStyle="white";c.fillRect(0,0,1100,330);c.fillStyle="#e21b23";for(const x of [110,300,490]){c.beginPath();c.arc(x,95,55,0,Math.PI*2);c.fill();}c.fillStyle="#1260d8";c.fillRect(670,40,110,110);c.fillRect(880,40,110,110);c.fillStyle="#168342";c.beginPath();c.moveTo(500,190);c.lineTo(420,310);c.lineTo(580,310);c.closePath();c.fill();const image=new Image();image.src=document.querySelector("canvas").toDataURL();image.alt="Unlabeled geometric picture";document.querySelector("canvas").replaceWith(image);</script>',question:'Look at the picture. Count the red circles, blue squares and green triangles. State each count and the total number of shapes.',check:t=>(/3|three/i.test(t))&&(/2|two/i.test(t))&&(/1|one/i.test(t))&&(/6|six/i.test(t))}
];
(async()=>{
 const key=await readSecret();if(!key)throw Error('Key required.');await fs.mkdir(output,{recursive:true});
 const redact=t=>String(t).split(key).join('[redacted]');
 const report={startedAt:new Date().toISOString(),packaged:true,actualWindowsDesktopCapture:true,syntheticFullScreenOnly:true,model:'gemini-3.5-flash-lite',scenes:[],glass:[]};
 let app,page,floating;
 try{
  app=await _electron.launch({executablePath:path.join(root,'dist/win-unpacked/Parakeet Studio.exe'),args:[],env:{...process.env,PARAKEET_USER_DATA:path.join(output,`private-${Date.now()}`)},timeout:45000});
  page=await app.firstWindow();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent!=='Checking connection');
  await page.evaluate(async apiKey=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,apiKey,model:'gemini-3.5-flash-lite',answerMode:'balanced',dataPolicy:'unpaid'});},key);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#connection-status')?.textContent==='AI provider configured');await page.uncheck('#auto-answer');
  const created=app.waitForEvent('window');await page.click('#toggle-overlay');floating=await created;await floating.waitForURL('**/overlay.html');
  await app.evaluate(({BrowserWindow,screen})=>{
   const display=screen.getPrimaryDisplay();
   globalThis.visionFixture=new BrowserWindow({...display.bounds,frame:false,fullscreen:true,show:false,backgroundColor:'#264653',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
   visionFixture.setContentProtection(false);visionFixture.setAlwaysOnTop(true,'normal');
   const overlay=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/overlay.html'));overlay.setAlwaysOnTop(true,'screen-saver');
  });
  for(const scene of scenes){
   const started=Date.now();
   try{
    const html='<html><head><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:#264653}main{position:absolute;inset:34px;background:white;padding:30px 40px;color:#111;font:24px/1.5 Arial;overflow:hidden}h1{font-size:32px;margin:0 0 15px}p{margin:12px 0}</style></head><body><main>'+scene.html+'</main></body></html>';
    const fixture=await app.evaluate(async({screen},html)=>{await visionFixture.loadURL('data:text/html,'+encodeURIComponent(html));await visionFixture.webContents.executeJavaScript('Promise.all([...document.images].map(i=>i.decode()))');visionFixture.show();const d=screen.getPrimaryDisplay();return{bounds:visionFixture.getBounds(),display:d.bounds,fullScreen:visionFixture.isFullScreen()};},html);
    assert.equal(fixture.fullScreen,true);assert.deepEqual(fixture.bounds,fixture.display);
    await page.fill('#question-input',scene.question);
    await floating.click('#overlay-screenshot');await page.locator('#screen-analysis-dialog').waitFor({state:'visible'});
    await page.selectOption('#screen-quality',scene.quality);
    // Verify the physical capture is covered by our synthetic scene before any upload.
    const capture=await page.evaluate(()=>{const image=document.querySelector('#screen-preview-image');const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const corners=[[5,5],[c.width-6,5],[5,c.height-6],[c.width-6,c.height-6]].map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data));return{width:c.width,height:c.height,corners};});
    assert.ok(capture.corners.every(c=>Math.abs(c[0]-38)<15&&Math.abs(c[1]-70)<15&&Math.abs(c[2]-83)<15),'Synthetic full-screen coverage was not verified; image must not be uploaded.');
    await page.locator('#screen-preview-image').screenshot({path:path.join(output,scene.name+'-input.png')});
    const sendAt=Date.now();await page.click('#screen-send');
    await page.waitForFunction(q=>document.querySelector('.answer-question')?.textContent===q,scene.question);
    await page.waitForFunction(()=>!document.querySelector('#generate-button').hidden,null,{timeout:155000});
    const error=await page.locator('#answer-error').textContent();if(error)throw Error(error);
    const text=await page.locator('#answer-text').textContent();assert.ok(scene.check(text),'Answer did not meet required visible-content checks.');
    await floating.waitForFunction(text=>document.querySelector('#overlay-answer').textContent===text,text);
    report.scenes.push({name:scene.name,passed:true,quality:scene.quality,answer:redact(text),responseMs:Date.now()-sendAt,totalMs:Date.now()-started,capture});console.log('PASS '+scene.name);
   }catch(error){report.scenes.push({name:scene.name,passed:false,error:redact(error.message),totalMs:Date.now()-started});console.log('FAIL '+scene.name+': '+redact(error.message));if(/coverage/.test(error.message))break;}
  }
  // Local-only composited screenshots: capture exclusion is restored before any later model request.
  if(report.scenes.some(s=>s.passed)){
   for(const background of ['white','#151b23']){
    await app.evaluate(async(_,background)=>{await visionFixture.loadURL('data:text/html,'+encodeURIComponent(`<html><body style="margin:0;background:${background};color:${background==='white'?'#111':'#fff'};font:23px/1.6 Arial;padding:40px"><h1>Synthetic interview screen</h1><p>Read the problem and explain your approach.</p><p>Background text remains visible through the glass.</p></body></html>`));},background);
    for(const opacity of [0,.35,.75]){
     await page.evaluate(opacity=>window.copilot.setOverlayPreferences({opacity}),opacity);
     await floating.waitForFunction(opacity=>document.querySelector('#floating-opacity-value').textContent===`${Math.round(opacity*100)}%`,opacity);
     const style=await floating.evaluate(()=>{const s=getComputedStyle(document.querySelector('#overlay-answer'));return{color:s.color,textOpacity:s.opacity,fontSize:s.fontSize,shadow:s.textShadow};});
     const shot=await app.evaluate(async({BrowserWindow,desktopCapturer,screen})=>{const overlay=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/overlay.html'));overlay.setContentProtection(false);try{overlay.showInactive();overlay.moveTop();await overlay.webContents.capturePage();const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:1920,height:1080}});const source=sources.find(s=>s.display_id===String(screen.getPrimaryDisplay().id));return{png:source.thumbnail.toPNG().toString('base64'),nativeOpacity:overlay.getOpacity()};}finally{overlay.setContentProtection(true);}});
     assert.equal(shot.nativeOpacity,1);assert.equal(style.color,'rgb(255, 255, 255)');assert.equal(style.textOpacity,'1');assert.notEqual(style.shadow,'none');
     const filename=`glass-${background==='white'?'light':'dark'}-${Math.round(opacity*100)}.png`;await fs.writeFile(path.join(output,filename),Buffer.from(shot.png,'base64'));
     report.glass.push({background,backgroundOpacity:opacity,...style,nativeOpacity:shot.nativeOpacity,screenshot:filename});
    }
   }
  }
 }finally{
  if(page&&!page.isClosed())await page.evaluate(async()=>{const s=await window.copilot.getSettings();await window.copilot.saveSettings({...s,apiKey:''});await window.copilot.saveSettings({...s,apiKey:''});}).catch(()=>{});
  await app?.close();report.completedAt=new Date().toISOString();report.passed=report.scenes.length===scenes.length&&report.scenes.every(s=>s.passed)&&report.glass.length===6;
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('Vision/glass result: '+(report.passed?'PASS':'FAILED/INCOMPLETE'));if(!report.passed)process.exitCode=1;
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
