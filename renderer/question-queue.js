// Case and punctuation can be meaningful in code identifiers and numeric literals.
const normalize = text => text.replace(/\s+/gu, ' ').trim();
const paused = /^(?:hold on|wait(?: a second| a moment)?|one moment)[.!]?$/iu;
const cancelled = /^(?:never mind|nevermind|cancel (?:that|the question)|ignore (?:that|the last question))[.!]?$/iu;
const unfinished = text => /(?:[,;:\-–]|\b(?:and|or|but|with|without|using|including|because|such as|for example|also)|और|లేదా)\s*[.!?]?$/iu.test(text);

export const acceptQuestionSource = (selected, source) => selected === 'both' ? source === 'system' : selected === source;

export function questionCue(text, followUp = false) {
  if (/[?？]/u.test(text)) return true;
  const clean = text.replace(/^(?:(?:okay|ok|so|now|please)[,\s]+)+/iu, '');
  if (/^what (?:a|an)\b/iu.test(clean)) return false;
  if (/^(?:what|why|how|when|where|which|who|whose|can you|could you|would you|will you|do you|did you|have you|is there|are there|tell me|describe|explain|walk me|implement|solve|debug|compare|discuss|(?:design|build) (?:a|an|the)|write (?:a |the )?(?:function|program|query|code))\b/iu.test(clean)) return true;
  if (/^(?:क्या|क्यों|कैसे|कब|कहाँ|कौन|बताइए|समझाइए|ఎలా|ఏమిటి|ఎందుకు|ఎప్పుడు|ఎక్కడ|వివరించండి)(?:\s|[?？])/u.test(clean)) return true;
  return followUp && /^(?:actually|correction|instead|no[,\s]|sorry[,\s])/iu.test(clean) && /\b(?:use|not|without|must|limit|maximum|minimum|space|time|instead|don't|do not)\b/iu.test(clean);
}

// Local routing only. Model answers still come from the configured provider.
export class QuestionQueue {
  constructor({ now = () => performance.now(), maxChars = 4000 } = {}) {
    this.activityTimes = new Map(); this.now = now; this.maxChars = maxChars; this.pending = null; this.partials = new Map(); this.reviewSources = new Map();
  }
  clear() { this.pending = null; this.partials.clear(); this.reviewSources.clear(); this.activityTimes.clear(); }
  interim(text, source, sessionId) {
    if (text?.trim()) this.partials.set(source, sessionId); else this.partials.delete(source);
    if (this.pending?.sessionId === sessionId && this.pending.source === source) this.pending.at = this.now();
  }
  activity(source, sessionId) {
    this.activityTimes.set(source,{sessionId,at:this.now()});
    if (this.pending?.sessionId === sessionId && this.pending.source === source && this.now() - this.pending.at < 45000) this.pending.at = this.now();
  }
  hold(source, sessionId) {
    this.reviewSources.set(source,sessionId);
    if (this.pending?.sessionId === sessionId && this.pending.source === source) this.pending.reviewRequired = true;
  }
  push(text, source, sessionId) {
    if (typeof text !== 'string' || !text.trim() || !sessionId) return false;
    this.partials.delete(source);
    const now = this.now(), clean = text.trim();
    if (this.pending?.sessionId !== sessionId) this.pending = null;
    const current = this.pending;
    if (current && current.source !== source) return false;
    if (cancelled.test(clean)) { this.pending = null; this.reviewSources.delete(source); return true; }
    if (current && paused.test(clean)) { current.held = true; current.at = now; return true; }
    const recent = this.lastSent?.sessionId === sessionId && now - this.lastSent.at < 30000;
    if (recent && normalize(clean) === this.lastSent.key && !current) return false;
    const continuation = current && now - current.at < 45000;
    if (!continuation && !questionCue(clean, recent)) return false;
    if (continuation && normalize(current.lastSegment) === normalize(clean)) return false;
    const combined = continuation ? (clean.startsWith(current.text) ? clean : `${current.text} ${clean}`) : clean;
    const activity = this.activityTimes.get(source);
    this.pending = { speechEndedAt: activity?.sessionId === sessionId ? activity.at : null, finalAt: now, text: combined.slice(0, this.maxChars), source, sessionId, at: now, held: false, reviewRequired: this.reviewSources.get(source)===sessionId || Boolean(continuation && current.reviewRequired), overflow: Boolean(continuation && current.overflow) || combined.length > this.maxChars, lastSegment: clean.slice(0, this.maxChars) };
    return true;
  }
  status({ sessionId, mode = 'balanced', lastStartedAt = -Infinity } = {}) {
    const pending = this.pending;
    if (!pending || pending.sessionId !== sessionId) return { reason: 'empty' };
    if (pending.overflow) return { reason: 'overflow' };
    if (this.partials.get(pending.source) === sessionId) return { reason: 'interim' };
    if (pending.reviewRequired) return { reason: 'review' };
    if (this.now() - pending.at >= 45000) return { reason: 'expired' };
    if (pending.held) return { reason: 'held' };
    if (unfinished(pending.text)) return { reason: 'unfinished' };
    const quiet = mode === 'fast' ? 1500 : mode === 'deep' ? 3000 : 2200;
    const cooldown = mode === 'fast' ? 2000 : mode === 'deep' ? 5000 : 3000;
    const delay = Math.max(quiet - (this.now() - pending.at), cooldown - (this.now() - lastStartedAt), 0);
    return delay > 0 ? { reason: 'waiting', delay } : { reason: 'ready', delay: 0 };
  }
  markSent(text, sessionId) { this.lastSent = { key: normalize(text), sessionId, at: this.now() }; }
  take() { const pending = this.pending; this.pending = null; if(pending) this.reviewSources.delete(pending.source); return pending; }
}
