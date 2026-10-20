const { sanitizeWorkspace } = require('./core.cjs');
const FORMAT = 'parakeet-workspace-dpapi-v1';
function retainedWorkspace(value, settings, now = Date.now()) {
  const workspace = sanitizeWorkspace(value);
  if (settings.historyMode === 'ephemeral') return { context: {}, sessions: [] };
  const days = Number(settings.retentionDays) || 0;
  if (!days) return workspace;
  return { ...workspace, sessions: workspace.sessions.filter(session => {
    const at = Date.parse(session.updatedAt || session.createdAt);
    return !Number.isFinite(at) || at >= now - days * 86400000;
  }) };
}
async function encodeWorkspace(value, settings, crypto) {
  const retained = retainedWorkspace(value, settings);
  if (!settings.encryptWorkspace || settings.historyMode === 'ephemeral') return retained;
  if (!await crypto.isAsyncEncryptionAvailable()) throw new Error('Windows workspace encryption is unavailable. No plaintext fallback was saved.');
  return { format: FORMAT, ciphertext: (await crypto.encryptStringAsync(JSON.stringify(retained))).toString('base64') };
}
async function decodeWorkspace(value, crypto) {
  if (value?.format && value.format !== FORMAT) throw new Error('Unsupported workspace format. Upgrade to its compatible app version; no data was reset.');
  if (value?.format !== FORMAT) return sanitizeWorkspace(value);
  if (typeof value.ciphertext !== 'string' || value.ciphertext.length > 40 * 1024 * 1024) throw new Error('Invalid encrypted workspace. Preserve the profile before recovery.');
  try {
    if (!await crypto.isAsyncEncryptionAvailable()) throw new Error('Unavailable');
    return sanitizeWorkspace(JSON.parse((await crypto.decryptStringAsync(Buffer.from(value.ciphertext, 'base64'))).result));
  } catch { throw new Error('Workspace decryption failed. Preserve your profile and restore it under the original Windows user; no data was reset.'); }
}
module.exports = { retainedWorkspace, encodeWorkspace, decodeWorkspace, FORMAT };
