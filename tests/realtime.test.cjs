const test=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const load=name=>import(pathToFileURL(path.resolve(__dirname,'../renderer/'+name)).href);

test('a late spoken correction retains its original question and requires review',async()=>{
 const {QuestionQueue}=await load('question-queue.js');let now=0;const q=new QuestionQueue({now:()=>now});
 q.push('Implement a cache with at most 50 entries.','system','s');
 const original=q.take();q.markSent(original.text,'s',original);now=500;
 q.push('Actually use at most 15 entries, not 50.','system','s');now=6000;
 assert.match(q.pending.text,/Implement a cache/);assert.match(q.pending.text,/15 entries, not 50/);
 assert.equal(q.status({sessionId:'s'}).reason,'review');
 assert.equal(q.pending.supersedesRevision,original.revision);assert.ok(q.pending.revision>original.revision);
});
test('correction context cannot cross audio sources or survive an explicit clear',async()=>{
 const {QuestionQueue}=await load('question-queue.js');const q=new QuestionQueue({now:()=>0});
 q.markSent('Implement a cache.','s',{source:'microphone',revision:1});
 assert.equal(q.push('Actually use O(1) space.','system','s'),false);
 q.clear();assert.equal(q.push('Actually use O(1) space.','microphone','s'),false);
});
test('explicitly held questions stay held while more finalized constraints arrive',async()=>{
 const {QuestionQueue}=await load('question-queue.js');let now=0;const q=new QuestionQueue({now:()=>now});
 q.push('Implement a cache.','system','s');q.setHeld(true,'s');q.push('Use O(1) lookup.','system','s');now=5000;
 assert.equal(q.status({sessionId:'s'}).reason,'held');q.setHeld(false,'s');now+=2200;
 assert.equal(q.status({sessionId:'s'}).reason,'ready');
});
test('screen timings include capture and never invent completion for a capture failure',async()=>{
 const {createAttemptTiming}=await load('attempt-timing.js');let now=100;
 const attempt=createAttemptTiming({kind:'screen',now:()=>now});attempt.mark('captureStartMs');now=600;attempt.mark('captureEndMs');
 now=650;attempt.mark('requestMs');now=950;attempt.mark('firstTextMs');now=1000;attempt.mark('firstRenderedMs');now=1200;attempt.mark('completedMs');attempt.finish('success');
 assert.equal(attempt.metric.captureEndMs,500);assert.equal(attempt.metric.firstTextMs,850);assert.equal(attempt.metric.firstRenderedMs,900);
 const failed=createAttemptTiming({kind:'screen',now:()=>now});failed.mark('captureStartMs');now+=200;failed.finish('error','capture');
 assert.equal(failed.metric.completedMs,null);assert.equal(failed.metric.attemptEndMs,200);assert.equal(failed.metric.save,'not-applicable');
});
test('first stage measurements are immutable and estimated speech end stays explicitly identified',async()=>{
 const {createAttemptTiming}=await load('attempt-timing.js');let now=1000;
 const attempt=createAttemptTiming({kind:'audio',speechEndedAt:500,finalAt:750,now:()=>now});
 attempt.mark('requestMs');now=1200;attempt.mark('firstTextMs');now=1300;attempt.mark('firstTextMs');
 assert.equal(attempt.metric.firstTextMs,700);assert.equal(attempt.metric.endpointSource,'estimated-audio');assert.equal(attempt.metric.finalTranscriptMs,250);
 const unknown=createAttemptTiming({kind:'audio',now:()=>now});assert.equal(unknown.metric.speechEndMs,null);
});
test('diagnostics retain failure denominators, capture durations and explicit timing limitations',()=>{
 const {createDiagnostics}=require('../electron/diagnostics.cjs');const d=createDiagnostics();
 d.add({kind:'screen',captureStartMs:0,captureEndMs:500,requestMs:550,firstUsefulTextMs:900,firstRenderedMs:950,completedMs:1500,attemptEndMs:1510,outcome:'success',save:'durable',endpointSource:'capture-action'});
 d.add({kind:'screen',captureStartMs:0,attemptEndMs:100,outcome:'error',failureCategory:'capture',save:'not-applicable',endpointSource:'capture-action',image:'private'});
 const report=d.report(),g=report.groups[0];assert.equal(report.schemaVersion,3);assert.equal(g.attempts,2);assert.equal(g.failureCategories.capture,1);
 assert.equal(g.durations.capture.p50,500);assert.equal(g.durations.screenToFirstUseful.p50,900);assert.equal(g.durations.screenToComplete.samples,1);
 assert.equal(g.durations.attempt.samples,2);assert.equal(g.saveFailures,0);assert.match(report.measurementNotes.firstUsefulTextMs,/proxy/i);
 assert.ok(!JSON.stringify(report).includes('private'));assert.notEqual(report.rows[0].attemptId,report.rows[1].attemptId);
});

test('resume company mentions, target employers and substring matches are not employment evidence',()=>{
 const {groundingAssessment:g}=require('../electron/grounding.cjs');
 for(const resume of ['Skills: Google Cloud and SQL.','Target company: Google.','Built integration with Google APIs.','Engineer at GoogleCloud.','I have never worked for Google.']){
  assert.equal(g('Did I work at Google?',resume).missingEmployer,'Google',resume);
 }
});
test('employment preflight returns source lines and asks for clarification on conflicting evidence',()=>{
 const {groundingAssessment:g}=require('../electron/grounding.cjs');
 const support=g('Have I ever worked for Google?','EXPERIENCE\nGoogle\nSoftware Engineer | 2020-2022\nSKILLS\nSQL');
 assert.equal(support.status,'supported');assert.deepEqual(support.evidenceLines,[2]);
 const conflict=g('Did I work at Google?','Engineer at Google.\nI have never worked for Google.');
 assert.equal(conflict.status,'conflicting');assert.equal(conflict.missingEmployer,'Google');assert.deepEqual(conflict.conflictLines,[2]);
 assert.equal(g('Did I work at Google?','PROJECTS\nGoogle\nSoftware Engineer | 2020-2022').status,'unsupported');
});
test('employment preflight treats company punctuation as data rather than regex',()=>{
 const {groundingAssessment:g}=require('../electron/grounding.cjs');
 assert.equal(g('Did I work at Acme (Labs)+?','Engineer at Acme (Labs)+.').status,'supported');
 assert.equal(g('Did I work at Acme Inc.?','Engineer at Acme Inc.').status,'supported');
 assert.equal(g('Did I work at Acme (Labs)+?','Engineer at Acme Labs.').status,'unsupported');
});

test('a known finalized transcript keeps queue time even when speech end is unknown',async()=>{
 const {createAttemptTiming}=await load('attempt-timing.js');const attempt=createAttemptTiming({kind:'audio',finalAt:750,now:()=>1000});attempt.mark('requestMs');assert.equal(attempt.metric.endpointSource,'final-transcript');assert.equal(attempt.metric.speechEndMs,null);assert.equal(attempt.metric.finalTranscriptMs,0);assert.equal(attempt.metric.requestMs,250);
});
test('negative employment wording never becomes affirmative evidence',()=>{
 const {groundingAssessment:g}=require('../electron/grounding.cjs');for(const resume of ['I was not employed by Google.','I have not worked at Google.'])assert.equal(g('Did I work at Google?',resume).status,'unsupported');
});
test('diagnostics explicitly disclose retention loss and reject malformed payloads without content',()=>{
 const {createDiagnostics}=require('../electron/diagnostics.cjs');const d=createDiagnostics(2);d.add(null);d.add({outcome:'error',failureCategory:'complete',secret:'private'});d.add({outcome:'success'});const report=d.report();assert.equal(report.totalAttempts,3);assert.equal(report.attempts,2);assert.equal(report.evictedAttempts,1);assert.equal(report.rows[0].failureCategory,'error');assert.ok(!JSON.stringify(report).includes('private'));d.clear();assert.equal(d.report().totalAttempts,0);
});

test('corrections remain attached during a slow active answer even with question punctuation',async()=>{
 const {QuestionQueue}=await load('question-queue.js');let now=0;const q=new QuestionQueue({now:()=>now});q.push('Implement a cache.','system','s');const original=q.take();q.markSent(original.text,'s',{...original,active:true});now=60000;q.push('Actually, can you use O(1) space?','system','s');assert.equal(q.pending.correction,true);assert.match(q.pending.text,/Implement a cache/);assert.equal(q.pending.supersedesRevision,original.revision);q.completeSent(original.revision);assert.equal(q.lastSent.active,false);
});
test('negated job titles and contractions do not confirm employment',()=>{
 const {groundingAssessment:g}=require('../electron/grounding.cjs');for(const resume of ["I wasn't employed by Google.",'I was not an engineer at Google.'])assert.equal(g('Did I work at Google?',resume).status,'unsupported');
});

test('overlay distinguishes slow first response from a stalled partial stream and permits cancellation',async()=>{
 const {recoveryView}=await load('recovery-state.js');
 const waiting=recoveryView({provider:{state:'requesting'},progress:{active:true,elapsedMs:6000,silentMs:6000,hasText:false}});
 assert.match(waiting.status,/Still waiting/);assert.equal(waiting.canCancel,true);assert.equal(waiting.retry,false);
 const paused=recoveryView({provider:{state:'requesting'},progress:{active:true,elapsedMs:8000,silentMs:5500,hasText:true}});
 assert.match(paused.status,/paused/);assert.equal(paused.canCancel,true);
 assert.match(recoveryView({provider:{state:'requesting'},progress:{active:true,elapsedMs:8000,silentMs:50,hasText:true}}).status,/Receiving/);
 assert.match(recoveryView({provider:{state:'quota'},progress:{active:true,elapsedMs:8000}}).status,/quota/);
 assert.equal(recoveryView({provider:{state:'error'},progress:{active:true}}).retry,false);
 assert.equal(recoveryView({provider:{state:'complete'}}).canCancel,false);
});
