import { renderAnswerText } from './answer-format.js';
const bridge = window.copilot;
const $ = selector => document.querySelector(selector);
document.querySelectorAll('[data-place]').forEach(button => button.addEventListener('click', () => {
  bridge?.moveOverlay({ action: button.dataset.place }).catch(error => { $('#overlay-answer').textContent = error.message; });
}));
function render(data = {}) {
  const question = String(data.question || '');
  const answer = String(data.answer || '');
  const pending = String(data.pendingQuestion || '');
  $('#overlay-pending').hidden = !pending;
  $('#overlay-pending-text').textContent = pending;
  $('#overlay-hold-question').textContent=data.pendingHeld?'Resume auto draft':'Hold';
  $('#overlay-pending-status').textContent = String(data.pendingStatus || '');
  $('#overlay-generate-label').textContent = pending ? 'Send pending' : 'Draft answer';
  $('#overlay-question').textContent = question; $('#overlay-question').hidden = !question;
  renderAnswerText($('#overlay-answer'), answer || (question ? 'Use Draft answer to get a starting point for this question.' : 'Your answer drafts will appear here. Ask a question in your main workspace to get started.'));
  $('#overlay-answer').classList.toggle('empty', !answer);
  $('#overlay-status').innerHTML = `<i></i>${data.listening ? 'Listening' : 'Audio off'}`;
  $('#overlay-status').classList.toggle('listening', Boolean(data.listening));
  $('#overlay-listen-label').textContent = data.listening ? 'Stop listening' : 'Start listening';
  const count = Number(data.answerCount || 0), index = Number(data.answerIndex ?? count - 1);
  $('#overlay-position-label').textContent = count ? `${index + 1} / ${count}` : 'No answers yet';
  $('#overlay-previous').disabled = Boolean(data.generating) || index <= 0;
  $('#overlay-next').disabled = Boolean(data.generating) || index >= count - 1;
  $('#overlay-generate').disabled = Boolean(data.generating) || Boolean(pending&&!data.pendingCanSend);
  $('#overlay-screenshot').disabled = Boolean(data.generating);
  const recovery=data.recovery||{};$('#overlay-sources').replaceChildren(...(recovery.sources||[]).map(source=>{const span=document.createElement('span');span.textContent=source.label+': '+source.state;return span;}));
  $('#overlay-connection').textContent=(recovery.status||'')+(recovery.wait?' · '+recovery.wait+'s':'');$('#overlay-retry').textContent=recovery.retryLabel||'Retry answer';$('#overlay-retry').hidden=!recovery.retry||Boolean(data.generating);$('#overlay-settings').hidden=!recovery.needsSettings;$('#overlay-error').hidden=!recovery.hasError;
  const preferences = data.preferences || data;
  if (Number.isFinite(preferences.opacity)) {
    document.documentElement.style.setProperty('--glass-opacity', String(preferences.opacity));
    $('#floating-opacity').value = Math.round(preferences.opacity * 100);
    $('#floating-opacity-value').textContent = `${Math.round(preferences.opacity * 100)}%`;
  }
  if (typeof preferences.clickThrough === 'boolean') $('#floating-passthrough').checked = preferences.clickThrough;
}
function action(value) {
  if (!bridge?.requestAction) { $('#overlay-answer').textContent = 'The floating copilot needs the desktop app. Open your main workspace to continue.'; return; }
  Promise.resolve(bridge.requestAction(value)).catch(error => { $('#overlay-answer').textContent = error.message || 'Could not reach the main workspace.'; });
}
$('#close-overlay').addEventListener('click', () => action('close-overlay'));
$('#overlay-listen').addEventListener('click', () => action('toggle-listening'));
$('#overlay-generate').addEventListener('click', () => action('answer'));
$('#overlay-dismiss-question').addEventListener('click',()=>action('dismiss-question'));
$('#overlay-hold-question').addEventListener('click',()=>action('hold-question'));
if (bridge?.onOverlay) bridge.onOverlay(render);
if (bridge?.getOverlay) bridge.getOverlay().then(render).catch(() => render());
else render();

$('#overlay-previous').addEventListener('click', () => action('previous-answer'));
$('#overlay-next').addEventListener('click', () => action('next-answer'));
$('#overlay-screenshot').addEventListener('click', () => action('screenshot-answer'));
$('#overlay-retry').addEventListener('click',()=>action('retry-answer'));$('#overlay-settings').addEventListener('click',()=>action('open-settings'));
$('#overlay-hide').addEventListener('click', () => action('hide-overlay'));
async function savePreferences(change) {
  try { const preferences = await bridge.setOverlayPreferences(change); renderPreferences(preferences); }
  catch (error) { $('#overlay-answer').textContent = error.message || 'Could not update overlay preferences.'; }
}
function renderPreferences(preferences) {
  document.documentElement.style.setProperty('--glass-opacity', String(preferences.opacity));
  $('#floating-opacity').value = Math.round(preferences.opacity * 100);
  $('#floating-opacity-value').textContent = `${Math.round(preferences.opacity * 100)}%`;
  $('#floating-passthrough').checked = preferences.clickThrough;
}
$('#floating-opacity').addEventListener('input', event => {
  $('#floating-opacity-value').textContent = `${event.target.value}%`;
  document.documentElement.style.setProperty('--glass-opacity', String(Number(event.target.value) / 100));
});
$('#floating-opacity').addEventListener('change', event => void savePreferences({ opacity: Number(event.target.value) / 100 }));
$('#floating-passthrough').addEventListener('change', event => void savePreferences({ clickThrough: event.target.checked }));
if (bridge?.onOverlayCommand) bridge.onOverlayCommand(command => {
  if (command === 'scroll-up' || command === 'scroll-down') $('.floating-content').scrollBy({ top: command === 'scroll-up' ? -220 : 220, behavior: 'smooth' });
});
