const { app, BrowserWindow, ipcMain, safeStorage, desktopCapturer, session, globalShortcut, dialog, screen, powerMonitor } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { DEFAULT_SETTINGS, migrateSettings, validateOverlayPreferences, validateAudioSources, imagePart, boundedText, validateSettings, sanitizeWorkspace, buildMessages, answerPolicy, transcriptText, readAnswerStream, providerError, sessionMarkdown } = require('./core.cjs');
const { ReliableLive } = require('./reliable-live.cjs');
const { LiveSession } = require('./live-session.cjs');
const { captureSize, CaptureLease } = require('./screen-capture.cjs');
const { createStorage } = require('./storage.cjs');
const { fetchWithRetry, retryAfterMs } = require('./http.cjs');
const { overlayPosition, fitWindow } = require('./overlay-layout.cjs');
const { RuntimeGate, ShortcutRegistry } = require('./desktop-runtime.cjs');
const { windowsTimingLease } = require('./audio-timing.cjs');
const { extractDocument, PDF_TRANSCRIPTION_PROMPT } = require('./document-import.cjs');
const { inspectResume } = require('./resume.cjs');
const { credentialBinding, requireDataPolicy, prepareOutbound, personalDataRemoved } = require('./safety.cjs');
const { readBoundedJson, jsonAnswer, redactProviderFailure } = require('./response.cjs');
const os = require('node:os');
const { checkLocalProvider } = require('./local-provider.cjs');
const { retainedWorkspace, encodeWorkspace, decodeWorkspace } = require('./workspace-privacy.cjs');
const { createDiagnostics } = require('./diagnostics.cjs');
const diagnostics = createDiagnostics();
const {failureStatus,sanitizeProviderStatus}=require('./provider-status.cjs');
let workspaceQueue = Promise.resolve();

// Audio processing must retain normal renderer priority when the workspace is
// hidden behind the floating assistant. Disabling timer throttling alone did
// not keep the synthetic processing clock at real time on Windows.
app.commandLine.appendSwitch('disable-renderer-backgrounding');

if (process.env.PARAKEET_USER_DATA) app.setPath('userData', path.resolve(process.env.PARAKEET_USER_DATA));
app.setName('Parakeet Studio');
const profileLock = app.requestSingleInstanceLock();
if (!profileLock) app.exit(0);
app.on('second-instance', showWorkspace);
let mainWindow, overlayWindow;
let overlayRequestedVisible=false,overlayReady=false;
let closeRequested = false, closeAllowed = false, closeTimer;
let positionSaveTimer, displayRecoveryTimer, recoveringWindows=false;
let overlayState = {recovery:{sources:[]},question:'',answer:'',listening:false};
let settings, workspace, overlayPreferences;
let settingsQueue = Promise.resolve();
const liveSession = new LiveSession();
const liveTranscriptions = liveSession.connections;
const requests = new Map();
const transcriptionRequests = new Set();
const captureLease = new CaptureLease();
let displayRevision = 0;
const runtime = new RuntimeGate();
let shortcutRegistry;
let audioTiming;
const rendererRoot = require('node:fs').realpathSync.native(path.resolve(__dirname, '../renderer'));
const mainUrl = pathToFileURL(path.join(rendererRoot, 'index.html')).href;
const overlayUrl = pathToFileURL(path.join(rendererRoot, 'overlay.html')).href;
const matchesPage = (actual, expected) => typeof actual === 'string' && actual.split('#')[0] === expected;
const fileAt = name => path.join(app.getPath('userData'), name);
const recoveryNotices = [];
const storage = createStorage(() => app.getPath('userData'), message => recoveryNotices.push(message));
const readJson = (name, fallback) => storage.read(name, fallback);
const writeJson = (name, value, options) => storage.write(name, value, options);
function persistPrivateWorkspace(value, profile = settings, preservePrevious = true) {
  const operation = workspaceQueue.catch(()=>{}).then(async()=>{
    const encoded = await encodeWorkspace(value,profile,safeStorage);
    await writeJson('workspace.json',encoded,{preservePrevious});
  });
  workspaceQueue=operation;return operation;
}
function redactedSettings() {
  return { ...validateSettings({ ...DEFAULT_SETTINGS, ...settings }), hasApiKey: Boolean(settings.encryptedKey) };
}
async function getKey(profile) {
  if (!profile.encryptedKey) throw new Error('Add your API key in Settings before using AI.');
  if (profile.credentialBinding && profile.credentialBinding !== credentialBinding(profile)) throw new Error('The saved key is bound to a different provider or server. Enter a new key.');
  if (!await safeStorage.isAsyncEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable.');
  try {
    const decrypted = await safeStorage.decryptStringAsync(Buffer.from(profile.encryptedKey, 'base64'));
    return decrypted.result;
  } catch { throw new Error('The saved API key could not be decrypted for this Windows user. Re-enter it in Settings.'); }
}
function safeSend(window, channel, value) {
  if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send(channel, value);
}
function handle(channel, fn, allowOverlay = false) {
  ipcMain.handle(channel, async (event, value) => {
    const isMain = mainWindow && event.sender.id === mainWindow.webContents.id && event.senderFrame === event.sender.mainFrame && matchesPage(event.senderFrame?.url, mainUrl);
    const isOverlay = allowOverlay && overlayWindow && event.sender.id === overlayWindow.webContents.id && event.senderFrame === event.sender.mainFrame && matchesPage(event.senderFrame?.url, overlayUrl);
    if (!isMain && !isOverlay) throw new Error('This operation is unavailable to this window.');
    return fn(value, event);
  });
}
function protectWindow(window) {
  window.setContentProtection(settings.captureProtection !== false);
  window.setSkipTaskbar(settings.captureProtection !== false);
  if (window === overlayWindow) window.setAlwaysOnTop(true, 'pop-up-menu');
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
}
function protectionStatus() {
  const supported = process.platform === 'win32' && Number(os.release().split('.')[2]) >= 19041;
  const windows = [mainWindow, overlayWindow].filter(w => w && !w.isDestroyed());
  return { supported, enabled: settings.captureProtection !== false && windows.every(w => w.isContentProtected()), platform: process.platform };
}
function sendAction(action) { safeSend(mainWindow, 'shortcut', action); }
function showWorkspace() { if(mainWindow&&!mainWindow.isDestroyed()){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();} }
function refreshShortcuts(reset=false) {
  const result=shortcutRegistry?.refresh({reset}) || [];
  safeSend(mainWindow,'shortcuts:changed',result); return result;
}
function publishRuntime() { safeSend(mainWindow,'app:lifecycle',runtime.snapshot()); }
function interruptDesktop(reason) {
  if(!runtime.pause(reason)) return;
  void audioTiming?.stop();
  captureLease.clear();++displayRevision;
  for(const controller of requests.values()) controller.abort();
  for(const controller of transcriptionRequests) controller.abort();
  liveSession.close();
  safeSend(mainWindow,'screen:changed',{});publishRuntime();
}
function recoverWindows() {
  recoveringWindows=true;
  try {
    for(const window of [mainWindow,overlayWindow]) {
      if(!window || window.isDestroyed()) continue;
      const bounds=window.getNormalBounds(),area=screen.getDisplayMatching(bounds).workArea;
      const fitted=fitWindow(bounds,area),overlay=window===overlayWindow;
      window.setMinimumSize(Math.min(overlay?340:960,area.width),Math.min(overlay?300:680,area.height));
      if(Object.keys(fitted).some(key=>fitted[key]!==bounds[key])) window.setBounds(fitted);
      window.setContentProtection(settings.captureProtection!==false);window.setSkipTaskbar(settings.captureProtection!==false);
      if(overlay) window.setAlwaysOnTop(true, 'pop-up-menu');
      if(overlay) {
        if(overlayPreferences.position==='custom') overlayPreferences=validateOverlayPreferences({...overlayPreferences,x:fitted.x,y:fitted.y});
        applyOverlayPreferences(true);
      }
    }
    if(overlayPreferences) void writeJson('overlay.json',overlayPreferences).catch(()=>{});
  } catch {safeSend(mainWindow,'app:lifecycle',{...runtime.snapshot(),warning:'Display layout could not be recovered. Reconnect a display, then retry positioning the assistant.'});}
  finally {recoveringWindows=false;}
}
function overlayPayload() { return { ...overlayState, ...overlayPreferences }; }
function applyOverlayPreferences(move = false) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  // Keep glyphs opaque; the renderer applies alpha to its glass background only.
  overlayWindow.setOpacity(1);
  overlayWindow.setAlwaysOnTop(true, 'pop-up-menu');
  overlayWindow.setIgnoreMouseEvents(overlayPreferences.clickThrough, { forward: true });
  if (move) {
    const bounds = overlayWindow.getBounds();
    const custom = overlayPreferences.position === 'custom' && overlayPreferences.x !== null && overlayPreferences.y !== null;
    const area = (custom ? screen.getDisplayNearestPoint({ x: overlayPreferences.x, y: overlayPreferences.y }) : screen.getDisplayMatching(bounds)).workArea;
    const position = custom ? overlayPosition({ ...bounds, x: overlayPreferences.x, y: overlayPreferences.y }, area, 'restore') : overlayPosition(bounds, area, `${overlayPreferences.vertical}-${overlayPreferences.position}`);
    overlayWindow.setPosition(position.x, position.y);
  }
  safeSend(overlayWindow, 'overlay:state', overlayPayload());
  safeSend(mainWindow, 'overlay:state', overlayPayload());
}
function toggleOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) { createOverlay(); return true; }
  if (overlayWindow.isVisible() || (!overlayReady&&overlayRequestedVisible)) { hideOverlay(); return false; }
  overlayRequestedVisible=true;overlayWindow.show(); return true;
}
function hideOverlay(){overlayRequestedVisible=false;overlayWindow?.hide();}
async function saveOverlayPreferences(value) {
  const next = validateOverlayPreferences({ ...overlayPreferences, ...value });
  await writeJson('overlay.json', next); const move = next.position !== overlayPreferences.position || next.vertical !== overlayPreferences.vertical; overlayPreferences = next;
  applyOverlayPreferences(move); return next;
}
function moveOverlay(action) {
  if (!overlayWindow || overlayWindow.isDestroyed()) createOverlay();
  const bounds = overlayWindow.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const position = overlayPosition(bounds, area, action);
  overlayPreferences = validateOverlayPreferences({ ...overlayPreferences, position: 'custom', ...position });
  overlayWindow.setPosition(position.x, position.y);overlayRequestedVisible=true;overlayWindow.showInactive();
  applyOverlayPreferences();
  clearTimeout(positionSaveTimer);
  positionSaveTimer = setTimeout(() => { void writeJson('overlay.json', overlayPreferences).catch(error => safeSend(mainWindow, 'overlay:error', error.message)); }, 250);
  return { ...position, width: bounds.width, height: bounds.height };
}
function createOverlay() {
  overlayRequestedVisible=true;overlayReady=false;
  const display = screen.getPrimaryDisplay().workArea;
  overlayWindow = new BrowserWindow({
    width: 460, height: 560, minWidth: 340, minHeight: 300,
    x: display.x + display.width - 490, y: display.y + 70,
    title: 'Parakeet Studio - Floating assistant', frame: false, alwaysOnTop: true,
    transparent: true, backgroundColor: '#00000000', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  });
  protectWindow(overlayWindow);
  overlayWindow.on('show',()=>overlayWindow?.setAlwaysOnTop(true, 'pop-up-menu'));
  applyOverlayPreferences(true);
  overlayWindow.once('ready-to-show', () => { overlayReady=true;if(overlayRequestedVisible)overlayWindow.show();safeSend(overlayWindow, 'overlay:state', overlayPayload()); });
  overlayWindow.on('hide',()=>{overlayRequestedVisible=false;});
  overlayWindow.on('closed', () => { overlayWindow = null;overlayReady=false;overlayRequestedVisible=false; });
  overlayWindow.on('moved', () => {
    if(recoveringWindows) return;
    const [x, y] = overlayWindow.getPosition();
    overlayPreferences = validateOverlayPreferences({ ...overlayPreferences, position: 'custom', x, y });
    applyOverlayPreferences(); clearTimeout(positionSaveTimer);
    positionSaveTimer = setTimeout(() => { void writeJson('overlay.json', overlayPreferences).catch(() => {}); }, 250);
  });
  overlayWindow.loadFile(path.join(rendererRoot, 'overlay.html'));
}

function registerHandlers() {
  handle('app:runtime',()=>runtime.snapshot());
  handle('app:info',()=>({version:app.getVersion(),workspace:{visible:mainWindow.isVisible(),minimized:mainWindow.isMinimized()}}));
  handle('app:lifecycle-ready',input=>{runtime.acknowledge(input?.epoch);publishRuntime();return runtime.snapshot();});
  handle('shortcuts:get',()=>shortcutRegistry?.status() || []);
  handle('shortcuts:retry',()=>{runtime.begin();return refreshShortcuts();});
  handle('app:close-ready', () => { closeAllowed = true; clearTimeout(closeTimer); mainWindow?.close(); return { ok: true }; });
  handle('settings:get', () => redactedSettings());
  const saveSettings = async value => {
    if (liveSession.busy) throw new Error('Stop listening before changing your provider settings.');
    const next = { ...validateSettings(value), encryptedKey: settings.encryptedKey };
    if (credentialBinding(next) !== credentialBinding(settings)) delete next.encryptedKey;
    next.credentialBinding = credentialBinding(next);
    if (value.apiKey !== undefined) {
      const key = boundedText(value.apiKey, 4000).trim();
      if (key) {
        if (!await safeStorage.isAsyncEncryptionAvailable()) throw new Error('Windows credential encryption is unavailable. The key was not saved.');
        next.encryptedKey = (await safeStorage.encryptStringAsync(key)).toString('base64');
      } else delete next.encryptedKey;
    }
    const privacyChanged = next.historyMode !== settings.historyMode || next.retentionDays !== settings.retentionDays || next.encryptWorkspace !== settings.encryptWorkspace;
    if (privacyChanged) {
      if(requests.size || transcriptionRequests.size)throw new Error('Finish active AI requests before changing local-data settings.');
      await persistPrivateWorkspace(workspace,next,false);
    }
    try { await writeJson('settings.json', next, { preservePrevious: false }); }
    catch(error) { if(privacyChanged)await persistPrivateWorkspace(workspace,settings,false);throw error; }
    settings = next;
    for (const window of [mainWindow, overlayWindow]) if (window && !window.isDestroyed()) { window.setContentProtection(next.captureProtection); window.setSkipTaskbar(next.captureProtection); if(window===overlayWindow)window.setAlwaysOnTop(true, 'pop-up-menu'); }
    return redactedSettings();
  };
  handle('settings:save', value => { const operation = settingsQueue.catch(() => {}).then(() => saveSettings(value)); settingsQueue = operation; return operation; });
  handle('protection:get', () => protectionStatus(), true);
  handle('live:start', async input => {
    const operation=runtime.begin();
    if (settings.provider !== 'gemini') throw new Error('Gemini Live requires the Google Gemini provider.');
    const sources = validateAudioSources(input?.sources);
    const profile = Object.freeze({ ...settings, ...(settings.dataPolicy === 'unpaid' ? {transcriptionVocabulary:DEFAULT_SETTINGS.transcriptionVocabulary} : {}) }); requireDataPolicy(profile, 'audio');
    return liveSession.start(sources, async () => {
    if (profile.dataPolicy === 'unpaid') {
      const consent = await dialog.showMessageBox(mainWindow, { type:'question', title:'Non-personal practice audio only', message:'This audio goes to an unpaid cloud service. Use only non-personal, non-confidential practice material.', detail:'Do not use this route for private interviews or confidential meeting audio. Select a permitted provider/data arrangement in Settings for that material.', buttons:['Cancel','Start non-personal practice'], defaultId:0, cancelId:0 });
      if(consent.response !== 1) throw new Error('Audio upload cancelled.');
    }
    const key=await getKey(profile);runtime.assert(operation);return key;
    }, (source, key) => {
        const connection = new ReliableLive({ settings: profile, key,
          onTranscript: value => safeSend(mainWindow, 'live:transcript', { ...value, source }),
          onInterim: value => safeSend(mainWindow, 'live:interim', { ...value, source }),
          onStatus: value => safeSend(mainWindow, 'live:status', { ...value, source }),
          onError: message => safeSend(mainWindow, 'live:error', { message, source }),
        });
        return connection;
    });
  });
  handle('live:audio', input => { runtime.begin();const connection = liveTranscriptions.get(input?.source || 'microphone'); if (!connection) throw new Error('Live transcription source is not connected.'); connection.send(input?.audio); return { ok: true }; });
  handle('live:end-audio', input => { for (const [source, connection] of liveTranscriptions) if (!input?.source || input.source === source) connection.endAudio(); return { ok: true }; });
  handle('live:stop', () => liveSession.stop());
  handle('diagnostics:add', value => diagnostics.add(value));
  handle('diagnostics:clear', () => { diagnostics.clear();return {ok:true}; });
  handle('diagnostics:export', async () => {
    const target = await dialog.showSaveDialog(mainWindow,{title:'Export content-free diagnostics',defaultPath:'Parakeet-diagnostics.json',filters:[{name:'JSON',extensions:['json']}]});
    if(target.canceled)return {cancelled:true};
    await fs.writeFile(target.filePath,JSON.stringify(diagnostics.report(),null,2),'utf8');return {ok:true};
  });
  handle('workspace:get', () => workspace);
  handle('storage:status', () => ({ recoveryNotices, directory: app.getPath('userData') }));
  handle('workspace:save', async value => {
    await settingsQueue;
    const next = sanitizeWorkspace(value);
    const removed = personalDataRemoved(workspace, next);
    await persistPrivateWorkspace(next,settings,!removed && settings.historyMode !== 'ephemeral' && !settings.retentionDays); workspace = next;
    return { ok: true };
  });
  handle('provider:transcribe', async input => {
    const operation=runtime.begin();
    if (settings.provider === 'gemini') throw new Error('Use the Gemini Live capture connection for streaming transcription.');
    if (transcriptionRequests.size >= 2) throw new Error('Transcription is busy. Wait for the current audio segments.');
    if (!(input?.audio instanceof ArrayBuffer) || input.audio.byteLength > 24 * 1024 * 1024 || input.audio.byteLength < 44) throw new Error('Audio must be a WAV segment smaller than 24 MB.');
    if (input.mimeType !== 'audio/wav') throw new Error('Unsupported audio format.');
    const profile = Object.freeze({ ...settings, ...(settings.dataPolicy === 'unpaid' ? {transcriptionVocabulary:DEFAULT_SETTINGS.transcriptionVocabulary} : {}) }); requireDataPolicy(profile, 'audio');
    const controller = new AbortController();
    transcriptionRequests.add(controller);
    const timeout = setTimeout(() => controller.abort(), 60000);
    let key='';
    try {
      key = await getKey(profile);
      runtime.assert(operation);controller.signal.throwIfAborted();
      const form = new FormData();
      form.append('file', new Blob([input.audio], { type: 'audio/wav' }), 'segment.wav');
      form.append('model', profile.transcriptionModel);
      if (profile.transcriptionLanguage) form.append('language', profile.transcriptionLanguage.split('-')[0]);
      if (profile.transcriptionVocabulary?.length) form.append('prompt', `Technical vocabulary: ${profile.transcriptionVocabulary.join(', ')}`);
      if (input.language && /^[a-z]{2}$/.test(input.language)) form.append('language', input.language);
      const response = await fetchWithRetry(`${profile.baseUrl}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal: controller.signal, redirect: 'error' });
      if (!response.ok) throw await providerError(response, key);
      const result = await readBoundedJson(response);
      runtime.assert(operation);
      if (typeof result.text !== 'string') throw new Error('The transcription provider returned no text.');
      return { text: boundedText(result.text, 16000).trim(), source: input.source === 'system' ? 'system' : 'microphone' };
    } catch(error) { throw redactProviderFailure(error,key); } finally { clearTimeout(timeout); transcriptionRequests.delete(controller); }
  });
  handle('provider:generate', async input => {
    const operation=runtime.begin();
    const requestId = boundedText(input?.requestId, 100);
    if (!/^[\w-]{1,100}$/.test(requestId)) throw new Error('Invalid answer request.');
    if (requests.has(requestId)) throw new Error('An answer with this request ID is already running.');
    if (requests.size >= 2) throw new Error('An answer is already running. Stop it before starting another.');
    const providerSettings = Object.freeze({ ...settings });
    const enriched = { ...prepareOutbound(input, providerSettings), currentDate: new Date().toISOString().slice(0, 10), screenAnalysis: Boolean(input.imageDataUrl), answerMode: settings.answerMode, codingLanguage: settings.codingLanguage };
    const messages = buildMessages(enriched);
    const policy = answerPolicy(enriched);
    const screenshotPart = imagePart(input.imageDataUrl, providerSettings.provider);
    if (screenshotPart) captureLease.assert(input.captureId, displayRevision);
    const controller = new AbortController();
    requests.set(requestId, controller);
    const timeout = setTimeout(() => controller.abort(), policy.thinkingLevel === 'HIGH' ? 150000 : 90000);
    const startedAt = Date.now(); let firstTokenMs = null; let retries = 0;let key='';
    const emit = delta => { runtime.assert(operation);if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt; safeSend(mainWindow, 'answer:delta', { requestId, delta }); };
    try {
      key = await getKey(providerSettings);
      runtime.assert(operation);controller.signal.throwIfAborted();
      if (screenshotPart) captureLease.assert(input.captureId, displayRevision);
      const gemini = providerSettings.provider === 'gemini';
      const url = gemini ? `${providerSettings.baseUrl}/models/${encodeURIComponent(providerSettings.model)}:streamGenerateContent?alt=sse` : `${providerSettings.baseUrl}/chat/completions`;
      const body = gemini ? {
        systemInstruction: { parts: [{ text: messages[0].content }] },
        contents: [{ role: 'user', parts: [{ text: messages[1].content }, ...(screenshotPart ? [screenshotPart] : [])] }],
        generationConfig: { maxOutputTokens: policy.maxOutputTokens, ...(/^gemini-[3-9]/.test(providerSettings.model) ? { thinkingConfig: { thinkingLevel: policy.thinkingLevel } } : {}) },
      } : { model: providerSettings.model, messages: screenshotPart ? [messages[0], { role: 'user', content: [{ type: 'text', text: messages[1].content }, screenshotPart] }] : messages, stream: true };
      safeSend(mainWindow,'provider:status',{requestId,state:'requesting',retryAfterMs:0});
      const response = await fetchWithRetry(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(gemini ? { 'x-goog-api-key': key } : { Authorization: `Bearer ${key}` }) },
        body: JSON.stringify(body), signal: controller.signal, redirect: 'error',
      }, { onRetry: ({delayMs}) => { retries++;safeSend(mainWindow,'provider:status',{requestId,...sanitizeProviderStatus({state:'retrying',retryAfterMs:delayMs})}); } });
      if (!response.ok){const error=await providerError(response,key);if(response.status===429)error.retryAfterMs=Math.min(300000,retryAfterMs(response.headers.get('retry-after'))??30000);throw error;}
      let text;
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        text = await readAnswerStream(response.body, emit, providerSettings.provider);
      } else {
        text = jsonAnswer(await readBoundedJson(response), providerSettings.provider, emit);
      }
      if (!text?.trim()) throw new Error('The provider returned an empty answer. Check that the model supports text chat.');
      runtime.assert(operation);
      safeSend(mainWindow,'provider:status',{requestId,state:'complete',retryAfterMs:0});
      return { text, metrics: { firstTokenMs, totalMs: Date.now() - startedAt, retries, thinkingLevel: policy.thinkingLevel } };
    } catch(error) {safeSend(mainWindow,'provider:status',{requestId,...failureStatus(error)});throw redactProviderFailure(error,key); } finally { clearTimeout(timeout); requests.delete(requestId); }
  });
  handle('provider:local-check',async()=>{
    const operation=runtime.begin(),profile=Object.freeze({...settings});requireDataPolicy(profile);
    if(profile.provider!=='openai'||profile.dataPolicy!=='local')throw new Error('Save an OpenAI-compatible loopback provider in Local server mode before this check.');
    if(transcriptionRequests.size>=2)throw new Error('Wait for active transcription before checking the local server.');
    const controller=new AbortController();transcriptionRequests.add(controller);const timer=setTimeout(()=>controller.abort(),5000);let key='';
    try{if(profile.encryptedKey)key=await getKey(profile);runtime.assert(operation);controller.signal.throwIfAborted();const result=await checkLocalProvider(profile,key,{signal:controller.signal});runtime.assert(operation);return result;}
    catch(error){throw redactProviderFailure(error,key);}finally{clearTimeout(timer);transcriptionRequests.delete(controller);}
  });
  handle('provider:preview', input => { const profile = Object.freeze({ ...settings }); const safe = prepareOutbound(input || {}, profile); return { origin:new URL(profile.baseUrl).origin, dataPolicy:profile.dataPolicy, messages:buildMessages(safe), imageIncluded:Boolean(input?.imageDataUrl) }; });
  handle('provider:cancel', input => { requests.get(input?.requestId)?.abort(); return { ok: true }; });
  handle('overlay:toggle', () => toggleOverlay());
  handle('overlay:move', input => moveOverlay(input?.action), true);
  handle('overlay:preferences:get', () => overlayPreferences, true);
  handle('overlay:preferences:set', value => saveOverlayPreferences(value), true);
  handle('overlay:set', value => {
    void audioTiming?.setActive(Boolean(value?.listening) && !runtime.blocked);
    overlayState = { recovery: {canCancel:Boolean(value?.recovery?.canCancel),retryLabel:value?.recovery?.retryLabel==='Capture again'?'Capture again':'Retry answer',status:boundedText(value?.recovery?.status,140),wait:Math.min(300,Math.max(0,Number(value?.recovery?.wait)||0)),retry:Boolean(value?.recovery?.retry),needsSettings:Boolean(value?.recovery?.needsSettings),hasError:Boolean(value?.recovery?.hasError),sources:Array.isArray(value?.recovery?.sources)?value.recovery.sources.slice(0,2).map(source=>({label:source?.name==='system'?'Call audio':'Microphone',state:['off','active','quiet','reconnecting','review'].includes(source?.state)?source.state:'off'})):[]}, question: boundedText(value?.question, 12000), answer: boundedText(value?.answer, 200000), pendingQuestion:boundedText(value?.pendingQuestion,4000),pendingStatus:boundedText(value?.pendingStatus,240),pendingCanSend:Boolean(value?.pendingCanSend),pendingHeld:Boolean(value?.pendingHeld), listening: Boolean(value?.listening), generating: Boolean(value?.generating), answerIndex: Math.max(0, Math.min(10000, Number(value?.answerIndex) || 0)), answerCount: Math.max(0, Math.min(10000, Number(value?.answerCount) || 0)) };
    safeSend(overlayWindow, 'overlay:state', overlayPayload());
    return { ok: true };
  });
  handle('overlay:get', () => overlayPayload(), true);
  handle('overlay:action', action => {
    if (action === 'close-overlay') overlayWindow?.close();
    else if (action === 'hide-overlay') hideOverlay();
    else if (['scroll-up', 'scroll-down'].includes(action)) safeSend(overlayWindow, 'overlay:command', action);
    else if (['answer', 'cancel-answer', 'dismiss-question', 'hold-question', 'toggle-listening', 'previous-answer', 'next-answer', 'screenshot-answer', 'retry-answer', 'open-settings'].includes(action)) sendAction(action);
    return { ok: true };
  }, true);
  handle('screen:list', () => screen.getAllDisplays().map((display, index) => ({ id: String(display.id), name: display.label || `Display ${index + 1}`, primary: display.id === screen.getPrimaryDisplay().id, ...captureSize(display), scaleFactor: display.scaleFactor })));
  handle('screen:validate', input => captureLease.assert(input?.captureId, displayRevision));
  handle('screen:capture', async input => {
    const operation=runtime.begin();
    captureLease.clear();
    const revision = displayRevision;
    const displayId = input?.displayId || String(screen.getPrimaryDisplay().id);
    const display = screen.getAllDisplays().find(d => String(d.id) === displayId);
    if (!display) throw new Error('The selected display is no longer available. Reopen screen analysis.');
    const target = captureSize(display);
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: target });
    runtime.assert(operation);
    if (revision !== displayRevision) throw new Error('Display configuration changed during capture. Refresh the screenshot.');
    const source = sources.find(s => s.display_id === displayId);
    if (!source || source.thumbnail.isEmpty()) throw new Error('No desktop screenshot is available. Check Windows capture permissions.');
    let thumbnail = source.thumbnail;
    const size = thumbnail.getSize(), scale = Math.min(1, target.width / size.width, target.height / size.height);
    if (scale < 1) thumbnail = thumbnail.resize({ width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)), quality: 'best' });
    let bytes = thumbnail.toJPEG(90);
    if (bytes.length > 4.5 * 1024 * 1024) bytes = thumbnail.toJPEG(70);
    if (bytes.length > 4.5 * 1024 * 1024) throw new Error('Screenshot is too large to send. Reduce display resolution and try again.');
    return { dataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}`, displayName: display.label || source.name, ...thumbnail.getSize(), ...captureLease.issue(displayId, revision) };
  });
  handle('window:control', (action, event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (action === 'minimize') window.minimize();
    if (action === 'close') window.close();
    if (action === 'show') { window.show(); window.focus(); }
  }, true);
  let documentImportBusy = false;
  handle('document:import', async input => {
    const operation=runtime.begin();
    if (documentImportBusy) throw new Error('A document import is already running.');
    documentImportBusy = true;
    try {
      const ai = input?.mode === 'ai';
      const provider = Object.freeze({ ...settings });
      if(ai) requireDataPolicy(provider, 'pdf');
      if (ai && settings.provider !== 'gemini') throw new Error('AI PDF import requires a configured Gemini provider. Local import works with either provider.');
      const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Resume and notes', extensions: ai ? ['pdf'] : ['txt', 'md', 'pdf'] }] });
      runtime.assert(operation);
      if (result.canceled || !result.filePaths[0]) return null;
      const filename = result.filePaths[0];
      const isPdf = path.extname(filename).toLowerCase() === '.pdf';
      if (ai && !isPdf) throw new Error('Choose a PDF for AI import.');
      const stat = await fs.stat(filename);
      if (stat.size > 10 * 1024 * 1024) throw new Error('Choose a document smaller than 10 MB.');
      const bytes = await fs.readFile(filename);
      if (bytes.length > 10 * 1024 * 1024) throw new Error('Choose a document smaller than 10 MB.');
      let extracted = await extractDocument(bytes, isPdf);
      runtime.assert(operation);
      if (ai) {
        const consent = await dialog.showMessageBox(mainWindow, { type: 'question', title: 'Send PDF to Gemini?', message: `Send ${path.basename(filename)} to your configured Gemini model for text extraction?`, detail: 'The entire PDF, including contact details, will leave this device. Extraction may be inaccurate. Review the result before applying. Normal Import document stays local.', buttons: ['Cancel', 'Send PDF'], defaultId: 0, cancelId: 0 });
        runtime.assert(operation);
        if (consent.response !== 1) return null;
        const key = await getKey(provider);
        runtime.assert(operation);
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 120000);
        transcriptionRequests.add(controller);
        try {
          const response = await fetchWithRetry(`${provider.baseUrl}/models/${encodeURIComponent(provider.model)}:generateContent`, { method: 'POST', redirect: 'error', signal: controller.signal, headers: { 'Content-Type':'application/json', 'x-goog-api-key':key }, body:JSON.stringify({ systemInstruction:{parts:[{text:PDF_TRANSCRIPTION_PROMPT}]}, contents:[{role:'user',parts:[{inlineData:{mimeType:'application/pdf',data:bytes.toString('base64')}},{text:'Extract the resume text faithfully.'}]}], generationConfig:{maxOutputTokens:16384,...(/^gemini-[3-9]/.test(provider.model)?{thinkingConfig:{thinkingLevel:'LOW'}}:{})} }) });
          if (!response.ok) throw await providerError(response, key);
          const payload = await readBoundedJson(response), candidate = payload.candidates?.[0];
          if (candidate?.finishReason !== 'STOP') throw new Error(`PDF extraction did not complete (${candidate?.finishReason || payload.promptFeedback?.blockReason || 'no result'}). Try local import or a shorter PDF.`);
          const text = (candidate.content?.parts || []).filter(p=>!p.thought).map(p=>p.text || '').join('');
          extracted = { ...inspectResume(text), pages: extracted.pages };
          extracted.warnings.unshift('AI extraction: check all names, dates, numbers and reading order against your PDF.');
        } finally { clearTimeout(timer); transcriptionRequests.delete(controller); }
      }
      if (!extracted.text.trim()) throw new Error('No selectable text found. Use AI PDF import for a scan, or paste your resume text.');
      runtime.assert(operation);
      return { name:path.basename(filename), ...extracted, method: ai ? 'Gemini PDF extraction' : 'Local text extraction' };
    } finally { documentImportBusy = false; }
  });
  handle('session:export', async value => {
    const title = (boundedText(value?.title, 100) || 'Interview session').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-');
    const transcriptOnly = value?.format === 'txt';
    const extension = transcriptOnly ? 'txt' : 'md';
    const result = await dialog.showSaveDialog(mainWindow, { defaultPath: `${title}.${extension}`, filters: [{ name: transcriptOnly ? 'Transcript text' : 'Markdown', extensions: [extension] }] });
    if (result.canceled || !result.filePath) return { saved: false };
    await fs.writeFile(result.filePath, transcriptOnly ? transcriptText(value) : sessionMarkdown(value), 'utf8');
    return { saved: true };
  });
}

if(profileLock) app.whenReady().then(async () => {
  const invalidateCapture = () => { ++displayRevision; captureLease.clear(); safeSend(mainWindow, 'screen:changed', {});clearTimeout(displayRecoveryTimer);displayRecoveryTimer=setTimeout(recoverWindows,150); };
  for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(event, invalidateCapture);
  powerMonitor.on('suspend',()=>interruptDesktop('suspend'));
  powerMonitor.on('lock-screen',()=>interruptDesktop('lock'));
  const returned=reason=>{runtime.resume(reason);recoverWindows();refreshShortcuts(true);publishRuntime();};
  powerMonitor.on('resume',()=>returned('suspend'));
  powerMonitor.on('unlock-screen',()=>returned('lock'));
  settings = migrateSettings(await readJson('settings.json', {}));
  validateSettings(settings);
  workspace = settings.historyMode === 'ephemeral' ? sanitizeWorkspace({}) : retainedWorkspace(await decodeWorkspace(await readJson('workspace.json', {}),safeStorage),settings);
  if(settings.historyMode === 'ephemeral' || settings.retentionDays || settings.encryptWorkspace) await persistPrivateWorkspace(workspace,settings,false);
  overlayPreferences = validateOverlayPreferences(await readJson('overlay.json', {}));
  audioTiming=windowsTimingLease({app,warn:message=>safeSend(mainWindow,'audio:timing-status',{message})});
  mainWindow = new BrowserWindow({
    width: 1440, height: 940, minWidth: 960, minHeight: 680, title: 'Parakeet Studio',
    backgroundColor: '#f7f8f4', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, backgroundThrottling: false },
  });
  protectWindow(mainWindow);
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => webContents?.id === mainWindow?.webContents.id && matchesPage(webContents.getURL(), mainUrl) && ['media', 'display-capture'].includes(permission));
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => callback(webContents.id === mainWindow?.webContents.id && matchesPage(webContents.getURL(), mainUrl) && ['media', 'display-capture'].includes(permission)));
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (request.frame !== mainWindow?.webContents.mainFrame || !matchesPage(request.frame?.url, mainUrl)) { callback(null); return; }
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
      if (!sources[0]) { callback(null); return; }
      callback({ video: sources[0], audio: 'loopback' });
    } catch { callback(null); }
  });
  registerHandlers();
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', event => {
    if (closeAllowed || mainWindow.webContents.isDestroyed()) return;
    event.preventDefault();
    if (closeRequested) return;
    closeRequested = true; safeSend(mainWindow, 'app:prepare-close');
    closeTimer = setTimeout(() => { closeAllowed = true; mainWindow?.close(); }, 8000);
  });
  mainWindow.on('closed', () => { mainWindow = null; app.quit(); });
  mainWindow.webContents.on('render-process-gone', () => { void audioTiming?.stop();runtime.invalidate();captureLease.clear();for (const controller of requests.values()) controller.abort(); for (const controller of transcriptionRequests) controller.abort(); liveSession.close(); });
  await mainWindow.loadFile(path.join(rendererRoot, 'index.html'));
  const entries=[];
  const add=(id,label,accelerator,run)=>entries.push({id,label,accelerator,run});
  add('answer','Draft answer','CommandOrControl+Shift+Space',()=>sendAction('answer'));
  add('listen','Toggle listening','CommandOrControl+Shift+L',()=>sendAction('toggle-listening'));
  add('overlay','Show / close copilot','CommandOrControl+Shift+O',()=>toggleOverlay());
  add('workspace','Show workspace','CommandOrControl+Shift+M',showWorkspace);
  add('mouse','Restore mouse input','CommandOrControl+Shift+P',()=>{void saveOverlayPreferences({clickThrough:!overlayPreferences.clickThrough}).catch(error=>dialog.showErrorBox('Could not update floating copilot',error.message));});
  add('hide','Hide copilot','CommandOrControl+Shift+H',hideOverlay);
  add('screenshot','Answer screenshot','CommandOrControl+Alt+Enter',()=>sendAction('screenshot-answer'));
  for(const direction of ['Left','Right','Up','Down']) add(`move-${direction.toLowerCase()}`,`Move ${direction.toLowerCase()}`,`CommandOrControl+Shift+${direction}`,()=>moveOverlay(direction.toLowerCase()));
  add('center','Center copilot','CommandOrControl+Shift+Home',()=>moveOverlay('middle-center'));
  add('previous','Previous answer','CommandOrControl+Alt+Left',()=>sendAction('previous-answer'));
  add('next','Next answer','CommandOrControl+Alt+Right',()=>sendAction('next-answer'));
  add('scroll-up','Scroll answer up','CommandOrControl+Alt+Up',()=>safeSend(overlayWindow,'overlay:command','scroll-up'));
  add('scroll-down','Scroll answer down','CommandOrControl+Alt+Down',()=>safeSend(overlayWindow,'overlay:command','scroll-down'));
  shortcutRegistry=new ShortcutRegistry(globalShortcut,entries);refreshShortcuts();recoverWindows();
}).catch(error => { dialog.showErrorBox('Parakeet Studio could not start', error.message); app.quit(); });
app.on('window-all-closed', () => app.quit());
let drainedBeforeQuit = false;
app.on('before-quit', event => {
  if (drainedBeforeQuit) return;
  event.preventDefault(); drainedBeforeQuit = true;
  clearTimeout(positionSaveTimer);
  clearTimeout(displayRecoveryTimer);
  if (overlayPreferences) void writeJson('overlay.json', overlayPreferences).catch(() => {});
  settingsQueue.catch(()=>{}).then(()=>workspaceQueue).then(()=>audioTiming?.stop()).then(()=>storage.drain()).catch(() => {}).finally(() => app.quit());
});
app.on('will-quit', () => { globalShortcut.unregisterAll(); liveSession.close(); for (const controller of requests.values()) controller.abort(); for (const controller of transcriptionRequests) controller.abort(); });
