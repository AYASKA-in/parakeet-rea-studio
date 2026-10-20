class RuntimeGate {
  constructor() { this.epoch = 0; this.reasons = new Set(); this.settling = false; }
  get blocked() { return this.reasons.size > 0 || this.settling; }
  snapshot() { return { epoch:this.epoch, blocked:this.blocked, needsStop:this.settling, reasons:[...this.reasons], lastReason:this.lastReason || null }; }
  begin() { if(this.blocked) throw new Error('Desktop recovery is in progress. Wait for Windows to return, then start again.'); return this.epoch; }
  assert(epoch) { if(this.blocked || epoch!==this.epoch) throw new Error('This operation was interrupted by desktop recovery. Start it again when ready.'); }
  pause(reason) { if(this.reasons.has(reason)) return false;this.reasons.add(reason);this.lastReason=reason;this.settling=true;++this.epoch;return true; }
  resume(reason) { return this.reasons.delete(reason); }
  acknowledge(epoch) { if(epoch===this.epoch) this.settling=false; }
  invalidate() { ++this.epoch; }
}

class ShortcutRegistry {
  constructor(adapter, entries) { this.adapter=adapter;this.entries=entries;this.registered=new Set(); }
  status() { return this.entries.map(({id,label,accelerator})=>({id,label,accelerator,registered:this.registered.has(id)})); }
  refresh({reset=false}={}) {
    for(const entry of this.entries) {
      if(reset && this.registered.has(entry.id)) { try {this.adapter.unregister(entry.accelerator);}catch{} this.registered.delete(entry.id); }
      if(this.registered.has(entry.id) && this.adapter.isRegistered(entry.accelerator)) continue;
      this.registered.delete(entry.id);
      try { if(this.adapter.register(entry.accelerator,entry.run)) this.registered.add(entry.id); }catch{}
    }
    return this.status();
  }
}
module.exports={RuntimeGate,ShortcutRegistry};
