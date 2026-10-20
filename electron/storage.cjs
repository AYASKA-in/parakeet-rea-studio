const fs = require('node:fs/promises');
const path = require('node:path');

function createStorage(directory, onRecovery = () => {}) {
  let chain = Promise.resolve();
  const at = name => path.join(typeof directory === 'function' ? directory() : directory, name);
  return {
    async read(name, fallback) {
      try { return JSON.parse(await fs.readFile(at(name), 'utf8')); }
      catch (error) {
        try {
          const restored = JSON.parse(await fs.readFile(at(`${name}.bak`), 'utf8'));
          onRecovery(`${name} was recovered from its previous saved copy. The latest pending changes may be missing.`);
          return restored;
        } catch { if (error.code === 'ENOENT') return fallback; }
        throw new Error(`${name} could not be read. Preserve the file and its .bak copy before resetting it.`);
      }
    },
    write(name, value, { preservePrevious = true } = {}) {
      const text = JSON.stringify(value, null, 2);
      const operation = chain.catch(() => {}).then(async () => {
        await fs.mkdir(path.dirname(at(name)), { recursive: true });
        // Keep only a valid previous snapshot, never replace recovery data with corrupt bytes.
        try {
          const previous = preservePrevious ? await fs.readFile(at(name), 'utf8') : text; JSON.parse(previous);
          await fs.writeFile(at(`${name}.bak.tmp`), previous, { mode: 0o600 });
          await fs.rename(at(`${name}.bak.tmp`), at(`${name}.bak`));
        } catch (error) { if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error; }
        const file = await fs.open(at(`${name}.tmp`), 'w', 0o600);
        try { await file.writeFile(text, 'utf8'); await file.sync(); } finally { await file.close(); }
        await fs.rename(at(`${name}.tmp`), at(name));
      });
      chain = operation; return operation;
    },
    drain() { return chain; },
  };
}
module.exports = { createStorage };
