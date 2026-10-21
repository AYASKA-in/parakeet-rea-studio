import {AudioActivity} from './audio-activity.js';
import {hasUsefulText,recoveryView} from './recovery-state.js';
import { renderAnswerText } from './answer-format.js';
import { reviewScreenshot, captureScreenshotAnswer } from './screen-analysis.js';
import { QuestionQueue, acceptQuestionSource } from './question-queue.js';
import { createAttemptTiming } from './attempt-timing.js';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const bridge = window.copilot;
const desktop = Boolean(bridge?.isDesktop);
const STORAGE_KEY = 'parakeet-studio-workspace-v1';
const emptyContext = () => ({ role: '', company: '', resume: '', jobDescription: '', notes: '' });
const state = {
  context: emptyContext(), sessions: [], active: null, view: 'workspace', style: 'concise',
  settings: { provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-3.5-flash-lite', transcriptionModel: 'gemini-3.5-transcribe-live', captureProtection: true, hasApiKey: false },
  listening: false, starting: false, capture: null, pendingTranscriptions: 0, requestId: null, notesRequestId: null,
  answerIndex: -1, screenshotPending: false, overlayPreferences: { opacity: 0.35, clickThrough: false, position: 'right' }, currentAnswer: '', currentQuestion: '', answerError: '', overlay: false, listeningStartedAt: 0, liveCleanup: [], livePCMPending: 0, stopping: false,
  interims: {}, liveStates: {}, levels:{}, providerStatus:{},
  desktopPaused:false,desktopEpoch:0,screenAbort:null,
};
const paths = {
  workspace: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M9 9h12"/>',
  context: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  history: '<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6M12 7v5l3 2"/>',
  settings: '<path d="m9 4 1-2h4l1 2 2 1 2-.1 2 3-1 2v3l1 2-2 3h-2l-2 1-1 3h-4l-1-3-2-1H5l-2-3 1-2v-3L3 8l2-3h2Z"/><circle cx="12" cy="12" r="3"/>',
  sparkles: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4M18 4h4"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  minus: '<path d="M5 12h14"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
  headphones: '<path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="12" width="4" height="8" rx="2"/><rect x="17" y="12" width="4" height="8" rx="2"/>',
  edit: '<path d="m16 3 5 5L9 20l-6 1 1-6Z"/><path d="m14 5 5 5"/>',
  waveform: '<path d="M3 10v4M7 6v12M12 3v18M17 7v10M21 10v4"/>',
  'arrow-right': '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  'arrow-up-right': '<path d="M6 18 18 6M6 6h12v12"/>',
  mic: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  overlay: '<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="11" y="11" width="8" height="7" rx="1"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>', leaf: '<path d="M20 3C9 2 3 7 4 14c1 8 16 10 16-11ZM4 21 16 8M9 16h8"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.sparkles}</svg>`;
function hydrateIcons(root = document) { $$('[data-icon]', root).forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
function escape(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clone = value => JSON.parse(JSON.stringify(value));
function message(error) { return (error?.message || String(error || 'Something went wrong. Please try again.')).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, ''); }
let toastTimer, contextTimer, answerPaintTimer, overlaySyncTimer, pendingWorkspace, workspaceLoaded = false, persistenceBusy = false, persistence = Promise.resolve();
let autoAnswerTimer, lastAnswerStartedAt = -Infinity;
let captureStopPromise, desktopStopSequence=Promise.resolve(), handledLifecycleEpoch=-1, audioEpoch=0;
const questionQueue = new QuestionQueue();
const audioActivity=new AudioActivity();
const sourceLabel = source => ({ microphone: 'You', system: 'Call audio', sample: 'Sample question', manual: 'Your question', status: 'Connection event' }[source] || 'Conversation');
function transcriptText(session) { return session.transcript.map(segment => `${sourceLabel(segment.source)}: ${segment.text}`).join('\n'); }
function clearAutoAnswer() { clearTimeout(autoAnswerTimer); questionQueue.clear(); renderPendingQuestion(); }
function renderPendingQuestion(status = questionQueue.status({sessionId:state.active?.id,mode:state.settings.answerMode,lastStartedAt:lastAnswerStartedAt})) {
  const pending = questionQueue.pending, panel = $('#pending-question');
  panel.hidden = !pending || pending.sessionId !== state.active?.id;
  syncOverlay();
  if (panel.hidden) return;
  const reasons = { waiting:'Waiting for a short pause before drafting.', ready:'Ready to draft.', interim:'Waiting for speech recognition to finish.', held:'Question paused. Continue speaking, or send the visible text now.', unfinished:'The question appears unfinished. Add the remaining constraint, or send it now.', overflow:'Question exceeds the automatic draft budget. Use the full transcript to write a shorter question.', expired:'This question has been waiting for 45 seconds. Review it before sending.', review:'Audio was interrupted. Review the transcript before sending.' };
  const busy = state.requestId || state.screenshotPending;
  const unavailable = !state.settings.hasApiKey || !['unpaid','reviewed','local'].includes(state.settings.dataPolicy);
  $('#pending-question-hold').textContent = pending.userHeld ? 'Resume auto draft' : 'Hold';
  const statusText = unavailable ? 'Configure your provider and data-use mode before drafting.' : busy ? 'Waiting for the current answer or screen review to finish.' : pending.correction && status.reason === 'review' ? 'Question corrected after an answer started. Review the revised constraints, then send when ready.' : reasons[status.reason] || 'Review the pending question.';
  if ($('#pending-question-text').textContent !== pending.text) $('#pending-question-text').textContent = pending.text;
  if ($('#pending-question-status').textContent !== statusText) $('#pending-question-status').textContent = statusText;
  $('#pending-question-send').disabled = Boolean(busy || status.reason === 'overflow' || status.reason === 'interim');
}
function runPendingAutoAnswer() {
  clearTimeout(autoAnswerTimer);
  const status = questionQueue.status({sessionId:state.active?.id,mode:state.settings.answerMode,lastStartedAt:lastAnswerStartedAt});
  renderPendingQuestion(status);
  if (!questionQueue.pending || !$('#auto-answer').checked || state.stopping || state.desktopPaused || questionQueue.pending.sessionId !== state.active?.id || state.requestId || state.screenshotPending) return;
  if (!state.settings.hasApiKey || !['unpaid','reviewed','local'].includes(state.settings.dataPolicy)) return;
  if (status.reason === 'waiting') autoAnswerTimer = setTimeout(runPendingAutoAnswer, Math.max(20,status.delay));
  else if (status.reason === 'ready') { const pending = questionQueue.take(); renderPendingQuestion(); void generateAnswer({ question:pending.text,automatic:true,timing:pending }); }
}
function scheduleAutoAnswer(text, source = 'audio') {
  if (state.stopping || state.desktopPaused || !$('#auto-answer').checked || !text || !acceptQuestionSource($('#audio-source').value,source)) return;
  const accepted=questionQueue.push(text,source,state.active?.id);
  if(accepted && questionQueue.pending?.correction && state.requestId && state.activeQuestionRevision===questionQueue.pending.supersedesRevision && state.attemptMetric?.outcome!=='cancelled') void cancelGeneration();
  runPendingAutoAnswer();
}
function togglePendingHold() {
  const pending=questionQueue.pending;
  if(pending && questionQueue.setHeld(!pending.userHeld,state.active?.id))runPendingAutoAnswer();
}
function sendPendingQuestion() {
  if (!questionQueue.pending || questionQueue.pending.sessionId !== state.active?.id) return false;
  if (state.requestId || state.screenshotPending || state.stopping || !requireAI()) return true;
  const status=questionQueue.status({sessionId:state.active?.id});
  if (['empty','overflow','interim'].includes(status.reason)) { toast('Wait for finalized speech, or use a shorter question from the transcript.'); return true; }
  const pending=questionQueue.take(); clearTimeout(autoAnswerTimer); renderPendingQuestion();
  void generateAnswer({question:pending.text,automatic:true,timing:pending});
  return true;
}
async function refreshMicrophones() {
  const select = $('#microphone-device'), selected = select.value;
  try {
    const devices = await navigator.mediaDevices?.enumerateDevices() || [];
    select.innerHTML = '<option value="">Windows default microphone</option>';
    devices.filter(device => device.kind === 'audioinput' && device.deviceId && device.deviceId !== 'default').forEach((device, index) => {
      const option = document.createElement('option'); option.value = device.deviceId; option.textContent = device.label || `Microphone ${index + 1}`; select.append(option);
    });
    if ([...select.options].some(option => option.value === selected)) select.value = selected;
    $('#microphone-help').textContent = 'Device names become available after microphone access. Refresh after connecting a device.';
  } catch (error) { $('#microphone-help').textContent = `Could not list microphones: ${message(error)}. Windows default remains available.`; }
}
function renderOverlayPreferences() {
  $('#overlay-opacity').value = Math.round(state.overlayPreferences.opacity * 100);
  $('#overlay-opacity-value').textContent = `${Math.round(state.overlayPreferences.opacity * 100)}%`;
  $('#overlay-passthrough').checked = state.overlayPreferences.clickThrough;
  $('#overlay-position').value = state.overlayPreferences.position;
  $('#overlay-vertical').value = state.overlayPreferences.vertical || 'top';
}
async function saveOverlayPreferences(change) {
  if (!bridge?.setOverlayPreferences) { toast('Overlay controls need the desktop app.'); return; }
  try { state.overlayPreferences = await bridge.setOverlayPreferences(change); renderOverlayPreferences(); }
  catch (error) { toast(message(error), true); }
}
function browseAnswer(direction) {
  if (state.requestId || state.screenshotPending) return;
  const exchanges = state.active?.exchanges || [];
  if (!exchanges.length) return;
  const current = state.answerIndex < 0 ? exchanges.length - 1 : state.answerIndex;
  state.answerIndex = Math.max(0, Math.min(exchanges.length - 1, current + direction));
  state.currentQuestion = exchanges[state.answerIndex].question; state.currentAnswer = exchanges[state.answerIndex].answer; state.answerError = exchanges[state.answerIndex].error || (exchanges[state.answerIndex].status === 'streaming' ? 'This draft was interrupted before completion.' : '');
  renderAnswer(); syncOverlay();
}
async function screenshotAnswer(review = false) {
  if (state.requestId || state.screenshotPending || !requireAI()) return;
  if (!bridge.captureScreenshot) { toast('Screen capture is unavailable in this app version.', true); return; }
  state.lastRequestKind='screen';state.screenshotPending = true; renderAnswer(); syncOverlay();
  const attempt=createAttemptTiming({kind:'screen',mode:state.settings.answerMode,network:state.settings.networkMode});attempt.mark('captureStartMs');
  let handedOff=false;
  const controller=new AbortController();state.screenAbort=controller;
  try {
    const capture = review ? reviewScreenshot : captureScreenshotAnswer;
    const image = await capture(bridge, $('#question-input').value.trim(),{signal:controller.signal,displayId:$('#screen-display').value});
    state.screenshotPending = false;
    attempt.mark('captureEndMs');
    if (image) { handedOff=await generateAnswer({...image,attempt})===true; }
    else attempt.finish('cancelled','cancelled');
  } catch (error) { attempt.finish(controller.signal.aborted?'cancelled':'error',controller.signal.aborted?'cancelled':'capture');state.providerStatus={state:'error'};state.answerError = `Screenshot failed: ${message(error)}`; toast(state.answerError, true); }
  finally { if(!handedOff){attempt.finish(attempt.metric.outcome,attempt.metric.failureCategory);if(bridge.recordMetric)await bridge.recordMetric(attempt.metric).catch(()=>{});}if(state.screenAbort===controller)state.screenAbort=null;state.screenshotPending = false; renderAnswer(); syncOverlay(); runPendingAutoAnswer(); }
}
async function clearTranscript() {
  if (!state.active?.transcript.length) return;
  const sessionId = state.active.id;
  const dialog = $('#clear-transcript-dialog'); dialog.returnValue = 'cancel'; dialog.showModal();
  const result = await new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }));
  if (result !== 'confirm' || state.active?.id !== sessionId) return;
  if (state.listening || state.starting || state.stopping || state.pendingTranscriptions || state.requestId || state.notesRequestId) { toast('Stop capture and finish pending requests before clearing the transcript.'); return; }
  clearAutoAnswer(); state.active.transcript = []; renderTranscript(); await storeSession(); toast('Transcript cleared. Your answer history is retained.');
}
function renderNotes() {
  const notes = state.active?.notes || '';
  $('#session-notes-panel').hidden = !notes;
  $('#session-notes-text').textContent = notes;
  $('#generate-notes').disabled = Boolean(state.notesRequestId);
  $('#generate-notes').textContent = state.notesRequestId ? 'Summarizing…' : 'Generate notes';
}
async function generateNotes() {
  if (state.notesRequestId) return;
  if (!state.active?.transcript.length) { toast('Add some conversation before generating notes.'); return; }
  if (!requireAI()) return;
  const session = state.active;
  const requestId = uid(); state.notesRequestId = requestId; renderNotes();
  const attempt=createAttemptTiming({kind:'notes',mode:state.settings.answerMode,network:state.settings.networkMode}),metric=attempt.metric;attempt.mark('requestMs');
  const unsubscribe=bridge.onAnswer(event=>{if(event.requestId===requestId && event.delta)attempt.mark('firstTextMs');});
  try {
    const result = await bridge.generate({ requestId, kind: 'notes', question: '', transcript: transcriptText(session), context: session.context });
    if(result.text)attempt.mark('firstTextMs');
    session.notes=result.text;attempt.finish('success');renderNotes();if(session.notes)attempt.mark('firstRenderedMs');
    const saved=await storeSession();metric.save=saved===false?'failed':state.settings.historyMode==='ephemeral'?'memory-only':'durable';if(metric.save==='durable')attempt.mark('savedMs');
    toast(saved===false?'Notes are ready, but saving failed. Export now.':'Session notes are ready.');
  } catch (error) { attempt.finish('error',state.providerStatus.state||'error');toast(`Notes failed: ${message(error)}`, true); }
  finally { unsubscribe?.();attempt.finish(metric.outcome,metric.failureCategory);if(bridge.recordMetric)await bridge.recordMetric(metric).catch(()=>{});state.notesRequestId = null; renderNotes(); }
}
function toast(text, error = false) {
  clearTimeout(toastTimer);
  $('#toast').textContent = text;
  $('#toast').classList.toggle('error', error);
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, error ? 7000 : 3800);
}
function renderShortcutStatus(rows=[]) {
  const failed=rows.filter(row=>!row.registered);
  $('#shortcut-status').textContent=!desktop ? 'Global shortcuts require the desktop app.' : !rows.length ? 'Checking global shortcuts…' : failed.length ? `${failed.length} of ${rows.length} global shortcuts unavailable. Close the app using those keys, then retry.` : `All ${rows.length} global shortcuts registered.`;
  const list=$('#shortcut-conflicts');list.replaceChildren();list.hidden=!failed.length;
  for(const row of failed){const item=document.createElement('li');item.textContent=`${row.label}: ${row.accelerator.replaceAll('CommandOrControl','Ctrl')}`;list.appendChild(item);}
  $('#retry-shortcuts').disabled=!desktop;
}
function handleDesktopRuntime(value) {
  state.desktopPaused=Boolean(value.blocked);
  state.desktopEpoch=value.epoch;
  if(value.warning){$('#desktop-recovery-notice').hidden=false;$('#desktop-recovery-message').textContent=value.warning;}
  else if(value.lastReason){
    $('#desktop-recovery-notice').hidden=false;
    $('#desktop-recovery-message').textContent=value.blocked ? 'Desktop recovery: audio and AI requests are paused while Windows returns and capture stops.' : 'Windows returned. Recording remains off; start listening again when you are ready.';
  }
  if(value.needsStop && value.epoch!==handledLifecycleEpoch){
    handledLifecycleEpoch=value.epoch;clearAutoAnswer();state.screenAbort?.abort();
    const hadWork=state.listening||state.starting||state.stopping||state.requestId||state.notesRequestId||state.pendingTranscriptions||state.screenshotPending;
    desktopStopSequence=desktopStopSequence.catch(()=>{}).then(async()=>{
      if(hadWork&&state.active)appendTranscript('Desktop interruption: Windows sleep or screen lock stopped audio and AI requests. Some final speech may be missing. Restart listening manually.','status');
      // Closing review windows also drops their transient image/document text.
      for(const id of ['screen-analysis-dialog','resume-review-dialog']){const dialog=$(`#${id}`);if(dialog.open)dialog.close('cancel');}
      await cancelGeneration();
      if(state.notesRequestId)await bridge.cancel({requestId:state.notesRequestId}).catch(()=>{});
      await stopListening();await persistWorkspace();
      await bridge.lifecycleReady({epoch:value.epoch});
    }).catch(error=>toast(`Desktop recovery: ${message(error)}`,true));
  }
  setListeningUI();
}
function normalizeWorkspace(workspace) {
  state.context = { ...emptyContext(), ...workspace?.context };
  for (const key of Object.keys(state.context)) state.context[key] = String(state.context[key] || '');
  state.sessions = Array.isArray(workspace?.sessions) ? workspace.sessions.filter(s => s && typeof s.id === 'string').map(s => ({ ...s, transcript: Array.isArray(s.transcript) ? s.transcript : [], exchanges: Array.isArray(s.exchanges) ? s.exchanges : [] })) : [];
}
function persistWorkspace() {
  pendingWorkspace = clone({ context: state.context, sessions: state.sessions });
  $('#transcript-save-status').textContent = 'Saving locally…';
  if (persistenceBusy) return persistence;
  persistenceBusy = true;
  persistence = (async () => {
    let saved=true;
    try {
    while (pendingWorkspace) {
      const snapshot = pendingWorkspace; pendingWorkspace = null;
    try {
      if (desktop) await bridge.saveWorkspace(snapshot);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      $('#retry-save').hidden = true;$('#retry-context-save').hidden=true;
      $('#context-save-status').textContent = state.settings.historyMode === 'ephemeral' ? 'Memory only — not saved to disk' : 'All changes saved';
      $('#transcript-save-status').textContent = state.settings.historyMode === 'ephemeral' ? 'Memory only — export before closing' : pendingWorkspace ? 'Saving latest changes…' : 'Transcript and drafts saved on this device';
    } catch (error) {
      $('#context-save-status').textContent = 'Could not save changes';
      $('#transcript-save-status').textContent = 'Save failed — export the session now';
      saved=false;pendingWorkspace = pendingWorkspace || snapshot;
      $('#retry-save').hidden = false;$('#retry-context-save').hidden=false;
      toast(`Your workspace could not be saved: ${message(error)}`, true);
      break;
    }
    }
    } finally { persistenceBusy = false; }
    return saved;
  })();
  return persistence;
}
function sessionTitle(context = state.context) { return context.role ? `${context.role}${context.company ? ` · ${context.company}` : ''}` : context.company ? `Interview at ${context.company}` : 'Untitled interview'; }
function ensureSession() {
  if(!state.active && state.sessions.length>=100) { toast('History is full. Export and delete an older session before starting another.',true);return null; }
  if (!state.active) state.active = { id: uid(), title: sessionTitle(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), context: clone(state.context), transcript: [], exchanges: [], durationMs: 0 };
  return state.active;
}
function storeSession() {
  const session = state.active;
  if (!session || (!session.transcript.length && !session.exchanges.length && !state.sessions.some(saved => saved.id === session.id))) return;
  session.updatedAt = new Date().toISOString();
  const index = state.sessions.findIndex(s => s.id === session.id);
  if (index >= 0) state.sessions[index] = clone(session);
  else state.sessions.unshift(clone(session));
  updateHistoryCount();
  return persistWorkspace();
}
function updateHistoryCount() { $('#history-count').textContent = state.sessions.length; $('#history-total').textContent = `${state.sessions.length} saved session${state.sessions.length === 1 ? '' : 's'}`; }
function setView(view, focus = true) {
  const names = { workspace: 'Interview workspace', context: 'My context', history: 'Session history', settings: 'Settings' };
  if (!names[view]) view = 'workspace';
  state.view = view;
  $$('.view').forEach(el => { el.hidden = el.id !== `view-${view}`; });
  $$('[data-view]').forEach(el => { const active = el.dataset.view === view; el.classList.toggle('active', active); if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
  $('#view-label').textContent = names[view];
  document.title = `Parakeet Studio — ${names[view]}`;
  if (view === 'history') renderHistory();
  window.scrollTo(0, 0);
  if (focus) $('#main-content').focus({ preventScroll: true });
}
function updateContextUI() {
  const context = state.active?.context || state.context;
  $('#session-title').textContent = context.role || (context.company ? `Interview at ${context.company}` : 'Your next interview');
  $('#session-context').textContent = context.company ? `${context.company} · ${context.resume ? 'Personal context ready' : 'Add your resume for tailored answers'}` : context.role ? 'Add a company or resume to give your copilot more context.' : 'Add a role and company to personalize your answers.';
  $('#context-dot').hidden = !Object.values(state.context).some(Boolean);
  const hint = $('#answer-context-hint');
  if (hint) hint.textContent = context.resume && state.settings.dataPolicy === 'unpaid' ? 'Personal context stays local in unpaid practice mode' : context.resume ? 'Your personal context is ready' : 'Add your resume for more personal answers';
}
function updateConnectionUI() {
  const ready = desktop && state.settings.hasApiKey && ['unpaid','reviewed','local'].includes(state.settings.dataPolicy);
  $('#connection-status').textContent = ready ? 'AI provider configured' : desktop && state.settings.hasApiKey ? 'Choose data-use policy' : desktop ? 'Connect your AI provider' : 'Browser preview';
  $('#connection-detail').textContent = ready ? state.settings.model : desktop && state.settings.hasApiKey ? 'Review data-use settings before sending content' : desktop ? 'Add your key in Settings' : 'AI and audio need the desktop app';
  $('#connection-dot').classList.toggle('connected', ready);
  $('#key-status').textContent = state.settings.hasApiKey ? 'Key saved' : 'Not configured';
  $('#key-hint').textContent = state.settings.hasApiKey ? 'Leave empty to keep saved key' : 'Required for AI features';
  $('#provider-key').placeholder = state.settings.hasApiKey ? 'A key is saved securely' : 'Enter your API key';
}
async function updateProtectionUI() {
  const badge = $('#capture-protection-status');
  if (!desktop) { badge.textContent = 'Desktop capture protection unavailable in preview'; return; }
  const status = await bridge.getProtectionStatus();
  badge.textContent = status.enabled && status.supported ? 'Capture exclusion on · verify meeting preview' : status.enabled ? 'Capture protection requested · OS support limited' : 'Visible to screen sharing';
  badge.classList.toggle('protected', status.enabled && status.supported);
}
function setListeningUI() {
  $('#capture-label').textContent = state.stopping ? 'Stopping…' : state.starting ? 'Starting…' : state.listening ? 'Stop listening' : 'Start listening';
  $('#capture-button').disabled = state.starting || state.stopping || state.desktopPaused;
  $('#capture-button').firstElementChild.innerHTML = icon(state.listening ? 'stop' : 'mic');
  $('#audio-source').disabled = state.listening || state.starting || state.stopping;
  $('#microphone-device').disabled = state.listening || state.starting || state.stopping || $('#audio-source').value === 'system';
  $('#refresh-microphones').disabled = state.listening || state.starting || state.stopping;
  const badge = $('#session-state');
  badge.classList.toggle('listening', state.listening);
  badge.innerHTML = `<span class="status-dot"></span>${state.starting ? 'Starting capture' : state.listening ? 'Listening' : state.pendingTranscriptions ? 'Transcribing' : 'Ready when you are'}`;
  if (!state.listening && !state.starting) $('#audio-level').style.width = '0%';
  syncOverlay();
}
function audioStatus() {
  const recovering = Object.values(state.liveStates).some(value => value === 'reconnecting');
  $('#audio-status').textContent = recovering ? 'Reconnecting · audio buffer limited to 8 seconds' : state.pendingTranscriptions ? `Transcribing ${state.pendingTranscriptions} audio segment${state.pendingTranscriptions === 1 ? '' : 's'}…` : state.listening ? `Listening · ${state.settings.networkMode === 'economy' ? 'silence-saving mode' : 'continuous audio'}` : 'Audio is off. You control when it starts.';
  setListeningUI();
}
function renderTranscript() {
  const segments = state.active?.transcript || [];
  $('#transcript-count').textContent = `${segments.length} segment${segments.length === 1 ? '' : 's'}`;
  if (!segments.length) {
    $('#transcript-content').innerHTML = `<div class="empty-state transcript-empty"><div class="wave-illustration" aria-hidden="true">${'<i></i>'.repeat(15)}</div><h3>Every good answer<br>starts with listening.</h3><p>Start audio capture to transcribe the conversation. You can also type a question.</p><button type="button" class="text-link" id="sample-transcript">Try a sample question${icon('arrow-right')}</button></div>`;
    return;
  }
  const content = $('#transcript-content');
  const nearBottom = content.scrollHeight - content.scrollTop - content.clientHeight < 100;
  const offset = state.showAllTranscript ? 0 : Math.max(0, segments.length - 250);
  content.innerHTML = (offset ? `<p class="field-help">Showing the latest 250 segments. The full transcript is saved and exported. <button type="button" class="text-link" id="show-all-transcript">Show all ${segments.length} segments</button></p>` : '') + segments.slice(offset).map((segment, index) => `<article class="transcript-segment"><div class="segment-meta"><strong>${escape(sourceLabel(segment.source))}</strong><span>${formatTime(segment.time)}${segment.originalText ? ' · Edited' : ''}</span></div><p>${escape(segment.text)}</p><div class="segment-actions"><button class="text-link use-question" type="button" data-segment="${index + offset}">Use this question${icon('arrow-right')}</button><button class="text-link" type="button" data-edit-segment="${index + offset}">Correct wording</button></div></article>`).join('');
  if (nearBottom) content.scrollTop = content.scrollHeight;
}
function formatTime(time) { const date = new Date(time); return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function appendTranscript(text, source = 'audio') {
  text = String(text || '').trim();
  if (!text) return;
  delete state.interims[source]; renderInterims();
  const session = ensureSession();
  if(!session) return;
  session.transcript.push({ id: uid(), text, source, time: new Date().toISOString() });
  renderTranscript(); updateContextUI(); storeSession();
}
function renderInterims() {
  const text = Object.entries(state.interims).map(([source, value]) => `${sourceLabel(source)} (live preview): ${value}`).join('\n');
  $('#transcript-interim').textContent = text; $('#transcript-interim').hidden = !text;
}
async function editTranscript(index) {
  const session = state.active, segment = session?.transcript[index];
  if (!segment || state.requestId || state.notesRequestId) { toast('Finish the current answer or notes before editing.'); return; }
  const dialog = $('#edit-transcript-dialog'); $('#edit-transcript-text').value = segment.text;
  dialog.returnValue = 'cancel'; dialog.showModal();
  const result = await new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }));
  if (result !== 'confirm' || state.active?.id !== session.id) return;
  const text = $('#edit-transcript-text').value.trim().slice(0, 16000);
  if (!text) return;
  clearAutoAnswer(); segment.originalText ||= segment.text; segment.text = text; segment.editedAt = new Date().toISOString();
  renderTranscript(); await storeSession(); toast('Transcript corrected. The original wording is retained in exports.');
}
function renderAnswer() {
  const container = $('#answer-content');
  if (!state.currentQuestion && !state.currentAnswer && !state.requestId) {
    container.innerHTML = `<div class="empty-state answer-empty"><span class="answer-illustration" aria-hidden="true">${icon('sparkles')}</span><h3>Your experience.<br>A clearer way to say it.</h3><p>Get a thoughtful starting point for the question in front of you, grounded in your context.</p><div class="context-hint"><span>${icon('context')}</span><span id="answer-context-hint">${(state.active?.context || state.context).resume ? 'Your personal context is ready' : 'Add your resume for more personal answers'}</span><a href="#context" aria-label="Add personal context">${icon('arrow-right')}</a></div></div>`;
  } else {
    container.innerHTML = `<p class="answer-question">${escape(state.currentQuestion)}</p><div id="answer-text" class="answer-text${state.requestId && state.currentAnswer ? ' stream-cursor' : ''}"></div>${state.requestId && !state.currentAnswer ? '<div class="generating-indicator"><span class="spinner" aria-hidden="true"></span>Finding a clear starting point…</div>' : ''}${!state.requestId && state.currentAnswer ? `<p class="answer-meta">${icon('sparkles')}AI draft · Review and make it your own</p>` : ''}`;
    renderAnswerText($('#answer-text'), state.currentAnswer);
    const selected = state.active?.exchanges[state.answerIndex < 0 ? state.active.exchanges.length - 1 : state.answerIndex];
    const meta = $('.answer-meta', container);
    if (meta && selected?.metrics) meta.appendChild(document.createTextNode(` · First text ${(selected.metrics.firstTokenMs / 1000).toFixed(1)}s · Total ${(selected.metrics.totalMs / 1000).toFixed(1)}s`));
  }
  const count = state.active?.exchanges.length || 0, index = state.answerIndex < 0 ? count - 1 : state.answerIndex;
  $('#answer-position').textContent = count ? `${index + 1} / ${count}` : 'No answers yet';
  $('#previous-answer').disabled = Boolean(state.requestId) || index <= 0;
  $('#next-answer').disabled = Boolean(state.requestId) || index >= count - 1;
  $('#screenshot-answer').disabled = Boolean(state.requestId) || state.screenshotPending;
  $('#screenshot-answer').textContent = state.screenshotPending ? 'Capturing screen…' : 'Answer screenshot';
  $('#copy-answer').disabled = !state.currentAnswer;
  $('#generate-button').hidden = Boolean(state.requestId);
  $('#cancel-answer').hidden = !state.requestId;
  $('#answer-error').textContent = state.answerError;
  $('#answer-error').hidden = !state.answerError;
}
function syncOverlay() {
  if (!desktop || !bridge.setOverlay || overlaySyncTimer) return;
  overlaySyncTimer = setTimeout(() => { overlaySyncTimer = null; const pending=questionQueue.pending?.sessionId===state.active?.id ? questionQueue.pending : null; void bridge.setOverlay({ recovery:{...recoveryView({provider:state.providerStatus,liveStates:state.liveStates,levels:state.levels,listening:state.listening,starting:state.starting,source:$('#audio-source').value,online:navigator.onLine,error:state.answerError,hasQuestion:Boolean(state.currentQuestion||state.lastRequestKind==='screen')}),retryLabel:state.lastRequestKind==='screen'?'Capture again':'Retry answer'}, question: state.currentQuestion, answer: state.currentAnswer, pendingQuestion:pending?.text || '',pendingStatus:pending ? $('#pending-question-status').textContent : '',pendingCanSend:Boolean(pending&&!$('#pending-question-send').disabled),pendingHeld:Boolean(pending?.userHeld), listening: state.listening, answerIndex: state.answerIndex < 0 ? (state.active?.exchanges.length || 0) - 1 : state.answerIndex, answerCount: state.active?.exchanges.length || 0, generating: Boolean(state.requestId) || state.screenshotPending }).catch(() => {}); }, 100);
}
function requireAI() {
  if(state.desktopPaused){toast('Desktop recovery is in progress. Wait before starting again.',true);return false;}
  if (!desktop) { toast('AI requests run in the desktop app. This browser preview stores your workspace only.', true); return false; }
  if (!state.settings.hasApiKey) {
    state.answerError = 'Connect your AI provider in Settings to generate answers and transcribe audio.';
    renderAnswer(); toast('Add your API key in Settings to get started.', true);
    location.hash = 'settings';
    return false;
  }
  if(!['unpaid','reviewed','local'].includes(state.settings.dataPolicy)) { toast('Choose the data-use policy in Settings before sending content.',true);location.hash='settings';return false; }
  return true;
}
async function generateAnswer(options = {}) {
  if (state.requestId || state.screenshotPending) return;
  const segments = state.active?.transcript || [];
  const typed = $('#question-input').value.trim();
  const question = options.question || typed || segments.at(-1)?.text;
  if (!question) { toast('Type a question or add a transcript segment first.'); $('#question-input').focus(); return; }
  if (!requireAI()) return;
  const session = ensureSession();
  if(!session) return;state.lastRequestKind=options.imageDataUrl?'screen':'text';
  if (!options.automatic && !options.imageDataUrl && typed && segments.at(-1)?.text !== typed) appendTranscript(typed, 'manual');
  if (!options.automatic) clearAutoAnswer();
  lastAnswerStartedAt = performance.now(); questionQueue.markSent(question,session.id,{source:options.timing?.source??null,revision:options.timing?.revision??null,active:Boolean(options.automatic)}); state.answerIndex = -1;
  const requestId = uid();
  const attempt=options.attempt || createAttemptTiming({kind:options.imageDataUrl?'screen':options.automatic?'audio':'typed',mode:state.settings.answerMode,network:state.settings.networkMode,speechEndedAt:options.timing?.speechEndedAt,finalAt:options.timing?.finalAt});
  const metric=attempt.metric;attempt.mark('requestMs');
  state.attemptMetric=metric;state.activeQuestionRevision=options.automatic?options.timing?.revision??null:null;
  const previousAnswers = session.exchanges.slice(-3);
  const exchange = { id: uid(), question, answer: '', style: state.style, status: 'streaming', screenshotUsed: Boolean(options.imageDataUrl), createdAt: new Date().toISOString() };
  session.exchanges.push(exchange); let lastCheckpoint = Date.now();
  state.requestId = requestId; state.currentAnswer = ''; state.currentQuestion = question; state.answerError = '';
  renderAnswer(); syncOverlay(); storeSession();
  const stopStreaming = bridge.onAnswer(event => {
    if (event.requestId !== requestId || state.requestId !== requestId) return;
    if(event.delta)attempt.mark('firstTextMs');
    state.currentAnswer += event.delta || '';
    if(hasUsefulText(state.currentAnswer))attempt.mark('firstUsefulTextMs');
    exchange.answer = state.currentAnswer;
    if (!answerPaintTimer) answerPaintTimer = setTimeout(() => {
      answerPaintTimer = null; const text = $('#answer-text');
      if (text) { renderAnswerText(text, state.currentAnswer); if(state.currentAnswer)attempt.mark('firstRenderedMs');text.classList.add('stream-cursor'); $('.generating-indicator')?.remove(); $('#answer-content').scrollTop = $('#answer-content').scrollHeight; }
    }, 50);
    if (Date.now() - lastCheckpoint >= 1000) { lastCheckpoint = Date.now(); storeSession(); }
    $('#copy-answer').disabled = !state.currentAnswer;
    syncOverlay();
  });
  try {
    const result = await bridge.generate({ requestId, question, transcript: transcriptText(session), previousAnswers, ...(options.imageDataUrl ? { imageDataUrl: options.imageDataUrl, screenQuality: options.screenQuality, captureId: options.captureId } : {}), context: session.context || state.context, style: state.style, kind: 'answer' });
    if (state.requestId === requestId) state.currentAnswer = result.text || state.currentAnswer;
    if(state.currentAnswer)attempt.mark('firstTextMs');
    if(hasUsefulText(state.currentAnswer))attempt.mark('firstUsefulTextMs');
    exchange.metrics = result.metrics;
    if(metric.outcome!=='cancelled'){exchange.status='complete';metric.outcome='success';attempt.mark('completedMs');}
    else {exchange.status=state.currentAnswer?'partial':'failed';exchange.error='Answer stopped. Review the draft and revised question before sending again.';state.answerError=exchange.error;}
  } catch (error) {
    if (state.requestId === requestId) state.answerError = message(error);
    metric.failureCategory=state.providerStatus.state||'error';exchange.error = message(error); exchange.status = state.currentAnswer ? 'partial' : 'failed';
    if(metric.outcome!=='cancelled')metric.outcome=state.currentAnswer?'partial':'error';
  } finally {
    stopStreaming?.();
    clearTimeout(answerPaintTimer); answerPaintTimer = null;
    if (state.requestId === requestId) state.requestId = null;
    exchange.answer = state.currentAnswer;
    if(options.automatic)questionQueue.completeSent(options.timing?.revision??null);
    if(metric.outcome==='cancelled')metric.failureCategory='cancelled';
    attempt.finish(metric.outcome,metric.failureCategory);
    renderAnswer();if(state.currentAnswer)attempt.mark('firstRenderedMs');
    if (state.active?.id === session.id) { const saved=await storeSession();metric.save=saved===false?'failed':state.settings.historyMode==='ephemeral'?'memory-only':'durable';if(metric.save==='durable')attempt.mark('savedMs'); }
    if(state.attemptMetric===metric)state.attemptMetric=null;
    if(bridge.recordMetric)await bridge.recordMetric(metric).catch(()=>{});
    renderAnswer(); syncOverlay(); runPendingAutoAnswer();
  }
  return true;
}
async function cancelGeneration() {
  const requestId = state.requestId;
  if (!requestId) return;
  if(state.attemptMetric)state.attemptMetric.outcome='cancelled';
  try { await bridge.cancel({ requestId }); } catch (error) { toast(message(error), true); }
  // The generation promise persists any partial draft before returning to ready.
}
async function toggleListening() {
  if (state.starting || state.stopping) return;
  if (state.listening) { await stopListening(); return; }
  if (!requireAI()) return;
  const epoch=++audioEpoch;let capture;let cleanup=[];
  const checkStartup=()=>{if(epoch!==audioEpoch||state.desktopPaused)throw new Error('Audio startup was cancelled.');};
  state.starting = true; state.answerError = ''; setListeningUI();
  try {
    const { AudioCapture } = await import('./audio.js');
    checkStartup();capture = new AudioCapture();
    state.capture = capture;
    if(!ensureSession()) { state.capture=null;return; }
    const live = state.settings.provider === 'gemini';
    if (live) {
      state.liveCleanup = cleanup = [
        bridge.onLiveTranscript(value => { appendTranscript(value.text, value.source || 'audio'); scheduleAutoAnswer(value.text, value.source); }),
        bridge.onLiveError(value => { state.answerError=message(value.message);state.providerStatus={state:'connection'};syncOverlay();toast(value.message, true); void stopListening(); }),
        bridge.onLiveInterim(value => { state.interims[value.source] = value.text; renderInterims(); if ($('#auto-answer').checked && !state.stopping && acceptQuestionSource($('#audio-source').value,value.source)) { questionQueue.interim(value.text,value.source,state.active?.id); runPendingAutoAnswer(); } }),
        bridge.onLiveStatus(value => {
          const previous = state.liveStates[value.source]; state.liveStates[value.source] = value.state;
          if ((value.state === 'reconnecting' && previous !== 'reconnecting') || value.state === 'gap') appendTranscript(value.message, 'status');
          if (value.state === 'reconnecting' || value.state === 'gap') { questionQueue.hold(value.source,state.active?.id); runPendingAutoAnswer(); }
          audioStatus();
        }),
      ];
      await bridge.startLive({ sources: $('#audio-source').value === 'both' ? ['microphone', 'system'] : [$('#audio-source').value] });
      checkStartup();
    }
    await capture.start({
      source: $('#audio-source').value, microphoneDeviceId: $('#microphone-device').value, networkMode: state.settings.networkMode,
      ...(live ? { onPCM: (audio, source) => {
        if (state.livePCMPending >= 8) { toast('Live audio cannot keep up. Check the provider connection.', true); void stopListening(); return; }
        state.livePCMPending++;
        return bridge.sendLiveAudio({ audio, source }).catch(error => { appendTranscript(`Audio interruption: ${message(error)}`, 'status'); toast(message(error), true); void stopListening(); }).finally(() => state.livePCMPending--);
      } } : {}),
      onSpeechEnd: source => live ? bridge.endLiveAudio({ source }) : undefined,
      onSegment: async ({ audio, mimeType, source }) => {
        state.pendingTranscriptions++; audioStatus();
        if ($('#auto-answer').checked && acceptQuestionSource($('#audio-source').value,source)) { questionQueue.interim('transcribing',source,state.active?.id); runPendingAutoAnswer(); }
        try {
          const result = await bridge.transcribe({ audio, mimeType, source });
          appendTranscript(result.text, source || 'audio');
          scheduleAutoAnswer(result.text, source);
        } catch (error) { questionQueue.interim('',source,state.active?.id); questionQueue.hold(source,state.active?.id); runPendingAutoAnswer(); appendTranscript(`Transcription failed for ${source || 'audio'}: ${message(error)}. This segment may be missing.`, 'status'); toast(`Transcription failed: ${message(error)}`, true); }
        finally { state.pendingTranscriptions--; audioStatus(); }
      },
      onLevel: (level,source) => {state.levels[source]=level;if(audioActivity.update(source,level)&&$('#audio-source').value==='both'&&$('#auto-answer').checked&&!state.stopping){questionQueue.hold('system',state.active?.id);appendTranscript('Both audio sources were active together. Review the question for overlap, echo or missing constraints before sending.','status');runPendingAutoAnswer();}syncOverlay(); $('#audio-level').style.width = `${Math.min(100, Math.max(0, level * 100))}%`; if (level > .048 && !state.stopping && acceptQuestionSource($('#audio-source').value,source)) questionQueue.activity(source,state.active?.id); },
      onWarning: warning => {
        const text = message(warning);
        if (/skipped|cannot keep up|unavailable|muted|missing|flush/i.test(text) && (state.lastAudioWarning !== text || Date.now() - (state.lastAudioWarningAt || 0) > 5000)) {
          state.lastAudioWarning = text; state.lastAudioWarningAt = Date.now(); appendTranscript(`Audio warning: ${text}`, 'status');
        }
        toast(text);
      },
      onError: error => { toast(message(error), true); },
      onEnded: () => { if (state.capture === capture && (state.listening || state.starting)) void stopListening(); },
    });
    checkStartup();
    state.listening = true; state.listeningStartedAt = Date.now(); void refreshMicrophones();
  } catch (error) {
    await capture?.stop().catch(()=>{});
    if(epoch===audioEpoch) {
      await bridge.stopLive().catch(() => {});
      if(epoch===audioEpoch){state.capture=null;state.listening=false;toast(`Could not start audio: ${message(error)}`,true);}
    }
    for (const dispose of cleanup) dispose();if(state.liveCleanup===cleanup)state.liveCleanup=[];
  } finally { if(epoch===audioEpoch){state.starting=false;audioStatus();runPendingAutoAnswer();} }
}
function stopListening() {
  if(captureStopPromise) return captureStopPromise;
  captureStopPromise=stopCapture().finally(()=>{captureStopPromise=null;});return captureStopPromise;
}
async function stopCapture() {
  if (state.stopping) return;
  ++audioEpoch;
  state.stopping = true; clearAutoAnswer();
  const capture = state.capture;
  state.capture = null;
  if (state.listeningStartedAt && state.active) state.active.durationMs = (state.active.durationMs || 0) + Date.now() - state.listeningStartedAt;
  state.listeningStartedAt = 0; state.listening = false; state.starting = false;
  setListeningUI();
  try { if (capture) await capture.stop(); } catch (error) { toast(`Audio stopped: ${message(error)}`, true); }
  if (state.liveCleanup.length) {
    await bridge.stopLive().catch(error => toast(message(error), true));
    for (const cleanup of state.liveCleanup) cleanup(); state.liveCleanup = [];
  }
  state.stopping = false;
  state.interims = {}; state.liveStates = {};state.levels={};audioActivity.reset(); renderInterims();
  audioStatus(); storeSession();
}
async function newSession() {
  if (state.screenshotPending) { toast('Wait for the screenshot request to finish.'); return; }
  if (state.stopping) { toast('Wait for the final transcript before starting a new session.'); return; }
  if (state.notesRequestId) { toast('Wait for the session notes before starting a new session.'); return; }
  if (state.requestId) { toast('Stop the current answer before starting a new session.'); return; }
  if (state.listening || state.starting || state.pendingTranscriptions) {
    toast('Stop listening and wait for transcription before starting a new session.'); return;
  }
  storeSession(); state.active = null; state.currentAnswer = ''; state.currentQuestion = ''; state.answerError = '';
  $('#question-input').value = ''; $('#session-clock').textContent = '00:00';
  clearAutoAnswer(); state.answerIndex = -1; renderTranscript(); renderAnswer(); renderNotes(); updateContextUI(); syncOverlay();
  location.hash = 'workspace'; toast('A fresh workspace, ready for your next conversation.');
}
async function exportSession(session, format = 'md') {
  if (!session || (!session.transcript?.length && !session.exchanges?.length)) { toast('Add a question or transcript before exporting a session.'); return; }
  try {
    if (desktop) { const result = await bridge.exportSession({ ...clone(session), format }); if (result.saved) toast('Session exported.'); }
    else {
      const lines = [`# ${session.title || 'Interview session'}`, '', `Date: ${new Date(session.createdAt).toLocaleString()}`, '', '## Transcript', '', ...session.transcript.flatMap(s => [`${s.source === 'sample' ? '[Sample] ' : ''}${s.text}`, '']), '## Answers', '', ...session.exchanges.flatMap(e => [`### ${e.question}`, '', e.answer, '']), '## Notes', '', session.notes || ''];
      const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `parakeet-session-${session.id.slice(0, 8)}.md`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Session exported.');
    }
  } catch (error) { toast(`Export failed: ${message(error)}`, true); }
}
function renderHistory() {
  updateHistoryCount();
  const search = $('#history-search').value.trim().toLowerCase();
  const sessions = state.sessions.filter(s => [s.title, s.context?.role, s.context?.company, ...s.transcript.map(t => t.text), ...s.exchanges.map(e => e.question)].join(' ').toLowerCase().includes(search)).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (!sessions.length) {
    $('#history-list').innerHTML = `<div class="empty-state history-empty"><span aria-hidden="true">${icon('history')}</span><h3>${search ? 'No sessions found.' : 'Every conversation is a beginning.'}</h3><p>${search ? 'Try another role, company, or question.' : 'Your transcripts and answer drafts will appear here as you use the workspace.'}</p>${search ? '' : `<a class="button secondary" href="#workspace">Open workspace${icon('arrow-right')}</a>`}</div>`;
    return;
  }
  $('#history-list').innerHTML = sessions.map(session => `<article class="history-card"><span class="history-icon" aria-hidden="true">${icon('headphones')}</span><div class="history-details"><h2>${escape(session.title)}</h2><p>${escape(new Date(session.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }))} · ${session.transcript.length} segment${session.transcript.length === 1 ? '' : 's'} · ${session.exchanges.length} answer${session.exchanges.length === 1 ? '' : 's'}</p>${session.transcript.length ? `<div class="history-preview">${escape(session.transcript[0].text)}</div>` : ''}</div><div class="history-actions"><button class="button secondary" type="button" data-open-session="${escape(session.id)}">Open session${icon('arrow-right')}</button><button class="icon-button" type="button" data-export-session="${escape(session.id)}" aria-label="Export session">${icon('download')}</button><button class="icon-button" type="button" data-delete-session="${escape(session.id)}" aria-label="Delete session">${icon('trash')}</button></div></article>`).join('');
}
async function openSession(id) {
  if (state.screenshotPending) { toast('Wait for the screenshot request to finish.'); return; }
  if (state.stopping) { toast('Wait for the final transcript before opening another session.'); return; }
  if (state.notesRequestId) { toast('Wait for the current notes to finish.'); return; }
  if (state.listening || state.starting || state.pendingTranscriptions || state.requestId) { toast('Finish the current capture or answer before opening another session.'); return; }
  const session = state.sessions.find(s => s.id === id);
  if (!session) return;
  state.active = clone(session);
  const last = state.active.exchanges.at(-1);
  state.currentQuestion = last?.question || ''; state.currentAnswer = last?.answer || ''; state.answerError = last?.error || (last?.status === 'streaming' ? 'This saved draft was interrupted before completion.' : '');
  if (last?.style) setStyle(last.style);
  $('#question-input').value = '';
  clearAutoAnswer(); state.answerIndex = -1; renderTranscript(); renderAnswer(); renderNotes(); updateContextUI(); syncOverlay(); updateClock();
  location.hash = 'workspace';
}
async function confirmDelete(id) {
  const dialog = $('#confirm-dialog');
  dialog.returnValue = 'cancel';
  dialog.showModal();
  const result = await new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }));
  if (result !== 'confirm') return;
  if (state.active?.id === id && (state.listening || state.stopping || state.requestId || state.pendingTranscriptions || state.notesRequestId || state.screenshotPending)) { toast('Finish the current session before deleting it.'); return; }
  state.sessions = state.sessions.filter(s => s.id !== id);
  if (state.active?.id === id) { state.active = null; state.currentAnswer = ''; state.currentQuestion = ''; clearAutoAnswer(); state.answerIndex = -1; renderTranscript(); renderAnswer(); renderNotes(); updateContextUI(); syncOverlay(); }
  const saved=await persistWorkspace(); renderHistory(); if(saved===false)return;toast('Session removed from this device.');
}
function setStyle(style) {
  if (!['concise', 'star', 'technical', 'coding'].includes(style)) return;
  state.style = style;
  $$('[data-style]').forEach(el => { const active = el.dataset.style === style; el.classList.toggle('selected', active); el.setAttribute('aria-pressed', active); });
}
function updateClock() {
  const milliseconds = (state.active?.durationMs || 0) + (state.listeningStartedAt ? Date.now() - state.listeningStartedAt : 0);
  const seconds = Math.floor(milliseconds / 1000);
  $('#session-clock').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
function bindEvents() {
  $('#retry-shortcuts').addEventListener('click',async()=>{
    if(!desktop)return;$('#retry-shortcuts').disabled=true;
    try{renderShortcutStatus(await bridge.retryShortcuts());}catch(error){toast(message(error),true);}finally{$('#retry-shortcuts').disabled=false;}
  });
  $('#check-local-provider').addEventListener('click',async()=>{const button=$('#check-local-provider'),status=$('#local-provider-status');if(!desktop){status.textContent='Local server checks require the desktop app.';return;}button.disabled=true;status.textContent='Checking the saved local server…';try{const result=await bridge.checkLocalProvider();status.textContent=`Server reached. Answer model listed: ${result.answerModelListed?'yes':'no'}. Transcription model listed: ${result.transcriptionModelListed?'yes':'no'}. ${result.scope}`;}catch(error){status.textContent=message(error);}finally{button.disabled=false;}});
  $('#export-diagnostics').addEventListener('click',()=>void bridge?.exportDiagnostics?.().catch(error=>toast(message(error),true)));
  $('#clear-diagnostics').addEventListener('click',async()=>{await bridge?.clearDiagnostics?.();toast('Content-free diagnostic counters cleared.');});
  $('#retry-save').addEventListener('click',()=>void persistWorkspace());
  $('#retry-context-save').addEventListener('click',()=>void persistWorkspace());
  $('#delete-key').addEventListener('click',async()=>{if(!desktop)return;try{const s=await bridge.getSettings();state.settings=await bridge.saveSettings({...s,apiKey:''});$('#provider-key').value='';updateConnectionUI();toast('Saved key removed from app settings and recovery copy.');}catch(error){toast(message(error),true);}});
  $('#clear-context').addEventListener('click',async()=>{
    if(state.listening || state.starting || state.stopping || state.requestId || state.notesRequestId || state.pendingTranscriptions || state.screenshotPending){toast('Finish capture and requests before clearing personal context.');return;}
    const dialog=$('#clear-context-dialog');dialog.returnValue='cancel';dialog.showModal();
    const result=await new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue),{once:true}));if(result!=='confirm')return;
    state.context=emptyContext();for(const session of state.sessions)session.context=emptyContext();if(state.active)state.active.context=emptyContext();
    for(const [name,value] of Object.entries(state.context))$(`[name="${name}"]`,$('#context-form')).value=value;
    const saved=await persistWorkspace();updateContextUI();if(saved===false)return;toast('Personal context cleared from saved profiles and recovery snapshots. Existing transcript/answer text is retained.');
  });
  $('#preview-request').addEventListener('click',async()=>{if(!desktop || !requireAI())return;try{const preview=await bridge.previewRequest({question:$('#question-input').value.trim() || 'Preview an answer request',context:state.active?.context || state.context,transcript:state.active ? transcriptText(state.active) : '',previousAnswers:state.active?.exchanges.slice(-3) || [],style:state.style});$('#outbound-review-text').value=JSON.stringify(preview,null,2);$('#outbound-review-dialog').showModal();}catch(error){toast(message(error),true);}});
  if (desktop && bridge.onPrepareClose) bridge.onPrepareClose(async () => {
    if (!workspaceLoaded) { await bridge.readyToClose(); return; }
    clearAutoAnswer();
    try {
      await stopListening();
      if (state.requestId) {
        await cancelGeneration();
        const deadline = Date.now() + 2000;
        while (state.requestId && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
      }
      clearTimeout(contextTimer); await persistWorkspace();
    } finally { await bridge.readyToClose(); }
  });
  $('#provider-type').addEventListener('change', () => {
    const gemini = $('#provider-type').value === 'gemini';
    $('#provider-url').value = gemini ? 'https://generativelanguage.googleapis.com/v1beta' : 'https://api.openai.com/v1';
    $('#answer-model').value = gemini ? 'gemini-3.5-flash-lite' : 'gpt-4.1-mini';
    $('#transcription-model').value = gemini ? 'gemini-3.5-transcribe-live' : 'gpt-4o-mini-transcribe';
    $('#provider-key').value = '';
    $('#key-hint').textContent = $('#provider-type').value === state.settings.provider ? 'Leave empty to keep saved key' : 'Enter the key for this provider';
  });
  $('#refresh-microphones').addEventListener('click', () => void refreshMicrophones());
  $('#audio-source').addEventListener('change', () => { clearAutoAnswer(); setListeningUI(); });
  $('#pending-question-dismiss').addEventListener('click',clearAutoAnswer);
  $('#pending-question-hold').addEventListener('click',togglePendingHold);
  $('#pending-question-send').addEventListener('click',sendPendingQuestion);
  navigator.mediaDevices?.addEventListener?.('devicechange', () => void refreshMicrophones());
  $('#previous-answer').addEventListener('click', () => browseAnswer(-1));
  $('#next-answer').addEventListener('click', () => browseAnswer(1));
  $('#screenshot-answer').addEventListener('click', () => void screenshotAnswer());
  $('#review-screenshot').addEventListener('click', () => void screenshotAnswer(true));
  $('#clear-transcript').addEventListener('click', () => void clearTranscript());
  $('#overlay-opacity').addEventListener('input', event => { $('#overlay-opacity-value').textContent = `${event.target.value}%`; });
  $('#overlay-opacity').addEventListener('change', event => void saveOverlayPreferences({ opacity: Number(event.target.value) / 100 }));
  $('#overlay-passthrough').addEventListener('change', event => void saveOverlayPreferences({ clickThrough: event.target.checked }));
  $('#overlay-position').addEventListener('change', event => void saveOverlayPreferences({ position: event.target.value }));
  $('#overlay-vertical').addEventListener('change', event => void saveOverlayPreferences({ vertical: event.target.value, position: state.overlayPreferences.position === 'custom' ? 'center' : state.overlayPreferences.position }));
  $$('[data-place]').forEach(button => button.addEventListener('click', () => { if (bridge?.moveOverlay) void bridge.moveOverlay({ action: button.dataset.place }).catch(error=>toast(message(error),true)); }));
  $('#generate-notes').addEventListener('click', () => void generateNotes());
  $('#auto-answer').addEventListener('change', () => { if (!$('#auto-answer').checked) clearAutoAnswer(); try { localStorage.setItem('parakeet-auto-draft', String($('#auto-answer').checked)); } catch {} });
  window.addEventListener('hashchange', () => setView(location.hash.slice(1)));
  $('#question-form').addEventListener('submit', e => { e.preventDefault(); void generateAnswer(); });
  $('#question-input').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void generateAnswer(); } });
  $('#capture-button').addEventListener('click', () => void toggleListening());
  $('#new-session').addEventListener('click', () => void newSession());
  $('#history-new-session').addEventListener('click', () => void newSession());
  $('#cancel-answer').addEventListener('click', () => void cancelGeneration());
  $('#export-current').addEventListener('click', () => void exportSession(state.active));
  $('#export-transcript').addEventListener('click', () => void exportSession(state.active, 'txt'));
  $$('[data-style]').forEach(button => button.addEventListener('click', () => setStyle(button.dataset.style)));
  $('#transcript-content').addEventListener('click', e => {
    if (e.target.closest('#show-all-transcript')) { state.showAllTranscript = true; renderTranscript(); return; }
    if (e.target.closest('#sample-transcript')) {
      appendTranscript('Tell me about a time you had to make a difficult decision with incomplete information.', 'sample');
      $('#question-input').value = state.active.transcript.at(-1).text;
      toast('Sample question added. AI generation still requires your own provider.');
    }
    const button = e.target.closest('[data-segment]');
    if (button) { $('#question-input').value = state.active.transcript[Number(button.dataset.segment)].text; $('#question-input').focus(); }
    const edit = e.target.closest('[data-edit-segment]'); if (edit) void editTranscript(Number(edit.dataset.editSegment));
  });
  $('#copy-answer').addEventListener('click', async () => { try { await navigator.clipboard.writeText(state.currentAnswer); toast('Answer copied.'); } catch { toast('Could not access the clipboard. Select the answer text to copy it.', true); } });
  $('#toggle-overlay').addEventListener('click', async () => {
    if (!desktop) { toast('The floating copilot is available in the desktop app.'); return; }
    try { syncOverlay(); state.overlay = await bridge.toggleOverlay(); $('#toggle-overlay').setAttribute('aria-label', state.overlay ? 'Close floating copilot' : 'Open floating copilot'); }
    catch (error) { toast(message(error), true); }
  });
  $('#context-form').addEventListener('input', () => {
    state.context = Object.fromEntries(new FormData($('#context-form')));
    if (state.active) { state.active.context = clone(state.context); state.active.title = sessionTitle(); storeSession(); }
    $('#context-save-status').textContent = 'Saving…';
    clearTimeout(contextTimer); contextTimer = setTimeout(() => void persistWorkspace(), 450);
    updateContextUI();
  });
  $('#context-form').addEventListener('submit', e => e.preventDefault());
  const importResume = async mode => {
    const epoch=state.desktopEpoch;
    if (!desktop) { toast('Paste your resume here, or import a document in the desktop app.'); $('#context-resume').focus(); return; }
    const buttons = [$('#import-resume'), $('#import-resume-ai')]; buttons.forEach(button=>button.disabled=true);
    try {
      const imported = await bridge.importDocument({ mode });
      if(epoch!==state.desktopEpoch||state.desktopPaused)throw new Error('Document review was interrupted. Import it again when ready.');
      if (!imported) return;
      const dialog = $('#resume-review-dialog');
      $('#resume-review-info').textContent = `${imported.name} · ${imported.method} · ${imported.pages ? imported.pages + ' pages · ' : ''}${imported.characters} characters. ${(imported.warnings || []).join(' ')}`;
      $('#resume-review-text').value = imported.text;
      dialog.returnValue='cancel'; dialog.showModal();
      const result=await new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue),{once:true}));
      if(result==='confirm') {
        $('#context-resume').value=$('#resume-review-text').value;
        $('#context-resume').dispatchEvent(new Event('input',{bubbles:true}));
        $('#import-help').textContent=`Applied ${imported.name}. Relevant excerpts will be selected for each question.`;
        toast('Resume reviewed and applied.');
      }
      $('#resume-review-text').value='';
    } catch(error) { toast(`Import failed: ${message(error)}`,true); }
    finally { buttons.forEach(button=>button.disabled=false); }
  };
  $('#import-resume').addEventListener('click',()=>void importResume('local'));
  $('#import-resume-ai').addEventListener('click',()=>void importResume('ai'));
  $('#settings-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!desktop) { toast('Open the desktop app to securely save a provider connection.'); return; }
    const form = new FormData(e.target);
    const settings = { provider: form.get('provider'), baseUrl: form.get('baseUrl').trim(), model: form.get('model').trim(), transcriptionModel: form.get('transcriptionModel').trim(), captureProtection: $('#capture-protection').checked };
    for (const key of ['dataPolicy','answerMode', 'networkMode', 'codingLanguage', 'transcriptionLanguage', 'transcriptionMode', 'transcriptionVocabulary','historyMode','retentionDays']) settings[key] = form.get(key);
    settings.encryptWorkspace=$('#encrypt-workspace').checked;
    const key = form.get('apiKey').trim();
    if (key) settings.apiKey = key;
    $('#settings-error').hidden = true; $('#save-settings').disabled = true; $('#settings-save-status').textContent = 'Saving securely…';
    try {
      state.settings = await bridge.saveSettings(settings);
      await updateProtectionUI();
      $('#provider-key').value = ''; updateConnectionUI();
      state.answerError = ''; renderAnswer(); $('#settings-save-status').textContent = 'Connection saved. Ready for your next request.';
      toast('Provider connection saved.');
    } catch (error) { $('#settings-error').textContent = message(error); $('#settings-error').hidden = false; $('#settings-save-status').textContent = 'Connection was not saved.'; }
    finally { $('#save-settings').disabled = false; }
  });
  $('#reveal-key').addEventListener('click', () => { const input = $('#provider-key'); input.type = input.type === 'password' ? 'text' : 'password'; $('#reveal-key').setAttribute('aria-label', input.type === 'password' ? 'Show API key' : 'Hide API key'); });
  $('#history-search').addEventListener('input', renderHistory);
  $('#history-list').addEventListener('click', e => {
    const open = e.target.closest('[data-open-session]'), download = e.target.closest('[data-export-session]'), remove = e.target.closest('[data-delete-session]');
    if (open) void openSession(open.dataset.openSession);
    if (download) void exportSession(state.sessions.find(s => s.id === download.dataset.exportSession));
    if (remove) void confirmDelete(remove.dataset.deleteSession);
  });
  $('#minimize-window').addEventListener('click', () => bridge?.windowControl('minimize'));
  $('#close-window').addEventListener('click', () => bridge?.windowControl('close'));
  if (desktop) bridge.onShortcut(action => { if (action === 'answer') { location.hash = 'workspace'; if(!sendPendingQuestion()) void generateAnswer(); } else if(action==='retry-answer'){if(!state.requestId&&!state.screenshotPending){if(state.lastRequestKind==='screen')void screenshotAnswer();else if(state.currentQuestion)void generateAnswer({question:state.currentQuestion});}}else if(action==='open-settings'){location.hash='settings';void bridge.windowControl('show');}else if (action === 'hold-question') togglePendingHold(); else if (action === 'dismiss-question') clearAutoAnswer(); else if (action === 'toggle-listening') void toggleListening(); else if (action === 'previous-answer') browseAnswer(-1); else if (action === 'next-answer') browseAnswer(1); else if (action === 'screenshot-answer') void screenshotAnswer(); else if (action === 'clear-transcript') void clearTranscript(); else if (action === 'scroll-up' || action === 'scroll-down') $('#answer-content').scrollBy({ top: action === 'scroll-up' ? -220 : 220, behavior: 'smooth' }); });
}
async function init() {
  hydrateIcons(); bindEvents();
  $('#preview-badge').hidden = desktop; $('#preview-notice').hidden = desktop; $('#window-controls').hidden = !desktop;
  if (!desktop) {
    $('#provider-key').disabled = true; $('#provider-key').placeholder = 'Connect securely in the desktop app';
    $('#save-settings').disabled = true; $('#reveal-key').disabled = true;for(const id of ['export-diagnostics','clear-diagnostics','check-local-provider'])$('#'+id).disabled=true;
    $('#key-storage-help').textContent = 'API keys are accepted only in the desktop app and are never saved in browser storage.';
    $('#settings-save-status').textContent = 'Provider settings are available in the desktop app.';
  }
  try {
    if (desktop) {
      const [workspace, settings] = await Promise.all([bridge.loadWorkspace(), bridge.getSettings()]);
      normalizeWorkspace(workspace); state.settings = { ...state.settings, ...settings };
    } else {
      const stored = localStorage.getItem(STORAGE_KEY); if (stored) normalizeWorkspace(JSON.parse(stored));
    }
    workspaceLoaded = true;
  } catch (error) { toast(`Could not restore your workspace: ${message(error)}`, true); }
  for (const [name, value] of Object.entries(state.context)) { const input = $(`[name="${name}"]`, $('#context-form')); if (input) input.value = value; }
  $('#provider-url').value = state.settings.baseUrl; $('#answer-model').value = state.settings.model; $('#transcription-model').value = state.settings.transcriptionModel;
  $('#provider-type').value = state.settings.provider; $('#capture-protection').checked = state.settings.captureProtection !== false;
  for (const [id, key, fallback] of [['data-policy','dataPolicy','unknown'],['answer-mode','answerMode','balanced'],['network-mode','networkMode','standard'],['coding-language','codingLanguage','auto'],['transcription-language','transcriptionLanguage',''],['transcription-mode','transcriptionMode','SMART']]) $(`#${id}`).value = state.settings[key] ?? fallback;
  $('#history-mode').value=state.settings.historyMode || 'persist';$('#retention-days').value=String(state.settings.retentionDays || 0);$('#encrypt-workspace').checked=state.settings.encryptWorkspace===true;
  $('#transcription-vocabulary').value = (state.settings.transcriptionVocabulary || []).join(', ');
  try { const saved = localStorage.getItem('parakeet-auto-draft'); if (saved !== null) $('#auto-answer').checked = saved === 'true'; } catch {}
  if (desktop && bridge.getStorageStatus) bridge.getStorageStatus().then(value => { if (value.recoveryNotices.length) toast(value.recoveryNotices.join(' '), true); }).catch(() => {});
  void updateProtectionUI(); void refreshMicrophones();
  if (bridge?.onOverlay) bridge.onOverlay(data => {
    const preferences = data.preferences || data;
    if (Number.isFinite(preferences.opacity) && typeof preferences.clickThrough === 'boolean') { state.overlayPreferences = { ...state.overlayPreferences, ...preferences }; renderOverlayPreferences(); }
  });
  if (bridge?.getOverlayPreferences) bridge.getOverlayPreferences().then(preferences => { state.overlayPreferences = preferences; renderOverlayPreferences(); }).catch(error => toast(message(error), true));
  renderOverlayPreferences();
  updateConnectionUI(); updateContextUI(); updateHistoryCount(); setListeningUI();
  setView(location.hash.slice(1) || 'workspace', false);
  renderShortcutStatus();
  if(desktop&&bridge.getRuntime){
    bridge.onProviderStatus?.(value=>{if(value.requestId===state.requestId){state.providerStatus={state:value.state,until:Date.now()+Math.min(300000,Math.max(0,value.retryAfterMs||0))};syncOverlay();}});
    setInterval(()=>{if(state.overlay||state.listening)syncOverlay();},1000);
    window.addEventListener('online',syncOverlay);window.addEventListener('offline',syncOverlay);
    bridge.onAudioTimingStatus?.(value=>{appendTranscript(`Audio timing warning: ${message(value.message)}`,'status');toast(message(value.message),true);});
    bridge.onLifecycle(handleDesktopRuntime);bridge.onShortcutsChanged(renderShortcutStatus);
    const results=await Promise.allSettled([bridge.getRuntime(),bridge.getShortcuts()]);
    if(results[0].status==='fulfilled')handleDesktopRuntime(results[0].value);
    if(results[1].status==='fulfilled')renderShortcutStatus(results[1].value);
  }
  setInterval(updateClock, 1000);
}
void init();
