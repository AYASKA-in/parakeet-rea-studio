// Owns startup reservations across asynchronous consent, credentials and setup.
class LiveSession {
  constructor() { this.connections = new Map(); this.epoch = 0; this.starting = false; }
  get busy() { return this.starting || this.connections.size > 0; }
  async start(sources, prepare, create) {
    if (this.busy) throw new Error('A live transcription session is already running or starting.');
    this.starting = true;
    const epoch = ++this.epoch, owned = new Map();
    const check = () => { if (this.epoch !== epoch) throw new Error('Listening was stopped.'); };
    try {
      const prepared = await prepare(); check();
      for (const source of sources) {
        check(); const connection = create(source, prepared);
        owned.set(source, connection); this.connections.set(source, connection);
        await connection.start(); check();
      }
      return { ready: true, sources };
    } catch (error) {
      for (const [source, connection] of owned) {
        connection.close();
        if (this.connections.get(source) === connection) this.connections.delete(source);
      }
      throw error;
    } finally { this.starting = false; }
  }
  async stop() {
    ++this.epoch;
    const owned = [...this.connections];
    await Promise.allSettled(owned.map(([, connection]) => connection.stop()));
    for (const [source, connection] of owned) if (this.connections.get(source) === connection) this.connections.delete(source);
    return { ok: true };
  }
  close() {
    ++this.epoch;
    for (const connection of this.connections.values()) connection.close();
    this.connections.clear();
  }
}
module.exports = { LiveSession };
