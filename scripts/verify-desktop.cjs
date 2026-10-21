const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron, chromium } = require('playwright');
const { WebSocketServer } = require('ws');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results');
const key = 'integration-test-only-key';
const calls = [];
let imageRequests = 0, pdfRequests = 0;
const liveConfigs = [];
let liveConnections = 0;
let groupedConstraintsReceived = false;

function contrastCheck() {
  const rgb = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const luminance = color => rgb(color).map(n => { const s = n / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((n, s, i) => n + s * [0.2126, 0.7152, 0.0722][i], 0);
  return [...document.querySelectorAll('h1, .page-heading p, .button.primary, .nav-link.active, .field-help, .capture-footnote')].filter(el => el.getClientRects().length).map(el => {
    const style = getComputedStyle(el);
    let parent = el, background = style.backgroundColor;
    while ((!background || background === 'rgba(0, 0, 0, 0)') && parent.parentElement) { parent = parent.parentElement; background = getComputedStyle(parent).backgroundColor; }
    if (!background || background === 'rgba(0, 0, 0, 0)') background = 'rgb(255,255,255)';
    const a = luminance(style.color), b = luminance(background);
    return { selector: el.id || el.className || el.tagName, color: style.color, background, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), fontSize: style.fontSize };
  });
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const audioSource = await fs.readFile(path.join(root, 'renderer/audio.js'), 'utf8');
  const { encodeWav } = await import(`data:text/javascript;base64,${Buffer.from(audioSource).toString('base64')}`);
  // The repeating fixture must include a real pause longer than the routing window.
  const fakeSamples = new Float32Array(48000 * 6);
  for (let i = 0; i < 48000; i++) fakeSamples[i] = Math.sin(2 * Math.PI * 220 * i / 48000) * 0.15;
  const fakeAudioPath = path.join(output, 'synthetic-microphone.wav');
  await fs.writeFile(fakeAudioPath, Buffer.from(encodeWav([fakeSamples], 48000)));
  const mock = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const bytes = Buffer.concat(chunks);
    calls.push({ path: req.url, authorized: req.headers.authorization === `Bearer ${key}` || req.headers['x-goog-api-key'] === key, bytes: bytes.length });
    if (['/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse','/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse'].includes(req.url)) {
      const payload = JSON.parse(bytes.toString());
      const questionText=payload.contents[0]?.parts?.find(part=>part.text)?.text || '';
      if(questionText.includes('Implement cache lookup and Do not use recursion. Use O(1) extra space and at most 2 passes.')) groupedConstraintsReceived=true;
      if (payload.contents.some(content => content.parts?.some(part => part.inlineData?.mimeType === 'image/jpeg'))) imageRequests++;
      const coding = payload.systemInstruction.parts[0].text.includes('This is a coding task.');
      assert.equal(payload.generationConfig.thinkingConfig.thinkingLevel, questionText.includes('Solve this quick screenshot coding problem.') ? 'HIGH' : coding ? 'MEDIUM' : 'LOW');
      assert.ok(payload.systemInstruction.parts[0].text.includes('interview'));
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      if (coding) {
        res.end(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Use a sorted array and halve the search range.\n\n```python\ndef search(items, target):\n    lo, hi = 0, len(items) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if items[mid] == target: return mid\n        if items[mid] < target: lo = mid + 1\n        else: hi = mid - 1\n    return -1\n```\nTime O(log n); extra space O(1).' }] }, finishReason: 'STOP' }] })}\n\n`); return;
      }
      res.write(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Gemini mock answer: ' }] } }] })}\n\n`);
      res.end(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'use a token bucket with bounded retries.' }] }, finishReason: 'STOP' }] })}\n\n`); return;
    }
    if (['/v1beta/models/gemini-3.8-flash:generateContent','/v1beta/models/gemini-3.5-flash-lite:generateContent'].includes(req.url)) {
      const payload=JSON.parse(bytes.toString());
      assert.ok(payload.contents[0].parts.some(part=>part.inlineData?.mimeType==='application/pdf'));
      pdfRequests++;res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({candidates:[{content:{parts:[{text:'Synthetic Resume QA\nEXPERIENCE\nBuilt test systems. Improved latency by 37%.'}]},finishReason:'STOP'}]}));return;
    }
    if (req.url === '/v1/audio/transcriptions') {
      assert.ok(bytes.includes(Buffer.from('RIFF')), 'Transcription should receive a valid WAV file.');
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ text: 'What tradeoffs improve API resilience?' })); return;
    }
    if (req.url === '/v1/chat/completions') {
      const payload = JSON.parse(bytes.toString());
      assert.equal(payload.stream, true);
      const notes = payload.messages[0].content.includes('Summarize this session');
      const answer = notes ? '## Summary\nDiscussed resilient APIs.\n\n## Practice next\nPrepare a concrete example.' : 'Start with clear service boundaries. Add timeouts, bounded retries, and observability. Tie these choices to your actual project experience.';
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      for (const delta of answer.match(/.{1,25}/gs)) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`);
      res.end('data: [DONE]\n\n'); return;
    }
    res.writeHead(404).end();
  });
  const liveServer = new WebSocketServer({ server: mock });
  let liveFrames = 0;
  liveServer.on('connection', (socket, request) => {
    liveConnections++;
    assert.equal(new URL(request.url, 'http://localhost').searchParams.get('key'), key);
    let sent = false;
    socket.on('message', bytes => {
      const payload = JSON.parse(bytes.toString());
      if (payload.setup) { assert.equal(payload.setup.model, 'models/gemini-3.5-transcribe-live'); liveConfigs.push(payload.setup.inputAudioTranscription); socket.send(JSON.stringify({ setupComplete: {} })); }
      if (payload.realtimeInput?.audio) {
        liveFrames++; assert.equal(payload.realtimeInput.audio.mimeType, 'audio/pcm;rate=16000');
        if (!sent) { sent = true; socket.send(JSON.stringify({ serverContent: { inputTranscription: { text: 'Explain an API rate limiter?' }, turnComplete: true } })); }
      }
    });
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${mock.address().port}/v1`;
  let electronApp, browser, preview;
  const errors = [];
  try {
    electronApp = await _electron.launch({ executablePath: process.argv.includes('--packaged') ? path.join(root,'dist/win-unpacked/Parakeet Studio.exe') : require('electron'), args: [...(process.argv.includes('--packaged') ? [] : [root]), '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${fakeAudioPath}`], env: { ...process.env, PARAKEET_USER_DATA: path.join(output, `user-data-${Date.now()}`) }, timeout: 45000 });
    const page = await electronApp.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForFunction(() => document.querySelector('#connection-status')?.textContent !== 'Checking connection');
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    await page.screenshot({ path: path.join(output, 'desktop-empty.png'), fullPage: true, animations: 'disabled' });
    await page.click('[data-view="settings"]');
    await page.selectOption('#provider-type', 'openai');
    await page.fill('#provider-url', baseUrl);
    await page.selectOption('#data-policy','local');
    await page.fill('#provider-key', key);
    await page.locator('.answer-preferences summary').click();
    await page.fill('#transcription-language', 'en-IN');
    await page.fill('#transcription-vocabulary', 'Kubernetes, SentinelAPI');
    await page.selectOption('#network-mode', 'economy');
    await page.fill('#answer-model', 'mock-answer');
    await page.fill('#transcription-model', 'mock-transcribe');
    await page.click('#save-settings');
    await page.waitForFunction(() => document.querySelector('#key-status')?.textContent.includes('Key saved') || !document.querySelector('#settings-error').hidden);
    assert.equal(await page.locator('#settings-error').textContent(), '', 'Settings save failed');
    const settings = await page.evaluate(() => window.copilot.getSettings());
    assert.equal(settings.hasApiKey, true); assert.equal(settings.apiKey, undefined);
    const settingsFile = path.join(await electronApp.evaluate(({ app }) => app.getPath('userData')), 'settings.json');
    assert.ok(!(await fs.readFile(settingsFile, 'utf8')).includes(key), 'Saved API key must be encrypted.');
    await page.click('[data-view="context"]');
    await page.fill('#context-role', 'Senior Software Engineer');
    await page.fill('#context-company', 'Example Labs');
    await page.fill('#context-resume', 'Built a resilient API with Node.js and PostgreSQL.');
    await page.locator('#context-role').blur();
    await page.waitForTimeout(900);
    await page.click('[data-view="workspace"]');
    await page.fill('#question-input', 'How would you design a resilient API?');
    await page.click('#generate-button');
    await page.waitForFunction(() => document.querySelector('#answer-content')?.textContent.includes('bounded retries'));
    await page.locator('#toast').waitFor({ state: 'hidden' });
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(output, 'desktop-answer.png'), fullPage: true, animations: 'disabled' });
    const floatingPromise = electronApp.waitForEvent('window');
    await page.click('#toggle-overlay');
    const floating = await floatingPromise;
    await floating.waitForURL('**/overlay.html');
    await floating.waitForFunction(() => document.body.textContent.includes('bounded retries'));
    const centered = await page.evaluate(() => window.copilot.moveOverlay({ action: 'middle-center' }));
    const shifted = await page.evaluate(() => window.copilot.moveOverlay({ action: 'right' }));
    assert.equal(shifted.x, centered.x + 32);
    const lowered = await page.evaluate(() => window.copilot.moveOverlay({ action: 'down' }));
    assert.equal(lowered.y, shifted.y + 32);
    await floating.locator('.floating-preferences summary').click();
    await floating.click('[data-place="top-left"]');
    const snapped = await electronApp.evaluate(({BrowserWindow,screen}) => { const w=BrowserWindow.getAllWindows().find(w=>new URL(w.webContents.getURL()).pathname.endsWith('/overlay.html'));return{bounds:w.getBounds(),area:screen.getDisplayMatching(w.getBounds()).workArea}; });
    assert.equal(snapped.bounds.x,snapped.area.x+24);assert.equal(snapped.bounds.y,snapped.area.y+24);
    await floating.locator('.floating-preferences summary').click();
    await floating.screenshot({ path: path.join(output, 'desktop-overlay.png') });
    const prefs = await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map(w => ({ onTop: w.isAlwaysOnTop(), protected: w.isContentProtected(), sandbox: w.webContents.getLastWebPreferences().sandbox, nodeIntegration: w.webContents.getLastWebPreferences().nodeIntegration, isolation: w.webContents.getLastWebPreferences().contextIsolation })));
    assert.ok(prefs.every(p => p.sandbox && !p.nodeIntegration && p.isolation));
    assert.ok(prefs.some(p => p.onTop), 'Floating overlay lost its native always-on-top flag: '+JSON.stringify(prefs));
    assert.ok(prefs.every(p => p.protected), 'Both main and overlay windows must have OS capture protection.');
    await page.evaluate(() => { const marker = document.createElement('div'); marker.id = 'capture-test-marker'; marker.style.cssText = 'position:fixed;left:0;top:0;width:220px;height:80px;background:rgb(254,0,254);z-index:2147483647'; document.body.appendChild(marker); });
    await floating.evaluate(() => { const marker = document.createElement('div'); marker.id = 'capture-test-marker'; marker.style.cssText = 'position:fixed;left:0;top:0;width:220px;height:80px;background:rgb(254,0,254);z-index:2147483647'; document.body.appendChild(marker); });
    await page.bringToFront();
    await page.waitForTimeout(500);
    const captureProtection = await electronApp.evaluate(async ({ BrowserWindow, desktopCapturer }) => {
      const count = image => { const pixels = image.toBitmap(); let n = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 250 && pixels[i + 1] < 4 && pixels[i + 2] > 250) n++; return n; };
      const main = BrowserWindow.getAllWindows().find(w => new URL(w.webContents.getURL()).pathname.endsWith('/index.html'));
      const ownPixels = count(await main.webContents.capturePage());
      const overlayPixels = count(await BrowserWindow.getAllWindows().find(w => new URL(w.webContents.getURL()).pathname.endsWith('/overlay.html')).webContents.capturePage());
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
      return { ownPixels, overlayPixels, desktopPixels: sources.reduce((n, source) => n + count(source.thumbnail), 0), screens: sources.length };
    });
    await page.evaluate(() => document.getElementById('capture-test-marker')?.remove());
    await floating.evaluate(() => document.getElementById('capture-test-marker')?.remove());
    assert.ok(captureProtection.ownPixels > 1000, 'Test marker must be visible in the app rendering.');
    assert.ok(captureProtection.overlayPixels > 1000, 'Overlay test marker must be visible in the overlay rendering.');
    assert.ok(captureProtection.screens > 0); assert.equal(captureProtection.desktopPixels, 0, 'Test marker must be excluded from OS desktop capture.');
    const transcription = await page.evaluate(async () => {
      const { encodeWav } = await import('./audio.js');
      return window.copilot.transcribe({ audio: encodeWav([new Float32Array(16000).fill(0.02)], 16000), mimeType: 'audio/wav' });
    });
    assert.equal(transcription.text, 'What tradeoffs improve API resilience?');
    const notes = await page.evaluate(async () => window.copilot.generate({ requestId: 'notes-test', kind: 'notes', transcript: 'Interviewer: How would you design a resilient API?', context: {}, question: '' }));
    assert.match(notes.text, /Summary/);
    await page.click('#generate-notes');
    await page.locator('#session-notes-panel').waitFor({ state: 'visible' });
    assert.match(await page.locator('#session-notes-text').textContent(), /resilient APIs/);
    const exportPath = path.join(output, 'exported-session.md');
    await electronApp.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, exportPath);
    await page.click('#export-current');
    await page.waitForFunction(() => document.querySelector('#toast')?.textContent === 'Session exported.');
    const exported = await fs.readFile(exportPath, 'utf8');
    assert.match(exported, /bounded retries/); assert.match(exported, /resilient APIs/);
    // Exercise actual native PDF extraction through the resume-import IPC using a synthetic document.
    const pdfPath = path.join(output, 'synthetic-resume.pdf');
    const stream = 'BT /F1 16 Tf 40 150 Td (Synthetic Resume QA) Tj ET';
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
    let pdf = '%PDF-1.4\n', offsets = [0];
    for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
    const xref = Buffer.byteLength(pdf);
    pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    await fs.writeFile(pdfPath, pdf);
    await electronApp.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, pdfPath);
    const imported = await page.evaluate(() => window.copilot.importDocument());
    assert.match(imported.text, /Synthetic Resume QA/);assert.equal(imported.pages,1);
    await page.click('a[href="#context"]');await page.click('#import-resume');
    await page.locator('#resume-review-dialog').waitFor({state:'visible'});
    await page.fill('#resume-review-text','Reviewed synthetic resume with 37% improvement.');
    await page.click('#resume-review-dialog button[value="confirm"]');
    await page.waitForFunction(()=>document.querySelector('#context-resume').value==='Reviewed synthetic resume with 37% improvement.');
    assert.equal(await page.inputValue('#context-resume'),'Reviewed synthetic resume with 37% improvement.');
    await page.click('#import-resume');await page.locator('#resume-review-dialog').waitFor({state:'visible'});
    await page.fill('#resume-review-text','Cancelled replacement');await page.click('#resume-review-dialog button[value="cancel"]');
    assert.equal(await page.inputValue('#context-resume'),'Reviewed synthetic resume with 37% improvement.');
    await page.click('a[href="#workspace"]');
    await page.check('#auto-answer');
    const answersBeforeAudio = calls.filter(call => call.path === '/v1/chat/completions').length;
    await page.click('#capture-button');
    await page.waitForFunction(() => document.querySelector('#capture-label')?.textContent === 'Stop listening');
    await page.waitForFunction(() => [...document.querySelectorAll('.transcript-segment p')].some(p => p.textContent.includes('What tradeoffs improve API resilience?')), { timeout: 12000 });
    await new Promise((resolve, reject) => {
      const deadline = Date.now() + 9000;
      const timer = setInterval(() => {
        if (calls.filter(call => call.path === '/v1/chat/completions').length > answersBeforeAudio) { clearInterval(timer); resolve(); }
        else if (Date.now() > deadline) { clearInterval(timer); reject(new Error('Automatic answer did not trigger from the microphone transcript.')); }
      }, 50);
    });
    await page.waitForFunction(() => document.querySelector('.answer-question')?.textContent.includes('What tradeoffs') && !document.querySelector('#generate-button').hidden);
    await page.click('#capture-button');
    await page.waitForFunction(() => document.querySelector('#capture-label')?.textContent === 'Start listening');
    const captureRequests = calls.filter(call => call.path === '/v1/audio/transcriptions').length;
    assert.ok(captureRequests >= 2, 'Synthetic microphone should pass through real AudioWorklet and transcription IPC.');
    await page.click('[data-view="settings"]');
    await page.selectOption('#provider-type', 'gemini');
    await page.fill('#provider-url', `http://127.0.0.1:${mock.address().port}/v1beta`);
    await page.fill('#provider-key', key);
    await page.click('#save-settings');
    await page.waitForFunction(() => document.querySelector('#settings-save-status')?.textContent.includes('Connection saved'));
    assert.equal((await page.evaluate(() => window.copilot.getSettings())).provider, 'gemini');
    await page.click('[data-view="workspace"]');
    await page.click('#capture-button');
    await page.waitForFunction(() => [...document.querySelectorAll('.transcript-segment p')].some(p => p.textContent.includes('Explain an API rate limiter?')));
    await page.waitForFunction(() => document.querySelector('#answer-text')?.textContent.includes('Gemini mock answer'));
    await page.waitForFunction(()=>!document.querySelector('#generate-button').hidden);
    const emitQuestion=(channel,value)=>electronApp.evaluate(({BrowserWindow},{channel,value})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('index.html')).webContents.send(channel,value),{channel,value});
    const callsBeforeGrouping=calls.length;
    await emitQuestion('live:transcript',{source:'microphone',text:'Implement cache lookup and'});
    await page.locator('#pending-question').waitFor({state:'visible'});
    await emitQuestion('live:interim',{source:'microphone',text:'Do not use recursion'});
    await page.waitForFunction(()=>document.querySelector('#pending-question-send').disabled);
    await new Promise(resolve=>setTimeout(resolve,3200));
    assert.equal(calls.length,callsBeforeGrouping,'Unfinalized constraints must not trigger an answer.');
    await emitQuestion('live:transcript',{source:'microphone',text:'Do not use recursion. Use O(1) extra space and at most 2 passes.'});
    await page.waitForFunction(()=>document.querySelector('#pending-question-text').textContent.includes('at most 2 passes')&&!document.querySelector('#pending-question-send').disabled);
    await page.screenshot({path:path.join(output,'pending-question-review.png'),fullPage:true});
    const pendingContrast=await page.locator('#pending-question-status').evaluate(el=>{
      const luminance=color=>(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number).map(n=>{const c=n/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
      const foreground=luminance(getComputedStyle(el).color),background=luminance(getComputedStyle(document.querySelector('#pending-question')).backgroundColor);
      return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
    });
    assert.ok(pendingContrast>=4.5,'Pending question text must meet normal-text contrast.');
    assert.ok((await page.locator('#answer-content').boundingBox()).height>=170,'Pending review must not collapse the current answer.');
    await floating.waitForFunction(()=>document.querySelector('#overlay-pending-text').textContent.includes('at most 2 passes')&&!document.querySelector('#overlay-generate').disabled);
    await floating.screenshot({path:path.join(output,'pending-question-glass.png')});
    await floating.click('#overlay-generate');
    await page.waitForFunction(()=>document.querySelector('.answer-question')?.textContent.includes('at most 2 passes')&&!document.querySelector('#generate-button').hidden);
    assert.equal(groupedConstraintsReceived,true,'Provider must receive the finalized grouped constraints.');
    const callsBeforeDismiss=calls.length;
    await emitQuestion('live:transcript',{source:'microphone',text:'Describe retry policies and'});
    await page.locator('#pending-question').waitFor({state:'visible'});await page.click('#pending-question-dismiss');
    await new Promise(resolve=>setTimeout(resolve,3200));assert.equal(calls.length,callsBeforeDismiss,'Dismiss must cancel the queued automatic draft.');
    await emitQuestion('live:transcript',{source:'microphone',text:'Explain retry limits and'});
    await emitQuestion('live:status',{source:'microphone',state:'gap',message:'Synthetic missing speech segment.'});
    await page.waitForFunction(()=>document.querySelector('#pending-question-status').textContent.includes('Audio was interrupted'));
    await page.click('#pending-question-send');
    await page.waitForFunction(()=>document.querySelector('.answer-question')?.textContent==='Explain retry limits and'&&!document.querySelector('#generate-button').hidden);
    await emitQuestion('live:transcript',{source:'microphone',text:'Explain cancellation and'});
    await emitQuestion('live:transcript',{source:'microphone',text:'Never mind.'});
    await page.locator('#pending-question').waitFor({state:'hidden'});
    const beforeReconnect = liveConnections;
    const framesBeforeReconnect = liveFrames;
    for (const socket of liveServer.clients) socket.terminate();
    const reconnectDeadline = Date.now() + 8000;
    while (liveConnections <= beforeReconnect && Date.now() < reconnectDeadline) await new Promise(resolve => setTimeout(resolve, 40));
    assert.ok(liveConnections > beforeReconnect, 'The renderer should recover a dropped Live socket.');
    while (liveFrames <= framesBeforeReconnect && Date.now() < reconnectDeadline) await new Promise(resolve => setTimeout(resolve, 40));
    assert.ok(liveFrames > framesBeforeReconnect, 'Audio must continue reaching the provider after reconnection.');
    await page.waitForFunction(() => [...document.querySelectorAll('.transcript-segment p')].some(p => p.textContent.includes('Reconnecting')));
    await electronApp.evaluate(({powerMonitor})=>powerMonitor.emit('suspend'));
    await page.waitForFunction(() => document.querySelector('#capture-label')?.textContent === 'Start listening');
    assert.equal((await page.evaluate(()=>window.copilot.getRuntime())).blocked,true);
    await electronApp.evaluate(({powerMonitor})=>powerMonitor.emit('resume'));
    await page.waitForFunction(async()=>!(await window.copilot.getRuntime()).blocked&&!document.querySelector('#capture-button').disabled);
    const stoppedFrames=liveFrames,stoppedConnections=liveConnections;
    await new Promise(resolve=>setTimeout(resolve,1200));
    assert.equal(liveFrames,stoppedFrames,'Resume must not restart audio delivery.');assert.equal(liveConnections,stoppedConnections);
    assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.transcript-segment p')].some(p=>p.textContent.includes('Desktop interruption'))));
    await page.click('#capture-button');await page.waitForFunction(()=>document.querySelector('#capture-label')?.textContent==='Stop listening');
    await page.click('#capture-button');await page.waitForFunction(()=>document.querySelector('#capture-label')?.textContent==='Start listening');
    assert.ok(liveFrames > 0, 'Actual renderer PCM should reach the Gemini Live mock.');
    assert.ok(liveConfigs.some(config => config.languageCodes[0] === 'en-IN' && config.mode === 'SMART' && config.customVocabulary.includes('SentinelAPI')));
    await page.uncheck('#auto-answer');
    await page.click('[data-edit-segment="0"]');
    await page.fill('#edit-transcript-text', 'How would you design a resilient API with a cache?');
    await page.click('#edit-transcript-dialog button[value="confirm"]');
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Transcript corrected'));
    const textExportPath = path.join(output, 'timestamped-transcript.txt');
    await electronApp.evaluate(({dialog}, filePath) => { dialog.showSaveDialog = async () => ({canceled:false,filePath}); }, textExportPath);
    await page.click('#export-transcript');
    await page.waitForFunction(() => document.querySelector('#toast').textContent === 'Session exported.');
    const plainTranscript = await fs.readFile(textExportPath,'utf8');
    assert.match(plainTranscript,/original:/); assert.match(plainTranscript,/You:|Your question:/); assert.match(plainTranscript,/\d{4}-\d{2}-\d{2}T/);
    await page.click('[data-style="coding"]');
    await page.fill('#question-input', 'Implement binary search in Python');
    await page.click('#generate-button');
    await page.waitForFunction(() => document.querySelector('#answer-text pre code')?.textContent.includes('def search') && !document.querySelector('#generate-button').hidden);
    assert.ok(await page.evaluate(async () => { const {renderAnswerText}=await import('./answer-format.js');const target=document.createElement('div');renderAnswerText(target,'```html\n<img src=x onerror=alert(1)>\n```');return !target.querySelector('img') && target.querySelector('code').textContent.includes('<img'); }));
    await page.click('[data-style="concise"]');
    // Each input owns its own Live connection and preserves source identity.
    const sources = await page.evaluate(async () => {
      const received = new Set();
      const cleanup = window.copilot.onLiveTranscript(value => received.add(value.source));
      try {
        await window.copilot.startLive({ sources: ['microphone', 'system'] });
        for (const source of ['microphone', 'system']) await window.copilot.sendLiveAudio({ source, audio: new Int16Array(1600).buffer });
        const deadline = Date.now() + 4000;
        while (received.size < 2 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
        return [...received].sort();
      } finally { await window.copilot.stopLive(); cleanup(); }
    });
    assert.deepEqual(sources, ['microphone', 'system']);
    await page.uncheck('#auto-answer');
    await page.locator('.overlay-preferences summary').click();
    await page.evaluate(() => { const slider = document.querySelector('#overlay-opacity'); slider.value = '65'; slider.dispatchEvent(new Event('change', { bubbles: true })); });
    await floating.waitForFunction(() => document.querySelector('#floating-opacity-value').textContent === '65%');
    const opacity = await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => new URL(w.webContents.getURL()).pathname.endsWith('/overlay.html')).getOpacity());
    assert.equal(opacity, 1, 'Native opacity must never fade the words.');
    const glassChecks = [];
    for (const value of [0, 15, 65, 95]) {
      await page.evaluate(value => window.copilot.setOverlayPreferences({ opacity: value / 100 }), value);
      await floating.waitForFunction(value => document.querySelector('#floating-opacity-value').textContent === `${value}%`, value);
      const glass = await floating.evaluate(() => {
        const answer = document.querySelector('#overlay-answer');
        const card = document.querySelector('.floating-card');
        return { background: getComputedStyle(card).backgroundColor, color: getComputedStyle(answer).color, textOpacity: getComputedStyle(answer).opacity, textShadow: getComputedStyle(answer).textShadow, fontSize: getComputedStyle(answer).fontSize, ancestorsOpaque: [...document.querySelectorAll('html, body, .floating-card, .floating-content')].every(el => getComputedStyle(el).opacity === '1') };
      });
      assert.equal(glass.color, 'rgb(255, 255, 255)'); assert.equal(glass.textOpacity, '1'); assert.ok(glass.ancestorsOpaque);
      assert.notEqual(glass.textShadow, 'none'); assert.ok(parseFloat(glass.fontSize) >= 16);
      const alpha = glass.background.startsWith('rgba') ? Number(glass.background.match(/[\d.]+/g)[3]) : 1;
      assert.ok(Math.abs(alpha - value / 100) < 0.005);
      glassChecks.push({ value, ...glass });
    }
    await page.evaluate(() => window.copilot.setOverlayPreferences({ opacity: 0.35 }));
    await floating.waitForFunction(() => document.querySelector('#floating-opacity-value').textContent === '35%');
    await floating.screenshot({ path: path.join(output, 'desktop-glass-overlay.png') });
    await page.check('#overlay-passthrough');
    await page.waitForFunction(async () => (await window.copilot.getOverlayPreferences()).clickThrough);
    await page.uncheck('#overlay-passthrough');
    await page.waitForFunction(async () => !(await window.copilot.getOverlayPreferences()).clickThrough);
    await page.selectOption('#overlay-position', 'left');
    await page.waitForFunction(async () => (await window.copilot.getOverlayPreferences()).position === 'left');
    await floating.click('#overlay-hide');
    assert.equal(await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(w => new URL(w.webContents.getURL()).pathname.endsWith('/overlay.html')).isVisible()), false);
    await page.click('#toggle-overlay');
    await floating.waitForFunction(() => document.visibilityState === 'visible');
    await electronApp.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:0});});
    assert.equal(await page.evaluate(()=>window.copilot.importDocument({mode:'ai'})),null);
    assert.equal(pdfRequests,0,'Cancel must not upload a PDF.');
    await electronApp.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});
    const aiResume=await page.evaluate(()=>window.copilot.importDocument({mode:'ai'}));
    assert.match(aiResume.text,/37%/);assert.equal(pdfRequests,1);
    await page.fill('#question-input', 'Explain this synthetic test screenshot.');
    // Substitute a fixture for screenshot capture: never send or save real desktop pixels.
    await electronApp.evaluate(({ desktopCapturer, nativeImage, screen }) => {
      desktopCapturer.getSources = async () => [{ id: 'screen:fixture:0', display_id: String(screen.getPrimaryDisplay().id), name: 'Synthetic screen', thumbnail: nativeImage.createFromBitmap(Buffer.alloc(1280*720*4,255), { width: 1280, height: 720 }) }];
    });
    const receipts = await page.evaluate(async () => {
      let invalidDisplay = false;
      try { await window.copilot.captureScreenshot({displayId:'missing-monitor'}); } catch { invalidDisplay = true; }
      const first = await window.copilot.captureScreenshot({}); const second = await window.copilot.captureScreenshot({});
      let stale = false; try { await window.copilot.validateScreenshot({captureId:first.captureId}); } catch { stale = true; }
      const current = await window.copilot.validateScreenshot({captureId:second.captureId});
      return {invalidDisplay,stale,current:current.displayId===second.displayId,width:second.width,height:second.height};
    });
    const primaryDisplay=await page.evaluate(async()=> (await window.copilot.listDisplays()).find(display=>display.primary));
    const fixtureScale=Math.min(1,primaryDisplay.width/1280,primaryDisplay.height/720);
    assert.deepEqual(receipts,{invalidDisplay:true,stale:true,current:true,width:Math.round(1280*fixtureScale),height:Math.round(720*fixtureScale)});
    await page.click('#review-screenshot'); await page.locator('#screen-analysis-dialog').waitFor({state:'visible'});
    await electronApp.evaluate(({screen})=>screen.emit('display-metrics-changed',{},screen.getPrimaryDisplay(),['scaleFactor']));
    await page.waitForFunction(()=>document.querySelector('#screen-send').disabled && document.querySelector('#screen-error').textContent.includes('Display configuration changed'));
    await page.click('#screen-analysis-dialog button[value="cancel"]');
    await page.click('#review-screenshot'); await page.locator('#screen-analysis-dialog').waitFor({state:'visible'});
    await page.evaluate(()=>{globalThis.restoreScreenClock=performance.now.bind(performance);performance.now=()=>globalThis.restoreScreenClock()+120001;});
    await page.waitForFunction(()=>document.querySelector('#screen-send').disabled && document.querySelector('#screen-error').textContent.includes('expired'));
    await page.evaluate(()=>{performance.now=globalThis.restoreScreenClock;delete globalThis.restoreScreenClock;});
    await page.click('#screen-analysis-dialog button[value="cancel"]');
    assert.equal(imageRequests,0,'Rejected or expired previews must never upload.');
    await page.click('#review-screenshot');
    await page.locator('#screen-analysis-dialog').waitFor({state:'visible'});
    await page.click('#screen-analysis-dialog button[value="cancel"]');
    assert.equal(imageRequests,0,'Cancel must not upload the screenshot.');
    await page.click('#review-screenshot');
    await page.locator('#screen-analysis-dialog').waitFor({state:'visible'});
    const previewBounds=await page.locator('#screen-preview-image').boundingBox();
    await page.mouse.move(previewBounds.x+previewBounds.width*.2,previewBounds.y+previewBounds.height*.2);
    await page.mouse.down();await page.mouse.move(previewBounds.x+previewBounds.width*.8,previewBounds.y+previewBounds.height*.8);await page.mouse.up();
    await page.locator('#screen-crop-selection').waitFor({state:'visible'});
    await page.screenshot({path:path.join(output,'screen-analysis-preview.png'),fullPage:true});
    await page.click('#screen-send');
    await page.waitForFunction(() => document.querySelector('.answer-question')?.textContent.includes('synthetic test screenshot') && !document.querySelector('#generate-button').hidden);
    assert.equal(imageRequests, 1, 'Screenshot must reach Gemini as a JPEG image part.');
    await page.click('#previous-answer');
    await page.waitForFunction(() => !document.querySelector('.answer-question')?.textContent.includes('synthetic test screenshot'));
    await floating.click('#overlay-next');
    await page.waitForFunction(() => document.querySelector('.answer-question')?.textContent.includes('synthetic test screenshot'));
    // A quick screenshot must work while minimized without opening a review or workspace.
    await page.fill('#question-input','Solve this quick screenshot coding problem.');
    await page.evaluate(()=>window.copilot.windowControl('minimize'));
    const pagesBefore=electronApp.windows().length;
    await page.evaluate(()=>document.querySelector('#screenshot-answer').click());
    await page.waitForFunction(()=>document.querySelector('.answer-question')?.textContent.includes('quick screenshot coding problem') && !document.querySelector('#generate-button').hidden);
    assert.equal(imageRequests,2,'Quick capture must upload exactly one image.');
    assert.equal(await page.locator('#screen-analysis-dialog').evaluate(dialog=>dialog.open),false);
    assert.equal(electronApp.windows().length,pagesBefore,'Quick capture must not create a window.');
    assert.equal(await electronApp.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('index.html')).isMinimized()),true,'Quick capture must not restore the workspace.');
    await page.evaluate(()=>window.copilot.windowControl('show'));
    const beforeClear = await page.evaluate(() => window.copilot.loadWorkspace());
    await page.click('#clear-transcript');
    await page.click('#clear-transcript-dialog button[value="confirm"]');
    await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('Transcript cleared'));
    const afterClear = await page.evaluate(() => window.copilot.loadWorkspace());
    const cleared = afterClear.sessions.find(session => session.id === beforeClear.sessions[0].id);
    assert.equal(cleared.transcript.length, 0);
    assert.equal(cleared.exchanges.length, beforeClear.sessions[0].exchanges.length);
    assert.ok(cleared.exchanges.some(exchange => exchange.screenshotUsed));
    assert.ok(!JSON.stringify(afterClear).includes('data:image/'), 'Raw screenshot bytes must not enter persistent history.');
    const contrast = await page.evaluate(contrastCheck);
    for (const item of contrast) assert.ok(item.ratio >= 4.5, `Insufficient text contrast for ${item.selector}: ${item.ratio.toFixed(2)}`);
    const saved = await page.evaluate(() => window.copilot.loadWorkspace());
    assert.equal(saved.context.role, 'Senior Software Engineer');
    assert.ok(saved.sessions.some(session => session.exchanges.some(exchange => exchange.metrics?.firstTokenMs >= 0 && exchange.status === 'complete')));
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#connection-status')?.textContent === 'AI provider configured');
    const restoredSettings = await page.evaluate(() => window.copilot.getSettings());
    assert.equal(restoredSettings.networkMode,'economy'); assert.equal(restoredSettings.transcriptionLanguage,'en-IN');
    assert.equal((await page.evaluate(() => window.copilot.loadWorkspace())).sessions[0].transcript.length,0);
    assert.ok(calls.length >= 3 && calls.every(call => call.authorized));
    assert.deepEqual(errors, []);

    process.env.PARAKEET_PREVIEW_PORT = '0';
    preview = require('./preview.cjs');
    await new Promise(resolve => { if (preview.listening) resolve(); else preview.once('listening', resolve); });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const web = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await web.goto(`http://127.0.0.1:${preview.address().port}`);
    await web.locator('#preview-badge').waitFor({ state: 'visible' });
    await web.screenshot({ path: path.join(output, 'browser-preview.png'), fullPage: true, animations: 'disabled' });
    const browserContrast = [];
    for (const view of ['workspace', 'context', 'history', 'settings']) {
      await web.click(`[data-view="${view}"]`);
      await web.locator(`#view-${view}`).waitFor({ state: 'visible' });
      browserContrast.push(...(await web.evaluate(contrastCheck)).map(row => ({ ...row, view })));
    }
    for (const item of browserContrast) assert.ok(item.ratio >= 4.5, `Preview contrast for ${item.selector}: ${item.ratio.toFixed(2)}`);
    await web.setViewportSize({ width: 960, height: 800 });
    assert.ok(await web.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await fs.writeFile(path.join(output, process.argv.includes('--packaged') ? 'verification-packaged.json' : 'verification.json'), JSON.stringify({ passed: true, packaged:process.argv.includes('--packaged'), completedAt: new Date().toISOString(), provider: 'local OpenAI and Gemini mocks only', questionGrouping:{finalizedConstraints:groupedConstraintsReceived,interimBlocksUpload:true,manualSend:true,dismissCancels:true,gapRequiresReview:true,spokenCancel:true,pendingContrast}, overlayMovement:true, resumeReviewAndAiConsent:true, pdfRequests, screenshotPreviewCropAndCancel:true, captureProtection, liveFrames, liveConnections, recoveredAudio: true, liveConfigs, codingRendering: true, transcriptCorrectionAndTextExport: true, persistedAfterReload: true, separateSources: sources, imageRequests, nativeOverlayOpacity: opacity, glassChecks, historyRetainedOnClear: true, calls, contrast, browserContrast, errors }, null, 2));
    console.log('PASS: Windows desktop capture exclusion (workspace and overlay), Gemini Live PCM transcription, Gemini answer streaming, encrypted key, OpenAI compatibility, context, synthetic microphone, PDF import, export, notes UI, all preview views and computed contrast. No paid API calls.');
  } finally {
    await browser?.close();
    await electronApp?.close();
    if (preview) await new Promise(resolve => preview.close(resolve));
    for (const socket of liveServer.clients) socket.terminate(); liveServer.close();
    await new Promise(resolve => mock.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
