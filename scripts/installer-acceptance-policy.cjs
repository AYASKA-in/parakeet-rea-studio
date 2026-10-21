const path = require('node:path');
function disposableHost(env, platform, optedIn) {
  if (!optedIn || platform !== 'win32' || env.GITHUB_ACTIONS !== 'true' || env.RUNNER_OS !== 'Windows' || env.RUNNER_ENVIRONMENT !== 'github-hosted') {
    throw new Error('Install lifecycle acceptance requires --disposable-host on a GitHub-hosted Windows runner. Never run it in a personal or self-hosted account.');
  }
  if (!/^[a-z]:\\/i.test(env.RUNNER_TEMP || '') || /\s/.test(env.RUNNER_TEMP)) throw new Error('NSIS acceptance requires an absolute runner temporary path without spaces.');
}
function contained(parent, child) {
  const relative = path.win32.relative(path.win32.resolve(parent), path.win32.resolve(child));
  return Boolean(relative) && relative !== '..' && !relative.startsWith('..\\') && !path.win32.isAbsolute(relative);
}
function installationTarget(env, id) {
  if (!/^\d+$/.test(String(id))) throw new Error('Invalid acceptance run ID.');
  const root = path.win32.join(env.RUNNER_TEMP, 'parakeet-lifecycle-' + id);
  const install = path.win32.join(root, 'installed');
  if (!contained(env.RUNNER_TEMP, root) || !contained(root, install)) throw new Error('Installer target escaped its disposable root.');
  return {root, install};
}
module.exports = {disposableHost, contained, installationTarget};
