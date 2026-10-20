async function readBoundedText(response, limit = 2 * 1024 * 1024) {
  const chunks=[];let bytes=0;
  for await (const chunk of response.body) { bytes+=chunk.length;if(bytes>limit)throw new Error('Provider JSON response exceeded the size limit.');chunks.push(Buffer.from(chunk)); }
  return Buffer.concat(chunks).toString('utf8');
}
async function readBoundedJson(response,limit) {
  const text=await readBoundedText(response,limit);
  try { return JSON.parse(text); } catch { throw new Error('Provider returned invalid JSON.'); }
}
function jsonAnswer(payload, provider, emit) {
  if(!payload || typeof payload !== 'object' || Array.isArray(payload))throw new Error('Provider returned an invalid JSON response.');
  if(payload.error)throw new Error(payload.error.message || 'Provider error.');
  const gemini=provider==='gemini', candidate=payload.candidates?.[0], choice=payload.choices?.[0];
  if(gemini && payload.promptFeedback?.blockReason)throw new Error(`Gemini blocked this prompt: ${payload.promptFeedback.blockReason}`);
  const text=gemini ? (candidate?.content?.parts || []).filter(p=>!p.thought).map(p=>p.text || '').join('') : choice?.message?.content;
  if(typeof text==='string') {
    if(text.length>200000)throw new Error('Provider response exceeded the size limit.');
    emit(text);
  }
  const reason=gemini ? candidate?.finishReason : choice?.finish_reason;
  if(reason===(gemini?'MAX_TOKENS':'length'))throw new Error('Answer reached the output limit. The partial draft was retained.');
  if(reason!==(gemini?'STOP':'stop'))throw new Error(`Provider response did not complete (${reason || 'missing finish reason'}). The partial draft was retained.`);
  return text;
}
module.exports={readBoundedText,readBoundedJson,jsonAnswer};

function redactProviderFailure(error, secret = '') {
  let message=String(error?.message || 'Provider request failed.');
  if(secret)for(const form of new Set([secret,encodeURIComponent(secret)]))message=message.split(form).join('[redacted]');
  const sanitized=new Error(message.slice(0,2000));sanitized.name=['AbortError','TimeoutError','TypeError'].includes(error?.name)?error.name:'Error';return sanitized;
}
module.exports.redactProviderFailure=redactProviderFailure;
