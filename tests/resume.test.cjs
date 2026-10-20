const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeResumeText, resumeEvidence, inspectResume } = require('../electron/resume.cjs');
const { buildMessages, answerPolicy } = require('../electron/core.cjs');
test('resume normalization preserves dates, code identifiers, numbers and meaningful hyphens', () => {
  assert.equal(normalizeResumeText('\ufeffEXPERIENCE\r\n  Full-stack\tC++   2022–2025\nRevenue +42.5%\u00a0\n'), 'EXPERIENCE\nFull-stack C++ 2022–2025\nRevenue +42.5%');
  assert.match(inspectResume('scan').warnings.join(' '), /Very little text/);
});
test('question retrieval includes late resume evidence and keeps full local context intact', () => {
  const resume = Array.from({length:200},(_,i)=>`General project ${i}\nBuilt internal tools and worked with a team.\n`).join('\n') + '\nPROJECTS\nOrion migration: Kubernetes PostgreSQL. Reduced latency by 37%.\n';
  const evidence = resumeEvidence(resume, 'Tell me about Kubernetes and PostgreSQL migration', 1800);
  assert.match(evidence,/Orion migration/); assert.match(evidence,/37%/); assert.ok(evidence.length<=1800);
  const messages=buildMessages({question:'Kubernetes migration',context:{resume},answerMode:'fast'});
  assert.match(messages[1].content,/Orion migration/); assert.ok(resume.length>10000);
});
test('screen Fast bounds reasoning even for coding; Detail explicitly requests care',()=>{
  assert.equal(answerPolicy({screenAnalysis:true,screenQuality:'fast',style:'coding',answerMode:'deep'}).thinkingLevel,'LOW');
  assert.equal(answerPolicy({screenAnalysis:true,screenQuality:'detail',answerMode:'fast'}).thinkingLevel,'HIGH');
});

test('dated resume answers use a trusted current date and request status confirmation instead of inventing it',()=>{
  const messages=buildMessages({question:'Introduce me',currentDate:'2026-10-20',context:{resume:'Incoming apprentice, August 2026. B.Tech June 2026.'}});
  assert.match(messages[0].content,/2026-10-20/);
  assert.match(messages[0].content,/start date has passed/);
  assert.match(messages[0].content,/do not assume they started, completed/);
  assert.match(messages[0].content,/Do not describe a past graduation date as an upcoming graduation/);
});
