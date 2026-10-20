// Local, deterministic preparation: never infer qualifications or rewrite metrics.
function normalizeResumeText(value) {
  return String(value || '').normalize('NFC').replace(/\r\n?/g, '\n').replace(/\u00ad/g, '')
    .replace(/[\u200b\ufeff]/g, '').replace(/\u00a0/g, ' ')
    .split('\n').map(line => line.replace(/[\t ]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}
const tokens = text => new Set((text.toLowerCase().match(/[\p{L}\p{N}+#.]{2,}/gu) || []).filter(x => !['the','and','with','for','what','your','have','this','that','from','about','would','could'].includes(x)));
function resumeEvidence(text, question, limit = 8000) {
  text = normalizeResumeText(text);
  if (text.length <= limit) return text;
  const terms = tokens(question), lines = text.split('\n');
  // Overlapping windows retain employer/project headings around a matching bullet.
  const blocks = [];
  for (let i = 0; i < lines.length; i += 6) {
    const excerpt = lines.slice(Math.max(0, i - 2), i + 8).join('\n');
    const words = tokens(excerpt);
    blocks.push({ i, excerpt, score: [...terms].reduce((n, term) => n + (words.has(term) ? 1 : 0), 0) });
  }
  const selected = [{ i: -1, excerpt: text.slice(0, Math.min(1000, Math.floor(limit / 4))) }];
  let used = selected[0].excerpt.length + 200;
  for (const block of blocks.sort((a,b) => b.score - a.score || a.i - b.i)) {
    if (selected.some(x => x.i >= 0 && Math.abs(x.i - block.i) < 12)) continue;
    if (used + block.excerpt.length + 30 > limit) continue;
    selected.push(block); used += block.excerpt.length + 30;
  }
  return '[Selected verbatim resume excerpts; other experience may be omitted. Do not infer missing facts.]\n' + selected.sort((a,b)=>a.i-b.i).map(x=>x.excerpt).join('\n\n[…]\n\n');
}
function inspectResume(text) {
  text = normalizeResumeText(text);
  const warnings = [];
  if (text.length < 120) warnings.push('Very little text was extracted. A scanned PDF may need AI PDF import.');
  if (text.includes('\ufffd')) warnings.push('Some characters could not be decoded; check names and numbers.');
  if (!/experience|employment|projects|education|skills/i.test(text)) warnings.push('No common section headings found. Check the reading order and completeness.');
  if (text.length > 50000) warnings.push('Only the first 50,000 characters can be applied.');
  return { text: text.slice(0, 50000), characters: text.length, warnings };
}
module.exports = { normalizeResumeText, resumeEvidence, inspectResume };
