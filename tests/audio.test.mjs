import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Load the renderer ES module without changing the Electron package's module type.
const source = await readFile(new URL('../renderer/audio.js', import.meta.url), 'utf8');
const { AudioCapture } = await import(`data:text/javascript;base64,${Buffer.from(source.replace("new URL('./pcm-worklet.js', import.meta.url)", "'pcm-worklet.js'")).toString('base64')}`);
const tick = () => new Promise(resolve => setImmediate(resolve));
class Track extends EventTarget {
  constructor(kind) { super(); this.kind = kind; this.readyState = 'live'; this.muted = false; }
  stop() { this.readyState = 'ended'; }
}
class Stream {
  constructor(tracks = [new Track('audio')]) { this.tracks = tracks; }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio'); }
}
class Node {
  constructor() { this.connections = []; this.port = { onmessage: null, close() {} }; this.gain = {}; }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; }
}
class Context extends EventTarget {
  constructor(options) { super(); this.options=options; this.sampleRate = options?.sampleRate || 48000; this.state = 'suspended'; this.destination = {}; this.audioWorklet = { addModule: async () => {} }; }
  createMediaStreamSource(stream) { const node = new Node(); node.stream = stream; return node; }
  createGain() { return new Node(); }
  async resume() { this.state = 'running'; this.dispatchEvent(new Event('statechange')); }
  async close() { this.state = 'closed'; this.dispatchEvent(new Event('statechange')); }
}
function setup(overrides = {}) {
  const microphone = new Stream();
  const system = new Stream([new Track('audio'), new Track('video')]);
  const requests = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: {
    getDisplayMedia: async () => system,
    getUserMedia: async options => { requests.push(options); return microphone; }, ...overrides
  } } });
  globalThis.MediaStream = Stream;
  globalThis.AudioContext = Context;
  globalThis.AudioWorkletNode = Node;
  return { microphone, system, requests };
}
function feed(capture, name, value = 0.1, seconds = 0.3) {
  const pipeline = capture.session.pipelines.find(item => item.name === name);
  pipeline.node.port.onmessage({ data: new Float32Array(capture.context.sampleRate * seconds).fill(value) });
}

test('both sources have distinct worklets, VAD and WAV source labels', async () => {
  setup(); const capture = new AudioCapture(); const segments = []; const levels = [];
  await capture.start({ source: 'both', onSegment: segment => segments.push(segment), onLevel: (...args) => levels.push(args) });
  const [system, microphone] = capture.session.pipelines;
  assert.notEqual(system.node, microphone.node);
  assert.deepEqual(system.input.connections, [system.node]);
  assert.deepEqual(microphone.input.connections, [microphone.node]);
  feed(capture, 'system'); feed(capture, 'microphone', 0); feed(capture, 'system', 0, 0.8);
  await tick();
  assert.equal(segments.length, 1); assert.equal(segments[0].source, 'system');
  assert.equal(new DataView(segments[0].audio).getUint32(24, true), 48000);
  feed(capture, 'microphone'); feed(capture, 'microphone', 0, 0.8);
  await capture.stop();
  assert.deepEqual(segments.map(segment => segment.source), ['system', 'microphone']);
  assert.ok(levels.some(([, source]) => source === 'microphone'));
});

test('PCM remains separate 16 kHz and no local input is mixed into loopback', async () => {
  setup(); const capture = new AudioCapture(); const chunks = [];
  await capture.start({ source: 'both', onPCM: (audio, source) => chunks.push({ audio, source }) });
  feed(capture, 'system', 0.1, 0.1); feed(capture, 'microphone', -0.2, 0.1);
  await capture.stop();
  assert.equal(capture.context.sampleRate, 16000);
  assert.deepEqual(chunks.map(chunk => chunk.source), ['system', 'microphone']);
  assert.equal(chunks[0].audio.byteLength, 3200);
  assert.ok(new DataView(chunks[0].audio).getInt16(0, true) > 0);
  assert.ok(new DataView(chunks[1].audio).getInt16(0, true) < 0);
});

test('audio clock tolerates small startup delay but stops a stalled clock visibly', async () => {
  setup();const capture=new AudioCapture(),warnings=[];let ended=0;
  await capture.start({source:'microphone',onPCM(){},onWarning:x=>warnings.push(x),onEnded:()=>ended++});
  const session=capture.session;session.clockMark={wall:0,audio:0};session.context.currentTime=6.5;
  capture.checkClock(session,8000);assert.equal(capture.running,true);assert.deepEqual(warnings,[]);
  session.context.currentTime=7;capture.checkClock(session,16000);await capture.stopping;await tick();
  assert.equal(capture.running,false);assert.equal(ended,1);assert.match(warnings[0],/fell behind real time.*missing/);
  capture.checkClock(session,24000);assert.equal(ended,1);
});

test('a healthy audio clock advances its observation window without stopping', async () => {
  setup();const capture=new AudioCapture();await capture.start({source:'microphone',onPCM(){}});
  const session=capture.session;session.clockMark={wall:0,audio:0};session.context.currentTime=8;
  capture.checkClock(session,8000);assert.deepEqual(session.clockMark,{wall:8000,audio:8});assert.equal(capture.running,true);await capture.stop();
});

test('economy audio skips long silence, retains lead-in, and signals speech end once', async () => {
  setup(); const capture = new AudioCapture(); const chunks = [], ends = [];
  await capture.start({ source: 'microphone', networkMode: 'economy', onPCM: bytes => chunks.push(bytes), onSpeechEnd: source => ends.push(source) });
  for (let i = 0; i < 20; i++) feed(capture, 'microphone', 0, 0.1);
  await tick(); assert.equal(chunks.length, 0);
  feed(capture, 'microphone', 0.02, 0.1);
  await tick(); assert.equal(chunks.length, 4, 'Three lead-in frames and the first speech frame should survive.');
  for (let i = 0; i < 10; i++) { feed(capture, 'microphone', 0, 0.1); await tick(); }
  assert.deepEqual(ends, ['microphone']);
  const before = chunks.length;
  for (let i = 0; i < 20; i++) feed(capture, 'microphone', 0, 0.1);
  await tick(); assert.equal(chunks.length, before);
  await capture.stop();
});

test('selected missing microphone falls back, but denied permission does not', async () => {
  const requests = []; const microphone = new Stream(); const warnings = [];
  setup({ getUserMedia: async request => {
    requests.push(structuredClone(request));
    if (requests.length === 1) throw Object.assign(new Error('missing'), { name: 'OverconstrainedError' });
    return microphone;
  } });
  const capture = new AudioCapture();
  await capture.start({ source: 'microphone', microphoneDeviceId: 'selected', onWarning: message => warnings.push(message) });
  assert.deepEqual(requests[0].audio.deviceId, { exact: 'selected' });
  assert.equal(requests[1].audio.deviceId, undefined);
  assert.equal(requests[1].audio.echoCancellation, true);
  assert.equal(warnings.length, 1); await capture.stop();
  let calls = 0;
  setup({ getUserMedia: async () => { calls++; throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); } });
  await assert.rejects(capture.start({ source: 'microphone', microphoneDeviceId: 'selected' }), /denied/);
  assert.equal(calls, 1);
});

test('failed startup releases already acquired display audio and video', async () => {
  const { system } = setup({ getUserMedia: async () => { throw new Error('denied'); } });
  const capture = new AudioCapture();
  await assert.rejects(capture.start({ source: 'both' }), /denied/);
  assert.ok(system.getTracks().every(track => track.readyState === 'ended'));
  assert.equal(capture.running, false); assert.equal(capture.session, null);
});

test('display video ending does not end audio, audio ending stops and identifies source', async () => {
  const { system, microphone } = setup(); const ended = [];
  const capture = new AudioCapture();
  await capture.start({ source: 'both', onEnded: (...args) => ended.push(args) });
  system.getTracks().find(track => track.kind === 'video').dispatchEvent(new Event('ended'));
  assert.equal(capture.running, true);
  system.getAudioTracks()[0].dispatchEvent(new Event('ended'));
  await tick();
  assert.equal(capture.running, false); assert.equal(ended[0][0], 'system');
  assert.equal(microphone.getAudioTracks()[0].readyState, 'ended');
});

test('queues serialize per source, bound backlog, and old worklets cannot reach a new session', async () => {
  setup(); const capture = new AudioCapture(); const calls = []; const warnings = [];
  let release; const pending = new Promise(resolve => { release = resolve; });
  await capture.start({ source: 'both', onWarning: message => warnings.push(message), onSegment: async ({ source }) => {
    calls.push(source); if (source === 'microphone') await pending;
  } });
  const oldCallback = capture.session.pipelines[0].node.port.onmessage;
  for (let index = 0; index < 7; index++) { feed(capture, 'microphone'); capture.flush('microphone'); }
  feed(capture, 'system'); capture.flush('system'); await tick();
  assert.deepEqual(calls, ['microphone', 'system']); assert.ok(warnings.length >= 1);
  assert.equal(capture.session.pipelines.find(item => item.name === 'microphone').queued, 4);
  release(); await capture.stop();
  const fresh = []; setup(); await capture.start({ source: 'system', onPCM: audio => fresh.push(audio) });
  oldCallback({ data: new Float32Array(2048).fill(0.1) }); await tick();
  assert.equal(fresh.length, 0); await capture.stop();
});

test('context suspension stops capture and reports why', async () => {
  setup(); const warnings = []; const capture = new AudioCapture();
  await capture.start({ source: 'microphone', onWarning: message => warnings.push(message) });
  capture.context.state = 'suspended'; capture.context.dispatchEvent(new Event('statechange'));
  await tick(); assert.equal(capture.running, false); assert.match(warnings[0], /suspended/);
});

test('stopping while a device permission dialog is pending discards the acquired stream', async () => {
  let acquire; const microphone = new Stream();
  setup({ getUserMedia: () => new Promise(resolve => { acquire = resolve; }) });
  const capture = new AudioCapture(); const starting = capture.start({ source: 'microphone' });
  await capture.stop(); acquire(microphone);
  await assert.rejects(starting, /cancelled/);
  assert.equal(microphone.getAudioTracks()[0].readyState, 'ended'); assert.equal(capture.running, false);
});


test('stop accepts the worklet tail and waits for transport completion before releasing the stream',async()=>{
 const {microphone}=setup();const capture=new AudioCapture();const frames=[];let release;
 await capture.start({source:'microphone',onPCM:async bytes=>{frames.push(bytes.byteLength);await new Promise(resolve=>{release=resolve;});}});
 const pipeline=capture.session.pipelines[0];
 pipeline.node.port.postMessage=()=>{pipeline.node.port.onmessage({data:new Float32Array(896).fill(.1)});pipeline.node.port.onmessage({data:{type:'flushed'}});};
 const stopping=capture.stop();await tick();assert.deepEqual(frames,[1792]);assert.equal(microphone.getAudioTracks()[0].readyState,'live');
 release();await stopping;assert.equal(microphone.getAudioTracks()[0].readyState,'ended');assert.equal(capture.session,null);
});
