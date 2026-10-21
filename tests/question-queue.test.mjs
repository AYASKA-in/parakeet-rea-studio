import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../renderer/question-queue.js', import.meta.url), 'utf8');
const { QuestionQueue, questionCue, acceptQuestionSource } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
function fixture(options = {}) { let time = 0; const queue = new QuestionQueue({now:()=>time,...options}); return {queue,advance:ms=>time+=ms,status:config=>queue.status({sessionId:'s',...config}),push:text=>queue.push(text,'system','s')}; }

test('fixed cue corpus includes indirect requests and Hindi/Telugu cues without matching question words inside statements', () => {
  const positives = ['What is a cache', 'Why use a queue.', 'How would you debug this', 'When should retries stop', 'Which index helps here', 'Could you explain transactions', 'Would you describe your approach', 'Have you used SQL', 'Tell me about your project', 'Please, walk me through it', 'Implement binary search', 'Write a function to merge lists', 'Debug the following code', 'Solve this problem', 'क्या आप समझा सकते हैं', 'कैसे काम करता है', 'ఎలా పని చేస్తుంది', 'ఎందుకు ఇది అవసరం', 'Can we cache this?', '这是什么意思？'];
  const negatives = ['I know what caching means.', 'This is why we retry.', 'We discussed how the code works.', 'The implementation is complete.', 'What a pleasant day.', 'My job title is software engineer.', 'The function is called explain_cache.', 'Thanks for joining.', 'Use O(1) memory.', 'Do not use recursion.', 'Good morning.', 'It took 7 milliseconds.'];
  for (const text of positives) assert.equal(questionCue(text),true,text);
  for (const text of negatives) assert.equal(questionCue(text),false,text);
});
test('multi-part finals preserve negation, numeric constraints and technical identifiers', () => {
  const f=fixture();f.push('Implement lookup for user_id and');f.advance(1800);assert.equal(f.status().reason,'unfinished');
  f.push('Do not use recursion. Use O(1) space and at most 2 passes.');
  assert.equal(f.queue.pending.text,'Implement lookup for user_id and Do not use recursion. Use O(1) space and at most 2 passes.');
  f.advance(2199);assert.equal(f.status().reason,'waiting');f.advance(1);assert.equal(f.status().reason,'ready');
});
test('unfinalized continuation blocks a draft even after quiet/cooldown, then joins the final', () => {
  const f=fixture();f.push('Explain retries.');f.advance(1000);f.queue.interim('Do not retry', 'system','s');
  f.advance(10000);assert.equal(f.status().reason,'interim');
  f.push('Do not retry HTTP 401.');f.advance(2200);assert.equal(f.status().reason,'ready');
  assert.match(f.queue.take().text,/Do not retry HTTP 401/);assert.equal(f.status().reason,'empty');
});
test('local audio activity postpones WAV drafting while speech is still being recorded', () => {
  const f=fixture();f.push('Explain an API.');f.advance(2000);f.queue.activity('system','s');
  f.advance(1000);assert.equal(f.status().reason,'waiting');f.advance(1200);assert.equal(f.status().reason,'ready');
});
test('mode quiet windows and cooldown are both respected', () => {
  const f=fixture();f.push('Describe a queue.');f.advance(1500);
  assert.equal(f.status({mode:'fast'}).reason,'ready');assert.equal(f.status({mode:'balanced'}).reason,'waiting');
  assert.equal(f.status({mode:'deep',lastStartedAt:0}).delay,3500);f.advance(3500);assert.equal(f.status({mode:'deep',lastStartedAt:0}).reason,'ready');
});
test('pause and cancellation are explicit, and another source cannot cancel the pending question', () => {
  const f=fixture();f.push('Explain a cache.');f.push('Hold on.');f.advance(5000);assert.equal(f.status().reason,'held');
  f.push('Include TTL and invalidation.');f.advance(2200);assert.equal(f.status().reason,'ready');assert.doesNotMatch(f.queue.pending.text,/Hold on/);
  f.queue.push('Never mind.','microphone','s');assert.ok(f.queue.pending);f.push('Never mind.');assert.equal(f.status().reason,'empty');
});
test('queued follow-up constraints still join after a slow answer rather than being silently dropped', () => {
  const f=fixture();f.push('Design a database.');f.advance(20000);f.push('It must support 2000 writes per second.');
  assert.match(f.queue.pending.text,/2000 writes per second/);f.advance(2200);assert.equal(f.status().reason,'ready');
});
test('overflow prevents automatic use of a truncated question and remains bounded', () => {
  const f=fixture({maxChars:70});f.push('Explain a cache.');f.push('Use the full workload and include '+ 'x'.repeat(200));f.advance(5000);
  assert.equal(f.status().reason,'overflow');assert.equal(f.queue.pending.text.length,70);
});
test('duplicate/cumulative finals do not duplicate words or repeatedly answer the same question', () => {
  const f=fixture();f.push('Explain a cache.');f.push('Explain a cache.');assert.equal(f.queue.pending.text,'Explain a cache.');
  f.push('Explain a cache. Include TTL.');assert.equal(f.queue.pending.text,'Explain a cache. Include TTL.');
  const question=f.queue.take();f.queue.markSent(question.text,'s');assert.equal(f.push('Explain a cache. Include TTL.'),false);
  f.advance(30001);assert.equal(f.push('Explain a cache. Include TTL.'),true);
});
test('expired questions require review, clear removes interim state, and sessions do not share pending text', () => {
  const f=fixture();f.push('Explain caching.');f.advance(45000);assert.equal(f.status().reason,'expired');
  f.queue.activity('system','s');assert.equal(f.status().reason,'expired');
  f.queue.interim('Partial','system','s');f.queue.clear();assert.equal(f.queue.partials.size,0);assert.equal(f.status().reason,'empty');
  f.queue.push('Explain queues.','system','next');assert.equal(f.status().reason,'empty');assert.equal(f.queue.pending.sessionId,'next');
});
test('audio gaps require review even after the next finalized continuation', () => {
  const f=fixture();f.push('Explain retries.');f.queue.hold('system','s');f.push('Use exponential backoff.');f.advance(5000);
  assert.equal(f.status().reason,'review');assert.match(f.queue.take().text,/Use exponential backoff/);
  f.queue.hold('system','s');f.push('Explain a cache.');f.advance(5000);assert.equal(f.status().reason,'review');
  f.push('Never mind.');f.push('Explain queues.');f.advance(2200);assert.equal(f.status().reason,'ready');
});
test('both-source routing excludes microphone and unknown sources, and corrections require recent answer context', () => {
  for(const [selected,source,expected] of [['both','microphone',false],['both','system',true],['system','microphone',false],['microphone','microphone',true],['both','audio',false]]) assert.equal(acceptQuestionSource(selected,source),expected);
  const f=fixture();assert.equal(f.push('Actually use O(1) space.'),false);f.queue.markSent('Explain a sort.','s');assert.equal(f.push('Actually use O(1) space.'),true);
});
test('duplicate suppression preserves case-sensitive identifiers and punctuation inside numeric literals', () => {
  const f=fixture();f.push('Explain userID and version 1.5.');f.push('Explain userId and version 1.6.');
  assert.match(f.queue.pending.text,/userID/);assert.match(f.queue.pending.text,/userId/);
  assert.match(f.queue.pending.text,/1\.5/);assert.match(f.queue.pending.text,/1\.6/);
});

test('unfinished comparator waits for its number and preserves explicit correction',()=>{const f=fixture();f.push('Implement a retry strategy with at most');f.advance(6000);assert.equal(f.status().reason,'unfinished');f.push('15 attempts, not 50.');f.advance(6000);assert.equal(f.status().reason,'ready');assert.match(f.queue.take().text,/15 attempts, not 50/);});
