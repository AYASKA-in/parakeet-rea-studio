const { setTimeout: delay } = require('node:timers/promises');

function retryAfterMs(value, now = Date.now()) {
  if (!value) return null;
  const seconds = /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : null;
  const milliseconds = seconds === null ? Date.parse(value) - now : seconds * 1000;
  return Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : null;
}
function createHttpClient({ now = Date.now, random = Math.random, states = new Map() } = {}) {
  return async function fetchWithRetry(url, options = {}, { fetchImpl = fetch, wait = delay, onRetry = () => {}, deadlineAt = now() + 90000, maxAttempts = 2 } = {}) {
    maxAttempts = maxAttempts === 1 ? 1 : 2;
    options.signal?.throwIfAborted();
    const origin = new URL(url).origin;
    let state = states.get(origin);
    if (!state) { if (states.size >= 32) states.delete(states.keys().next().value); state = { failures: 0, until: 0 }; states.set(origin, state); }
    if (state.until > now()) {
      const error = new Error('Provider is cooling down after quota or repeated connection failures. Retry in ' + Math.ceil((state.until-now())/1000) + ' seconds.');
      error.code = 'PROVIDER_COOLDOWN'; error.retryAfterMs = state.until - now(); throw error;
    }
    const failed = () => { if (++state.failures >= 3) state.until = now() + 15000; };
    for (let attempt = 0; attempt < Math.max(1, Math.min(2, maxAttempts)); attempt++) {
      options.signal?.throwIfAborted();
      let response;
      try { response = await fetchImpl(url, options); }
      catch (error) {
        if (options.signal?.aborted || error.name !== 'TypeError') throw error;
        if (attempt + 1 >= maxAttempts) { failed(); throw error; }
      }
      if (response?.status === 429) {
        state.until = now() + Math.min(300000, Math.max(1000, retryAfterMs(response.headers.get('retry-after'), now()) ?? 30000));
        return response; // Do not automatically replay quota-rejected uploads.
      }
      const transient = !response || [408, 500, 502, 503, 504].includes(response.status);
      if (!transient) { state.failures = 0; state.until = 0; return response; }
      const hint = response && retryAfterMs(response.headers.get('retry-after'), now());
      const backoff = hint ?? Math.round(300 + random() * 600);
      if (attempt + 1 >= maxAttempts || backoff > 10000 || now() + backoff + 250 >= deadlineAt) {
        failed();
        if (hint > 10000) state.until = now() + Math.min(hint, 300000);
        if (response) return response;
        throw new Error('Provider connection failed before an answer began. Retry when the connection returns.');
      }
      await response?.body?.cancel();
      onRetry({ delayMs: backoff });
      await wait(backoff, undefined, { signal: options.signal });
    }
  };
}
const fetchWithRetry = createHttpClient();
module.exports = { fetchWithRetry, createHttpClient, retryAfterMs };
