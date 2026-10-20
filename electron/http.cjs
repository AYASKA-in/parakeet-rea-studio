const { setTimeout: delay } = require('node:timers/promises');

// Retry only before a response stream begins. Never replay a partial answer.
async function fetchWithRetry(url, options, { fetchImpl = fetch, wait = delay, onRetry = () => {} } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    try { response = await fetchImpl(url, options); }
    catch (error) {
      if (attempt || options.signal?.aborted || error.name !== 'TypeError') throw error;
    }
    if (response && (attempt || ![408, 500, 502, 503, 504].includes(response.status))) return response;
    await response?.body?.cancel();
    onRetry();
    await wait(600, undefined, { signal: options.signal });
  }
}
module.exports = { fetchWithRetry };
