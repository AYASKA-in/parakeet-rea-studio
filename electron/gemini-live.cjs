// The API key and WebSocket stay in the Electron main process.
class GeminiLive {
  constructor({ settings, key, onTranscript, onInterim = () => {}, onError, WebSocketImpl = WebSocket }) {
    this.settings = settings; this.key = key; this.onTranscript = onTranscript; this.onError = onError;
    this.WebSocketImpl = WebSocketImpl; this.pending = ''; this.closed = false; this.ready = false;
    this.onInterim = onInterim; this.finalGeneration=0; this.unfinalized=false;
  }
  async start() {
    const url = new URL(this.settings.baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
    url.search = ''; url.searchParams.set('key', this.key);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.close(); reject(new Error('Gemini Live did not complete its setup within 20 seconds.')); }, 20000);
      this.socket = new this.WebSocketImpl(url.href);
      this.socket.addEventListener('open', () => this.socket.send(JSON.stringify({ setup: {
        model: `models/${this.settings.transcriptionModel}`,
        generationConfig: { responseModalities: ['TEXT'] }, inputAudioTranscription: {
          languageCodes: this.settings.transcriptionLanguage ? [this.settings.transcriptionLanguage] : [],
          customVocabulary: this.settings.transcriptionVocabulary || [],
          mode: this.settings.transcriptionMode || 'SMART',
        },
      } })));
      this.socket.addEventListener('message', async event => {
        try {
          const data = typeof event.data === 'string' ? event.data : await event.data.text();
          const payload = JSON.parse(data);
          if (payload.error) throw Object.assign(new Error(payload.error.message || 'Gemini Live reported an error.'), { retryable: ![400, 401, 403, 404, 429].includes(Number(payload.error.code)) });
          if (payload.setupComplete) { this.ready = true; clearTimeout(timeout); resolve({ ready: true }); }
          const content = payload.serverContent;
          if (content?.interimInputTranscription?.text) { this.unfinalized=true;this.onInterim({ text: content.interimInputTranscription.text }); }
          const transcript = content?.inputTranscription;
          if (transcript?.text) { this.pending = transcript.text; this.flush(); this.finalGeneration++; this.unfinalized=false;this.speechSinceFinal=false;this.resolveDrain?.(); }
          if (transcript?.finished || content?.turnComplete) this.flush();
          if (payload.goAway) throw new Error('Gemini Live is ending this connection. Stop and restart listening to reconnect.');
        } catch (error) {
          error.message=String(error.message).split(this.key).join('[redacted]');
          clearTimeout(timeout);
          if (!this.ready) reject(error); else this.onError(error.message.split(this.key).join('[redacted]'), { retryable: error.retryable !== false });
          this.close();
        }
      });
      this.socket.addEventListener('error', () => {
        clearTimeout(timeout);
        const message = 'Gemini Live connection failed. Check your API key, network, model access and free-tier quota.';
        if (!this.ready) reject(new Error(message)); else if (!this.closed) this.onError(message);
      });
      this.socket.addEventListener('close', event => {
        clearTimeout(timeout); this.flush();
        if (!this.ready) reject(Object.assign(new Error(`Gemini Live closed before setup (code ${event.code}). Check model access and quota.`), { retryable: ![1003, 1007, 1008].includes(event.code) }));
        else if (!this.closed) { this.closed = true; this.onError(`Gemini Live disconnected (code ${event.code}).`, { retryable: ![1003, 1007, 1008].includes(event.code) }); }
      });
    });
  }
  send(audio) {
    if (!this.ready || this.closed || this.socket.readyState !== 1) throw Object.assign(new Error('Gemini Live is disconnected. Stop and restart listening.'), { retryable: true });
    if (!(audio instanceof ArrayBuffer) || audio.byteLength > 65536 || audio.byteLength % 2) throw new Error('Invalid live audio frame.');
    if (this.socket.bufferedAmount > 512000) throw new Error('Gemini Live cannot keep up with audio. Stop and check the network connection.');
    const view=new DataView(audio);let energy=0,count=0;for(let i=0;i<audio.byteLength;i+=16){const sample=view.getInt16(i,true)/32768;energy+=sample*sample;count++;}if(count && Math.sqrt(energy/count)>0.002)this.speechSinceFinal=true;
    this.sentAudio=true;this.socket.send(JSON.stringify({ realtimeInput: { audio: { data: Buffer.from(audio).toString('base64'), mimeType: 'audio/pcm;rate=16000' } } }));
  }
  endAudio() { if (this.ready && !this.closed && this.socket.readyState === 1) this.socket.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } })); }
  flush() { clearTimeout(this.flushTimer); const text = this.pending.trim(); this.pending = ''; if (text) this.onTranscript({ text }); }
  async stop() {
    if(this.closed) return {complete:false};
    // Install the waiter before sending end-of-audio: a fast final event must not race it.
    const drained = this.ready && this.sentAudio && (this.speechSinceFinal || this.unfinalized) ? new Promise(resolve=>{
      const timer=setTimeout(()=>resolve(false),4000);
      this.resolveDrain=()=>{clearTimeout(timer);resolve(true);};
    }) : new Promise(resolve=>setTimeout(()=>resolve(true),150));
    this.endAudio();
    const complete=await drained;this.resolveDrain=null;this.close();
    return {complete};
  }
  close() { if (this.closed) return; this.closed = true; this.flush(); this.socket?.close(); }
}
module.exports = { GeminiLive };
