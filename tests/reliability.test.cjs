const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createStorage } = require('../electron/storage.cjs');
const { fetchWithRetry } = require('../electron/http.cjs');
const { ReliableLive } = require('../electron/reliable-live.cjs');
const { LiveSession } = require('../electron/live-session.cjs');
const { captureSize, CaptureLease } = require('../electron/screen-capture.cjs');
const { overlayPosition, PLACEMENTS } = require('../electron/overlay-layout.cjs');
const { buildMessages, answerPolicy, validateSettings, DEFAULT_SETTINGS, transcriptText, readAnswerStream } = require('../electron/core.cjs');
const until = async condition => { const deadline = Date.now() + 2000; while (!condition()) { if (Date.now() > deadline) throw new Error('Condition timed out'); await new Promise(resolve => setTimeout(resolve, 5)); } };

test('overlay movement supports all anchors, negative monitor origins and visible bounds', () => {
  const area={x:-1920,y:0,width:1920,height:1080}, bounds={x:-800,y:200,width:460,height:560};
  for(const action of PLACEMENTS){const p=overlayPosition(bounds,area,action);assert.ok(p.x>=area.x&&p.x+bounds.width<=0);assert.ok(p.y>=0&&p.y+bounds.height<=1080);}
  assert.equal(overlayPosition(bounds,area,'right').x,bounds.x+32);
  assert.equal(overlayPosition(bounds,area,'down').y,bounds.y+32);
  assert.deepEqual(overlayPosition({...bounds,x:9000,y:-500},area,'restore'),{x:-460,y:0});
  assert.throws(()=>overlayPosition(bounds,area,'bad-action'));
});

test('recent context and follow-up answers are retained within request budgets', () => {
  const messages = buildMessages({ question: 'Implement binary search', transcript: `${'old '.repeat(10000)}LATEST: handle duplicate values`, previousAnswers: [{ question: 'What about empty input?', answer: 'Return -1.' }], answerMode: 'fast', codingLanguage: 'typescript' });
  assert.match(messages[1].content, /LATEST: handle duplicate values/);
  assert.match(messages[1].content, /Earlier .* omitted/);
  assert.match(messages[1].content, /Return -1/);
  assert.ok(messages[1].content.length < 16000);
  for (const text of ['contractions', 'speech-recognition mistakes', 'constraints', 'no code is run', 'typescript', 'time and space complexity']) {
    const pattern = text === 'contractions' ? /contractions/ : new RegExp(text, 'i');
    // Natural phrasing is specified as contractions rather than artificial word substitutions.
    if (text === 'contractions') assert.match(messages[0].content, /contractions/); else assert.match(messages[0].content, pattern);
  }
  assert.equal(answerPolicy({ question: 'Write a function to reverse a linked list', answerMode: 'balanced' }).thinkingLevel, 'MEDIUM');
  assert.equal(answerPolicy({ question: 'Write a function', answerMode: 'fast' }).thinkingLevel, 'LOW');
  assert.equal(answerPolicy({ question: 'Describe your work', answerMode: 'deep' }).thinkingLevel, 'HIGH');
});

test('transcription hints are bounded and transcript exports retain source, time and corrections', () => {
  const settings = validateSettings({ ...DEFAULT_SETTINGS, transcriptionLanguage: 'en-IN', transcriptionVocabulary: 'Redis, PostgreSQL,Redis\nOAuth' });
  assert.deepEqual(settings.transcriptionVocabulary, ['Redis', 'PostgreSQL', 'OAuth']);
  assert.equal(settings.transcriptionMode, 'SMART');
  assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, transcriptionLanguage: '../../bad' }));
  const exported = transcriptText({ transcript: [{ time: '2026-10-19T12:00:00Z', source: 'system', text: 'Use a cache', originalText: 'Use a cash' }] });
  assert.match(exported, /Call audio: Use a cache/); assert.match(exported, /12:00:00Z/); assert.match(exported, /original: Use a cash/);
});

test('atomic snapshots recover corrupt primary and clear removed transcript from backup', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'parakeet-store-')); const recovered = [];
  try {
    const store = createStorage(directory, value => recovered.push(value));
    await store.write('workspace.json', { transcript: ['first'] });
    await store.write('workspace.json', { transcript: ['first', 'second'] });
    await fs.writeFile(path.join(directory, 'workspace.json'), '{broken');
    assert.deepEqual(await store.read('workspace.json', {}), { transcript: ['first'] }); assert.equal(recovered.length, 1);
    await store.write('workspace.json', { transcript: [] }, { preservePrevious: false });
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, 'workspace.json.bak'), 'utf8')), { transcript: [] });
    await store.drain();
  } finally { assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir())); assert.ok(path.basename(directory).startsWith('parakeet-store-')); await fs.rm(directory, { recursive: true, force: true }); }
});

test('HTTP retries a transient response once but never authentication or quota errors', async () => {
  let calls = 0, waits = 0;
  const result = await fetchWithRetry('http://local', {}, { fetchImpl: async () => { calls++; return new Response('', { status: calls === 1 ? 503 : 200 }); }, wait: async () => waits++ });
  assert.equal(result.status, 200); assert.equal(calls, 2); assert.equal(waits, 1);
  for (const status of [401, 403, 429]) {
    calls = 0;
    await fetchWithRetry('http://local', {}, { fetchImpl: async () => { calls++; return new Response('', { status }); } });
    assert.equal(calls, 1);
  }
  const controller = new AbortController(); controller.abort(); calls = 0;
  await assert.rejects(() => fetchWithRetry('http://local', { signal: controller.signal }, { fetchImpl: async () => { calls++; throw new TypeError('offline'); } }));
  assert.equal(calls, 0);
});

function fakeLive() {
  const instances = [];
  class Fake {
    constructor(options) { this.options = options; this.sent = []; instances.push(this); }
    async start() { this.ready = true; }
    send(frame) { this.sent.push(frame); }
    endAudio() {}
    close() { this.closed = true; }
    async stop() { this.close(); }
  }
  return { Fake, instances };
}
test('live reconnect preserves bounded new audio and stop cancels recovery', async () => {
  const { Fake, instances } = fakeLive(); const statuses = [], errors = [];
  const live = new ReliableLive({ settings: {}, key: 'fake', onTranscript() {}, onError: x => errors.push(x), onStatus: x => statuses.push(x), LiveImpl: Fake, retryDelays: [1] });
  try {
    await live.start(); instances[0].options.onError('connection lost');
    const frame = new ArrayBuffer(3200); live.send(frame);
    await until(() => instances.length === 2 && live.ready);
    assert.equal(instances[1].sent.length, 1); assert.notEqual(instances[1].sent[0], frame);
    assert.equal(live.bytes, 0); assert.ok(statuses.some(x => x.state === 'reconnecting')); assert.deepEqual(errors, []);
    await live.stop(); assert.ok(instances[1].closed);
  } finally { live.close(); }
});
test('a socket closing before its error callback buffers the unsent frame and recovers once', async () => {
  const { Fake, instances } = fakeLive(); const errors = [], statuses = [];
  const live = new ReliableLive({ settings: {}, key: 'fake', onTranscript() {}, onError: e => errors.push(e), onStatus:s=>statuses.push(s), LiveImpl:Fake, retryDelays:[1] });
  try {
    await live.start(); const old=instances[0];
    old.send=()=>{throw Object.assign(new Error('socket already closing'),{retryable:true});};
    const frame=new ArrayBuffer(4096);live.send(frame);old.options.onError('late close callback');
    assert.equal(live.bytes,4096);await until(()=>instances.length===2&&live.ready);
    assert.equal(instances[1].sent.length,1);assert.notEqual(instances[1].sent[0],frame);
    assert.equal(live.bytes,0);assert.equal(statuses.filter(s=>s.state==='reconnecting').length,1);assert.deepEqual(errors,[]);
  } finally { live.close(); }
});

test('send backpressure and unknown send failures are not silently replayed', async () => {
  const { Fake, instances } = fakeLive();
  const live=new ReliableLive({settings:{},key:'fake',onTranscript(){},onError(){},LiveImpl:Fake,retryDelays:[1]});
  try {await live.start();instances[0].send=()=>{throw Error('cannot keep up');};assert.throws(()=>live.send(new ArrayBuffer(4096)),/cannot keep up/);assert.equal(live.bytes,0);assert.equal(instances.length,1);}finally{live.close();}
});

test('Gemini identifies a pre-send closing socket as retryable without sending', () => {
  const {GeminiLive}=require('../electron/gemini-live.cjs');const live=new GeminiLive({settings:{},key:'fake',onTranscript(){},onError(){}});live.ready=true;live.socket={readyState:2,send(){assert.fail('closed socket must not send');}};
  assert.throws(()=>live.send(new ArrayBuffer(4096)),error=>error.retryable===true&&/disconnected/.test(error.message));
});

test('live audio outage cannot grow memory without bound and fatal errors do not reconnect', async () => {
  const { Fake, instances } = fakeLive(); const errors = [];
  const live = new ReliableLive({ settings: {}, key: 'fake', onTranscript() {}, onError: x => errors.push(x), LiveImpl: Fake, retryDelays: [1000] });
  await live.start(); instances[0].options.onError('lost');
  for (let i = 0; i < 4; i++) live.send(new ArrayBuffer(64000));
  assert.throws(() => live.send(new ArrayBuffer(64000)), /8-second/); assert.equal(live.bytes, 256000);
  live.close();
  const other = new ReliableLive({ settings: {}, key: 'fake', onTranscript() {}, onError: x => errors.push(x), LiveImpl: Fake, retryDelays: [1] });
  await other.start(); instances.at(-1).options.onError('quota exceeded', { retryable: false });
  assert.equal(other.closed, true); assert.equal(errors.at(-1), 'quota exceeded');
});
test('token limit finish reason preserves deltas but reports an incomplete answer', async () => {
  async function* body() { yield new TextEncoder().encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Partial code' }] }, finishReason: 'MAX_TOKENS' }] })}\n\n`); }
  const deltas = [];
  await assert.rejects(() => readAnswerStream(body(), text => deltas.push(text), 'gemini'), /partial draft/);
  assert.deepEqual(deltas, ['Partial code']);
});

test('replaced live connections cannot append stale final or interim text', async () => {
  const { Fake, instances } = fakeLive(); const finals = [], interims = [];
  const live = new ReliableLive({ settings: {}, key: 'fake', onTranscript: v => finals.push(v), onInterim: v => interims.push(v), onError() {}, LiveImpl: Fake, retryDelays: [1] });
  try {
    await live.start(); const old = instances[0]; old.options.onError('lost');
    old.options.onTranscript('stale during recovery'); old.options.onInterim('stale interim');
    await until(() => instances.length === 2 && live.ready);
    old.options.onTranscript('stale after replacement');
    instances[1].options.onTranscript('current final'); instances[1].options.onInterim('current interim');
    assert.deepEqual(finals, ['current final']); assert.deepEqual(interims, ['current interim']);
  } finally { live.close(); }
});

test('stop during initial setup never reconnects or announces readiness', async () => {
  const { Fake, instances } = fakeLive(); let release;
  Fake.prototype.start = () => new Promise(resolve => { release = resolve; });
  const statuses = [], errors = [];
  const live = new ReliableLive({ settings: {}, key: 'fake', onTranscript() {}, onError: e => errors.push(e), onStatus: s => statuses.push(s), LiveImpl: Fake });
  const starting = live.start(); const rejected = assert.rejects(starting, /stopped/);
  await live.stop(); release(); await rejected;
  assert.equal(instances[0].closed, true); assert.equal(live.ready, false);
  assert.deepEqual(statuses, []); assert.deepEqual(errors, []);
  await assert.rejects(() => live.start(), /stopped/);
  assert.equal(instances.length, 1);
});

test('concurrent stops drain once, accept final text, and reject new audio', async () => {
  const { Fake, instances } = fakeLive(); let release, stops = 0; const finals = [];
  Fake.prototype.stop = function () { stops++; return new Promise(resolve => { release = () => { this.options.onTranscript('drained final'); resolve({ complete: true }); }; }); };
  const live = new ReliableLive({ settings: {}, key: 'fake', onTranscript: t => finals.push(t), onError() {}, LiveImpl: Fake });
  await live.start(); const first = live.stop(), second = live.stop();
  assert.equal(first, second); assert.equal(stops, 1);
  assert.throws(() => live.send(new ArrayBuffer(3200)), /stopped/);
  release(); await first; assert.deepEqual(finals, ['drained final']);
  instances[0].options.onTranscript('late final'); assert.deepEqual(finals, ['drained final']);
  assert.equal(live.closed, true);
});

test('failed drain always releases the connection and records a gap', async () => {
  const { Fake, instances } = fakeLive(); const statuses = [];
  Fake.prototype.stop = async () => { throw new Error('transport failed'); };
  const live = new ReliableLive({ settings: {}, key: 'fake', onTranscript() {}, onError() {}, onStatus: s => statuses.push(s), LiveImpl: Fake });
  await live.start(); await assert.rejects(live.stop(), /transport failed/);
  assert.equal(live.closed, true); assert.equal(instances[0].closed, true);
  assert.equal(statuses.at(-1).state, 'gap');
});

test('session startup reserves ownership before consent or credentials and Stop invalidates it', async () => {
  const group = new LiveSession(); let release, created = 0;
  const starting = group.start(['microphone'], () => new Promise(resolve => { release = resolve; }), () => { created++; });
  const rejected = assert.rejects(starting, /stopped/);
  assert.equal(group.busy, true);
  await assert.rejects(() => group.start(['system'], async () => {}, () => {}), /already/);
  await group.stop(); release('fake-key'); await rejected;
  assert.equal(created, 0); assert.equal(group.busy, false);
});

test('session stop during first-source setup cannot start the second source', async () => {
  const group = new LiveSession(); const created = []; let release;
  const starting = group.start(['microphone', 'system'], async () => 'fake', source => {
    const connection = { source, start: () => new Promise(resolve => { release = resolve; }), close() { this.closed = true; }, async stop() { this.close(); } };
    created.push(connection); return connection;
  });
  const rejected = assert.rejects(starting, /stopped/);
  await until(() => created.length === 1); await group.stop(); release(); await rejected;
  assert.equal(created.length, 1); assert.equal(created[0].closed, true); assert.equal(group.busy, false);
});

test('failed second source closes both sources and allows a clean restart', async () => {
  const group = new LiveSession(); const created = [];
  const create = source => { const c = { async start() { if (source === 'system') throw new Error('denied'); }, close() { this.closed = true; }, async stop() { this.close(); } }; created.push(c); return c; };
  await assert.rejects(() => group.start(['microphone', 'system'], async () => {}, create), /denied/);
  assert.ok(created.every(c => c.closed)); assert.equal(group.busy, false);
  await group.start(['microphone'], async () => {}, create); assert.equal(group.connections.size, 1);
  group.close(); assert.equal(group.busy, false);
});

test('capture size respects native DPI pixels, portrait aspect and the detail budget without upscaling', () => {
  assert.deepEqual(captureSize({size:{width:1920,height:1080},scaleFactor:1}), {width:1920,height:1080});
  assert.deepEqual(captureSize({size:{width:1920,height:1080},scaleFactor:2}), {width:3840,height:2160});
  assert.deepEqual(captureSize({size:{width:1080,height:1920},scaleFactor:2}), {width:2160,height:3840});
  assert.deepEqual(captureSize({size:{width:5120,height:2880},scaleFactor:1}), {width:3840,height:2160});
});

test('capture lease rejects expiry, refreshed previews, forged IDs and changed displays without retaining pixels', () => {
  let now = 0; const leases = new CaptureLease({ now: () => now });
  const first = leases.issue('monitor-A', 1);
  assert.deepEqual(leases.assert(first.captureId, 1), {displayId:'monitor-A'});
  assert.throws(() => leases.assert('forged', 1), /expired/);
  assert.throws(() => leases.assert(first.captureId, 2), /display changed/);
  now = 119999; assert.doesNotThrow(() => leases.assert(first.captureId, 1));
  now = 120000; assert.throws(() => leases.assert(first.captureId, 1), /expired/);
  const second = leases.issue('monitor-B', 1);
  assert.throws(() => leases.assert(first.captureId, 1), /expired/);
  assert.deepEqual(leases.assert(second.captureId, 1), {displayId:'monitor-B'});
  assert.ok(!JSON.stringify(leases).includes('data:image'));
  leases.clear(); assert.throws(() => leases.assert(second.captureId, 1), /expired/);
});
