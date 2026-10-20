class PCMRecorder extends AudioWorkletProcessor {
  constructor() { super(); this.samples = new Float32Array(2048); this.offset = 0; this.stopped = false;
    this.port.onmessage = event => {
      if (event.data?.type !== 'flush') return;
      this.stopped = true;
      if(this.offset) { const tail=this.samples.slice(0,this.offset); this.port.postMessage(tail,[tail.buffer]); this.offset=0; }
      this.port.postMessage({type:'flushed'});
    };
  }
  process(inputs) {
    if(this.stopped) return true;
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let sample = 0;
      for (const channel of channels) sample += channel[i] || 0;
      this.samples[this.offset++] = sample / channels.length;
      if (this.offset === this.samples.length) {
        this.port.postMessage(this.samples, [this.samples.buffer]);
        this.samples = new Float32Array(2048); this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm-recorder', PCMRecorder);
