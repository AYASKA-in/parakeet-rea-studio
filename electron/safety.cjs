const { sanitizeContext, answerPolicy } = require('./core.cjs');

function credentialBinding(settings) { return `${settings.provider}|${new URL(settings.baseUrl).origin}`; }
function localEndpoint(settings) { return ['localhost','127.0.0.1','[::1]'].includes(new URL(settings.baseUrl).hostname); }
function requireDataPolicy(settings, operation = 'answer') {
  if (!['unpaid','reviewed','local'].includes(settings.dataPolicy)) throw new Error('Choose a data-use policy in Settings before sending content.');
  if (settings.dataPolicy === 'local' && !localEndpoint(settings)) throw new Error('Local mode requires a loopback API URL. The local server controls its own downstream processing.');
  if (operation === 'pdf' && settings.dataPolicy === 'unpaid') throw new Error('AI PDF upload is disabled in unpaid practice mode. Import locally, or use a provider whose terms permit this document.');
}
function redactContacts(value = '') {
  return String(value).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email removed]')
    .replace(/(?:\+\d{1,3}[ .()-]*)(?:\d[ .()-]*){9,13}\d(?!\d)/g,'[phone removed]')
    .replace(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[^\s|]+/gi,'[profile link removed]');
}
function prepareOutbound(input, settings) {
  requireDataPolicy(settings);
  const practice = settings.dataPolicy === 'unpaid';
  if(practice && input.kind === 'notes') throw new Error('Saved-session summaries require a provider/data arrangement permitting the transcript. Choose Reviewed or Local mode.');
  const personal = /\b(my|our|your)\b.{0,60}\b(experience|project|work|role|background|resume|cv|achievement)\b|tell me about yourself|introduce me/i.test(input.question || '');
  const technical = answerPolicy(input).coding || input.style === 'technical';
  const context = input.kind === 'notes' || practice || (technical && !personal) ? {} : sanitizeContext(input.context);
  return { ...input, context: Object.fromEntries(Object.entries(context).map(([k,v])=>[k,redactContacts(v)])),
    question: redactContacts(input.question || ''),
    transcript: practice && input.kind !== 'notes' ? '' : redactContacts(input.transcript || ''),
    previousAnswers: practice || input.kind === 'notes' ? [] : (input.previousAnswers || []).slice(-3).map(a=>({question:redactContacts(a.question || ''),answer:redactContacts(a.answer || '')})),
  };
}
function personalDataRemoved(before, after) {
  const contextChanged = JSON.stringify(before.context || {}) !== JSON.stringify(after.context || {});
  if (contextChanged) return true; // Rewrite recovery snapshots on edits, including same-length replacements.
  return (before.sessions || []).some(old=>{
    const next=(after.sessions || []).find(s=>s.id===old.id);
    return !next || JSON.stringify(old.context || {})!==JSON.stringify(next.context || {}) ||
      (next.transcript?.length || 0)<(old.transcript?.length || 0) || (next.exchanges?.length || 0)<(old.exchanges?.length || 0);
  });
}
module.exports={credentialBinding,localEndpoint,requireDataPolicy,redactContacts,prepareOutbound,personalDataRemoved};
