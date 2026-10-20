const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_SETTINGS, migrateSettings, validateSettings, validateOverlayPreferences, validateAudioSources, imagePart, sanitizeWorkspace, buildMessages, readAnswerStream, sessionMarkdown } = require('../electron/core.cjs');

test('provider URLs reject credentials and insecure remote endpoints, allow local providers', () => {
  assert.equal(validateSettings(DEFAULT_SETTINGS).baseUrl, 'https://generativelanguage.googleapis.com/v1beta');
  assert.equal(validateSettings({ ...DEFAULT_SETTINGS, baseUrl: 'http://127.0.0.1:9000/v1/' }).baseUrl, 'http://127.0.0.1:9000/v1');
  for (const baseUrl of ['http://example.com', 'https://user:password@example.com', 'file:///etc/passwd', 'https://example.com?key=secret']) {
    assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, baseUrl }));
  }
});

test('legacy OpenAI settings retain provider, key and model; new installs use Gemini and protection', () => {
  const legacy = migrateSettings({ baseUrl: 'https://api.openai.com/v1', model: 'old-model', transcriptionModel: 'whisper-1', encryptedKey: 'ciphertext' });
  assert.equal(legacy.provider, 'openai'); assert.equal(legacy.model, 'old-model'); assert.equal(legacy.encryptedKey, 'ciphertext');
  assert.equal(legacy.captureProtection, true);
  assert.equal(migrateSettings({}).provider, 'gemini');
  assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, transcriptionModel: 'gpt-transcribe' }), /live transcription/);
});
test('overlay bounds, audio source selection and screenshot payloads reject malformed input', () => {
  assert.equal(validateOverlayPreferences({ opacity: -3 }).opacity, 0);
  assert.equal(validateOverlayPreferences({ opacity: 9 }).opacity, 0.95);
  assert.equal(validateOverlayPreferences({ opacity: NaN }).opacity, 0.35);
  assert.deepEqual(validateAudioSources(['system', 'microphone']), ['system', 'microphone']);
  assert.throws(() => validateAudioSources(['remote']), /Choose/);
  assert.throws(() => validateAudioSources([]), /Choose/);
  assert.equal(imagePart('data:image/jpeg;base64,/9j/2Q==', 'gemini').inlineData.mimeType, 'image/jpeg');
  assert.equal(imagePart('data:image/jpeg;base64,/9j/2Q==', 'openai').type, 'image_url');
  assert.throws(() => imagePart('https://example.com/image', 'gemini'), /JPEG/);
  assert.throws(() => imagePart(`data:image/jpeg;base64,${'A'.repeat(7 * 1024 * 1024)}`, 'gemini'), /JPEG/);
});

test('Gemini SSE emits visible text only and requires a terminal finish reason', async () => {
  async function* body() {
    for (const payload of [{ candidates: [{ content: { parts: [{ thought: true, text: 'private reasoning' }, { text: 'Hello ' }] } }] }, { candidates: [{ content: { parts: [{ text: 'world' }] }, finishReason: 'STOP' }] }]) yield new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
  }
  const deltas = [];
  assert.equal(await readAnswerStream(body(), delta => deltas.push(delta), 'gemini'), 'Hello world');
  assert.deepEqual(deltas, ['Hello ', 'world']);
  async function* truncated() { yield new TextEncoder().encode('data: {"candidates":[{"content":{"parts":[{"text":"partial"}]}}]}\n\n'); }
  await assert.rejects(() => readAnswerStream(truncated(), () => {}, 'gemini'), /ended early/);
});

test('Gemini Live streams 16 kHz PCM and assembles transcript events with local WebSocket mock', async () => {
  const { WebSocketServer } = require('ws');
  const { GeminiLive } = require('../electron/gemini-live.cjs');
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise(resolve => server.once('listening', resolve));
  let frames = 0, ends = 0, transcript = '';
  server.on('connection', (socket, request) => {
    assert.equal(new URL(request.url, 'http://localhost').searchParams.get('key'), 'test-key');
    socket.on('message', bytes => {
      const value = JSON.parse(bytes.toString());
      if (value.setup) { assert.equal(value.setup.model, 'models/gemini-3.5-transcribe-live'); socket.send(JSON.stringify({ setupComplete: {} })); }
      if (value.realtimeInput?.audio) {
        frames++; assert.equal(value.realtimeInput.audio.mimeType, 'audio/pcm;rate=16000');
        assert.equal(Buffer.from(value.realtimeInput.audio.data, 'base64').length, 4096);
        socket.send(JSON.stringify({ serverContent: { interimInputTranscription: { text: 'How would ' } } }));
        socket.send(JSON.stringify({ serverContent: { inputTranscription: { text: 'How would you design an API?' }, turnComplete: true } }));
      }
      if (value.realtimeInput?.audioStreamEnd) ends++;
    });
  });
  const errors = [];
  const live = new GeminiLive({ settings: { ...DEFAULT_SETTINGS, baseUrl: `http://127.0.0.1:${server.address().port}/v1beta` }, key: 'test-key', onTranscript: value => { transcript = value.text; }, onError: message => errors.push(message) });
  try {
    await live.start(); live.send(new ArrayBuffer(4096));
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(transcript, 'How would you design an API?'); assert.equal(frames, 1);
    await live.stop(); assert.equal(ends, 1); assert.deepEqual(errors, []);
  } finally { live.close(); for (const socket of server.clients) socket.terminate(); await new Promise(resolve => server.close(resolve)); }
});

test('history storage bounds data and never adds API credentials', () => {
  const value = sanitizeWorkspace({ context: { resume: 'candidate', role: 'Engineer', apiKey: 'secret' }, sessions: [], apiKey: 'secret' });
  assert.equal(value.context.resume, 'candidate');
  assert.ok(!JSON.stringify(value).includes('secret'));
  assert.throws(() => sanitizeWorkspace({ sessions: [{ text: 'x'.repeat(17 * 1024 * 1024) }] }), /16 MB/);
});

test('answer prompts use role, resume and transcript with a non-fabrication instruction', () => {
  const messages = buildMessages({ question: 'Tell me about yourself', transcript: 'Interview begins', context: { role: 'Engineer', resume: 'Built a search service' }, style: 'star' });
  assert.match(messages[0].content, /never fabricate/i);
  assert.match(messages[0].content, /Situation, Task, Action, Result/);
  assert.match(messages[1].content, /Built a search service/);
  assert.match(messages[1].content, /Tell me about yourself/);
  assert.throws(() => buildMessages({ question: '' }), /question/);
  assert.throws(() => buildMessages({ kind: 'notes' }), /transcript/);
});

test('SSE handles UTF-8, CRLF, metadata, empty usage chunks and arbitrary byte boundaries', async () => {
  const wire = ': keepalive\r\n\r\ndata: {"choices":[{"delta":{"content":"Hello café"}}]}\r\n\r\ndata: {"choices":[]}\r\n\r\ndata: {"choices":[{"delta":{"content":"!"}}]}\r\n\r\ndata: [DONE]\r\n\r\n';
  const bytes = new TextEncoder().encode(wire);
  async function* body() { for (let i = 0; i < bytes.length; i++) yield bytes.slice(i, i + 1); }
  const deltas = [];
  assert.equal(await readAnswerStream(body(), delta => deltas.push(delta)), 'Hello café!');
  assert.deepEqual(deltas, ['Hello café', '!']);
});

test('SSE fails visibly on truncated responses or provider errors', async () => {
  async function* truncated() { yield new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Partial"}}]}\n\n'); }
  async function* error() { yield new TextEncoder().encode('data: {"error":{"message":"quota exceeded"}}\n\n'); }
  await assert.rejects(() => readAnswerStream(truncated(), () => {}), /ended early/);
  await assert.rejects(() => readAnswerStream(error(), () => {}), /quota exceeded/);
});

test('export includes transcript, answer and generated notes', () => {
  const markdown = sessionMarkdown({ title: 'Practice', transcript: [{ speaker: 'Interviewer', text: 'Why this role?' }], answers: [{ question: 'Why this role?', answer: 'I enjoy building tools.' }], notes: 'Practice examples.' });
  for (const text of ['# Practice', 'Interviewer: Why this role?', 'I enjoy building tools.', 'Practice examples.']) assert.ok(markdown.includes(text));
});

test('PCM to WAV encodes independent valid files and clips sample values', async () => {
  const fs = require('node:fs/promises');
  const source = await fs.readFile(require('node:path').join(__dirname, '../renderer/audio.js'), 'utf8');
  const { encodeWav } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const view = new DataView(encodeWav([new Float32Array([-2, 0, 2])], 48000));
  assert.equal(view.byteLength, 50);
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint32(40, true), 6);
  assert.equal(view.getInt16(44, true), -32768);
  assert.equal(view.getInt16(48, true), 32767);
});
