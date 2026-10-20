export function encodeWav(chunks, sampleRate) {
  const count = chunks.reduce((n, chunk) => n + chunk.length, 0);
  const bytes = new ArrayBuffer(44 + count * 2);
  const view = new DataView(bytes);
  const word = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
  word(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); word(8, 'WAVE'); word(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); word(36, 'data'); view.setUint32(40, count * 2, true);
  let index = 44;
  for (const chunk of chunks) for (const sample of chunk) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(index, Math.round(clamped * (clamped < 0 ? 32768 : 32767)), true); index += 2;
  }
  return bytes;
}

export class AudioCapture {
  constructor() { this.streams = []; this.running = false; this.session = null; }
  async start(options) {
    if (this.running || this.starting) return;
    if (this.stopping) await this.stopping;
    if (this.running || this.starting) return;
    this.starting = true;
    const session = { options, streams: [], pipelines: [], active: true, accepting: false, listeners: [] };
    this.session = session; this.options = options; this.streams = session.streams;
    const acquire = async (name, request) => {
      const stream = await request();
      // A permission dialog may resolve after the user has already stopped.
      if (this.session !== session || !session.active) {
        for (const track of stream.getTracks()) track.stop();
        throw new Error('Audio capture was cancelled.');
      }
      session.streams.push(stream);
      if (!stream.getAudioTracks().length) throw new Error(`${name === 'system' ? 'System' : 'Microphone'} audio is unavailable. Check Windows audio settings.`);
      session.pipelines.push({ name, stream, frames: [], preRoll: [], samples: 0, quiet: 0, voiced: 0, queued: 0, queue: Promise.resolve(), liveActive: false, liveQuiet: 0, livePreRoll: [] });
    };
    try {
      if (options.source === 'system' || options.source === 'both') {
        await acquire('system', () => navigator.mediaDevices.getDisplayMedia({ audio: true, video: { width: 16, height: 16, frameRate: 1 } }));
        // Retain display video for loopback negotiation. Never read or send its frames.
      }
      if (options.source === 'microphone' || options.source === 'both') {
        await acquire('microphone', async () => {
          const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
          if (options.microphoneDeviceId && options.microphoneDeviceId !== 'default') audio.deviceId = { exact: options.microphoneDeviceId };
          try { return await navigator.mediaDevices.getUserMedia({ audio, video: false }); }
          catch (error) {
            if (!audio.deviceId || !['NotFoundError', 'OverconstrainedError'].includes(error.name)) throw error;
            this.warn(session, 'The selected microphone is unavailable; using the default microphone.', 'microphone');
            delete audio.deviceId;
            return navigator.mediaDevices.getUserMedia({ audio, video: false });
          }
        });
      }
      if (!this.streams.length) throw new Error('Choose an audio source.');
      const context = session.context = options.onPCM ? new AudioContext({ sampleRate: 16000 }) : new AudioContext();
      this.context = context;
      if (options.onPCM && context.sampleRate !== 16000) throw new Error('This audio device cannot provide the 16 kHz stream required by Gemini Live.');
      await context.audioWorklet.addModule(new URL('./pcm-worklet.js', import.meta.url));
      if (!session.active) throw new Error('Audio capture was cancelled.');
      for (const pipeline of session.pipelines) {
        pipeline.input = context.createMediaStreamSource(new MediaStream(pipeline.stream.getAudioTracks()));
        pipeline.node = new AudioWorkletNode(context, 'pcm-recorder');
        pipeline.mute = context.createGain(); pipeline.mute.gain.value = 0;
        pipeline.input.connect(pipeline.node);
        pipeline.node.connect(pipeline.mute).connect(context.destination);
        pipeline.node.port.onmessage = event => { if(event.data?.type === 'flushed') { pipeline.resolveFlush?.(); return; } this.receive(event.data, pipeline.name, session); };
        for (const track of pipeline.stream.getAudioTracks()) {
          this.listen(session, track, 'ended', () => this.end(session, pipeline.name, 'Audio device disconnected or sharing ended.'));
          this.listen(session, track, 'mute', () => {
            this.warn(session, 'Audio input is muted or temporarily unavailable.', pipeline.name);
            clearTimeout(pipeline.muteTimer);
            pipeline.muteTimer = setTimeout(() => this.end(session, pipeline.name, 'Audio input remained unavailable; capture stopped.'), 8000);
          });
          this.listen(session, track, 'unmute', () => { clearTimeout(pipeline.muteTimer); });
        }
      }
      this.listen(session, context, 'statechange', () => {
        if (session.accepting && context.state !== 'running') this.end(session, 'all', 'Audio processing was suspended; restart listening to continue.');
      });
      await context.resume();
      if (!session.active) throw new Error('Audio capture was cancelled.');
      session.accepting = true; this.running = true;
      if(Number.isFinite(context.currentTime)) {
        session.clockMark={wall:performance.now(),audio:context.currentTime};
        session.clockTimer=setInterval(()=>this.checkClock(session),2000);
      }
      if (context.state !== 'running') throw new Error('Audio processing could not start. Restart listening to continue.');
      for (const pipeline of session.pipelines) for (const track of pipeline.stream.getAudioTracks()) {
        if (track.readyState === 'ended') throw new Error(`${pipeline.name} audio ended before capture started.`);
        if (track.muted) {
          this.warn(session, 'Audio input is muted or temporarily unavailable.', pipeline.name);
          pipeline.muteTimer = setTimeout(() => this.end(session, pipeline.name, 'Audio input remained unavailable; capture stopped.'), 8000);
        }
      }
    } catch (error) {
      if (this.session === session) await this.stop(false);
      throw error;
    }
    finally { this.starting = false; }
  }
  listen(session, target, event, handler) {
    target.addEventListener(event, handler);
    session.listeners.push(() => target.removeEventListener(event, handler));
  }
  checkClock(session, wallNow=performance.now()) {
    if(!session?.active || !session.accepting || this.session!==session || !session.clockMark) return;
    const elapsed=wallNow-session.clockMark.wall;
    if(elapsed<8000) return;
    const processed=(session.context.currentTime-session.clockMark.audio)*1000;
    if(elapsed-processed>2000) {
      this.end(session,'all','Audio processing fell behind real time; some speech may be missing. Restart listening.');
      return;
    }
    session.clockMark={wall:wallNow,audio:session.context.currentTime};
  }
  warn(session, message, source) {
    if (session.active && this.session === session) (session.options.onWarning || session.options.onError)?.(message, source);
  }
  end(session, source, message) {
    if (!session.accepting || this.session !== session || session.ending) return;
    session.ending = true;
    this.warn(session, message, source);
    this.stop().finally(() => {
      // onEnded identifies the failed source; either failure stops this capture session.
      if (!this.session) session.options.onEnded?.(source, message);
    });
  }
  receive(frame, source, session = this.session) {
    if (!this.running || !session?.accepting || this.session !== session || !frame?.length) return;
    const pipeline = session.pipelines.find(item => item.name === (source || session.pipelines[0]?.name));
    if (!pipeline) return;
    const rms = Math.sqrt(frame.reduce((sum, sample) => sum + sample * sample, 0) / frame.length);
    session.options.onLevel?.(Math.min(1, rms * 8), pipeline.name);
    if (session.options.onPCM) {
      const speaking = rms > 0.006;
      const send = samples => {
        const bytes = new ArrayBuffer(samples.length * 2); const view = new DataView(bytes);
        for (let i = 0; i < samples.length; i++) { const value = Math.max(-1, Math.min(1, samples[i])); view.setInt16(i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true); }
        this.enqueue(session, pipeline, () => session.options.onPCM(bytes, pipeline.name), 8);
      };
      if (session.options.networkMode === 'economy' && !pipeline.liveActive && !speaking) {
        pipeline.livePreRoll.push(frame); if (pipeline.livePreRoll.length > 3) pipeline.livePreRoll.shift(); return;
      }
      if (speaking && !pipeline.liveActive) { for (const previous of pipeline.livePreRoll) send(previous); pipeline.livePreRoll = []; }
      send(frame);
      if (speaking) { pipeline.liveActive = true; pipeline.liveQuiet = 0; }
      else if (pipeline.liveActive) {
        pipeline.liveQuiet += frame.length / 16000;
        if (pipeline.liveQuiet >= 0.8) {
          pipeline.liveActive = false; pipeline.liveQuiet = 0;
          this.enqueue(session, pipeline, () => session.options.onSpeechEnd?.(pipeline.name), 8);
        }
      }
      return;
    }
    const duration = frame.length / session.context.sampleRate;
    const speaking = rms > 0.012;
    if (!pipeline.frames.length && !speaking) {
      pipeline.preRoll.push(frame); if (pipeline.preRoll.length > 6) pipeline.preRoll.shift(); return;
    }
    if (!pipeline.frames.length) { pipeline.frames.push(...pipeline.preRoll); pipeline.samples = pipeline.preRoll.reduce((n, p) => n + p.length, 0); pipeline.preRoll = []; }
    pipeline.frames.push(frame); pipeline.samples += frame.length;
    if (speaking) { pipeline.voiced += duration; pipeline.quiet = 0; } else pipeline.quiet += duration;
    if ((pipeline.quiet >= 0.7 && pipeline.voiced >= 0.2) || pipeline.samples / session.context.sampleRate >= 12 || pipeline.quiet >= 1.5) this.flush(pipeline.name, session);
  }
  enqueue(session, pipeline, callback, limit = 4) {
    if (pipeline.queued >= limit) {
      this.warn(session, 'Transcription cannot keep up. Audio was skipped; pause and check the provider connection.', pipeline.name); return;
    }
    pipeline.queued++;
    pipeline.queue = pipeline.queue.then(() => {
      if (session.active && this.session === session) return callback();
    }).catch(error => {
      if (session.active && this.session === session) session.options.onError?.(error.message || 'Audio transcription failed.', pipeline.name);
    }).finally(() => { pipeline.queued--; });
  }
  flush(source, session = this.session, force = false) {
    if (!session?.active) return;
    for (const pipeline of session.pipelines) {
      if (source && pipeline.name !== source) continue;
      if (!pipeline.frames.length) continue;
      const frames = pipeline.frames; const voiced = pipeline.voiced;
      pipeline.frames = []; pipeline.samples = 0; pipeline.voiced = 0; pipeline.quiet = 0;
      if (voiced < (force ? Number.EPSILON : 0.2)) continue;
      const audio = encodeWav(frames, session.context.sampleRate);
      this.enqueue(session, pipeline, () => session.options.onSegment?.({ audio, mimeType: 'audio/wav', source: pipeline.name }));
    }
  }
  stop(flush = true) {
    if (this.stopping) return this.stopping;
    const session = this.session;
    if (!session) return Promise.resolve();
    clearInterval(session.clockTimer);
    for (const remove of session.listeners) remove();
    this.stopping = (async () => {
      try {
        if(flush) {
          await Promise.all(session.pipelines.map(pipeline => {
            if(!pipeline.node?.port.postMessage) return;
            return new Promise(resolve => {
              const timer=setTimeout(()=>{ this.warn(session,'Audio flush timed out; the final audio tail may be missing.',pipeline.name); resolve(); },500);
              pipeline.resolveFlush=()=>{clearTimeout(timer);resolve();};
              try { pipeline.node.port.postMessage({type:'flush'}); } catch { clearTimeout(timer);this.warn(session,'Audio flush failed; the final audio tail may be missing.',pipeline.name);resolve(); }
            });
          }));
        }
        this.running = false; session.accepting = false;
        if(flush && !session.options.onPCM) this.flush(undefined,session,true);
        if(!flush) session.active=false;
        await Promise.all(session.pipelines.map(pipeline => pipeline.queue));
      } finally {
        this.running = false; session.accepting=false;session.active = false;
        for(const pipeline of session.pipelines) {
          clearTimeout(pipeline.muteTimer);pipeline.resolveFlush=null;
          if(pipeline.node) { pipeline.node.port.onmessage=null;pipeline.node.disconnect();pipeline.node.port.close?.(); }
          pipeline.input?.disconnect();pipeline.mute?.disconnect();
        }
        for(const stream of session.streams) for(const track of stream.getTracks()) track.stop();
        if(session.context && session.context.state !== 'closed') await session.context.close();
        this.streams=[];
        if(this.session === session) { for(const pipeline of session.pipelines) session.options.onLevel?.(0,pipeline.name);this.session=null; }
        this.stopping=null;
      }
    })();
    return this.stopping;
  }
}
