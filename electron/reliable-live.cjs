const { setTimeout: delay } = require('node:timers/promises');
const { GeminiLive } = require('./gemini-live.cjs');

class ReliableLive {
  constructor({ settings, key, onTranscript, onInterim = () => {}, onError, onStatus = () => {}, LiveImpl = GeminiLive, retryDelays = [500, 1500, 3000] }) {
    Object.assign(this, { settings, key, onTranscript, onInterim, onError, onStatus, LiveImpl, retryDelays });
    this.frames = []; this.bytes = 0; this.closed = false; this.ready = false;
    this.controller = new AbortController();
  }
  async connect() {
    if (this.closed || this.stopping) throw new Error('Listening was stopped.');
    const connection = new this.LiveImpl({ settings: this.settings, key: this.key,
      onTranscript: value => { if (!this.closed && this.connection === connection) this.onTranscript(value); },
      onInterim: value => { if (!this.closed && this.connection === connection) this.onInterim(value); },
      onError: (message, detail = {}) => {
        if (this.closed || this.stopping || this.connection !== connection) return;
        if (detail.retryable === false) { this.fail(message); return; }
        void this.recover();
      },
    });
    this.connection = connection;
    try { await connection.start(); }
    catch (error) { connection.close(); throw error; }
    if (this.closed || this.stopping || this.connection !== connection) { connection.close(); throw new Error('Listening was stopped.'); }
    this.ready = true;
    for (const frame of this.frames) connection.send(frame);
    this.frames = []; this.bytes = 0;
    this.onStatus({ state: 'connected', message: 'Live transcription connected.' });
  }
  async start() { await this.connect(); }
  async recover() {
    if (this.recovering || this.closed || this.stopping) return;
    this.recovering = true; this.ready = false;
    const previous = this.connection; this.connection = null; previous?.close();
    try {
      for (let attempt = 0; attempt < this.retryDelays.length; attempt++) {
        if (this.closed || this.stopping) return;
        this.onStatus({ state: 'reconnecting', attempt: attempt + 1, message: 'Reconnecting; up to 8 seconds of new audio is buffered locally. Earlier in-flight audio may be missing.' });
        await delay(this.retryDelays[attempt], undefined, { signal: this.controller.signal });
        try { await this.connect(); return; }
        catch (error) { if (error.retryable === false || attempt === this.retryDelays.length - 1) throw error; }
      }
    } catch (error) { if (!this.closed && !this.stopping) this.fail(`Live recovery failed: ${error.message}`); }
    finally { this.recovering = false; }
  }
  send(audio) {
    if (!(audio instanceof ArrayBuffer) || audio.byteLength > 65536 || audio.byteLength % 2) throw new Error('Invalid live audio frame.');
    if (this.closed || this.stopping) throw new Error('Live transcription stopped. Restart listening to continue.');
    if (this.ready) {
      try { this.connection.send(audio); return; }
      catch (error) {
        // The socket can enter CLOSING before its close/error callback runs.
        // Only a known pre-send disconnection is safe to buffer and retry.
        if (error.retryable !== true) throw error;
        void this.recover();
      }
    }
    if (this.bytes + audio.byteLength > 256000) throw new Error('The connection outage exceeded the 8-second audio buffer. Capture stopped; check the network and restart listening.');
    this.frames.push(audio.slice(0)); this.bytes += audio.byteLength;
  }
  endAudio() { if (this.ready && !this.closed) this.connection.endAudio(); }
  fail(message) { this.onError(message); this.close(); }
  stop() {
    if (this.stopPromise) return this.stopPromise;
    if (this.closed) return Promise.resolve();
    this.stopping = true;
    this.controller.abort();
    this.stopPromise = this.drain();
    return this.stopPromise;
  }
  async drain() {
    try {
      if (this.bytes) this.onStatus({ state: 'gap', message: 'Listening stopped before buffered audio could be transcribed. Some speech may be missing.' });
      if (this.ready) {
        const result = await this.connection.stop();
        if (result?.complete === false) this.onStatus({ state: 'gap', message: 'Final transcription did not arrive before the drain deadline. The last speech segment may be missing.' });
      }
    } catch (error) {
      this.onStatus({ state: 'gap', message: 'Final transcription failed while stopping. The last speech segment may be missing.' });
      throw error;
    } finally { this.close(); }
  }
  close() {
    if (this.closed) return;
    this.closed = true; this.ready = false; this.controller.abort();
    this.connection?.close(); this.frames = []; this.bytes = 0;
  }
}
module.exports = { ReliableLive };
