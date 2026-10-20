const { contextBridge, ipcRenderer } = require('electron');
const invoke = channel => value => ipcRenderer.invoke(channel, value);
const subscribe = channel => callback => {
  const listener = (_event, data) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
contextBridge.exposeInMainWorld('copilot', {
  isDesktop: true,
  getSettings: invoke('settings:get'), saveSettings: invoke('settings:save'),
  getProtectionStatus: invoke('protection:get'),
  getRuntime:invoke('app:runtime'),lifecycleReady:invoke('app:lifecycle-ready'),onLifecycle:subscribe('app:lifecycle'),
  getShortcuts:invoke('shortcuts:get'),retryShortcuts:invoke('shortcuts:retry'),onShortcutsChanged:subscribe('shortcuts:changed'),
  startLive: invoke('live:start'), sendLiveAudio: invoke('live:audio'), endLiveAudio: invoke('live:end-audio'), stopLive: invoke('live:stop'),
  onLiveTranscript: subscribe('live:transcript'), onLiveError: subscribe('live:error'),
  onLiveInterim: subscribe('live:interim'), onLiveStatus: subscribe('live:status'), getStorageStatus: invoke('storage:status'),
  loadWorkspace: invoke('workspace:get'), saveWorkspace: invoke('workspace:save'),
  previewRequest: invoke('provider:preview'), transcribe: invoke('provider:transcribe'), generate: invoke('provider:generate'), cancel: invoke('provider:cancel'),
  onAnswer: subscribe('answer:delta'), onShortcut: subscribe('shortcut'),
  toggleOverlay: invoke('overlay:toggle'), setOverlay: invoke('overlay:set'), getOverlay: invoke('overlay:get'), onOverlay: subscribe('overlay:state'),
  getOverlayPreferences: invoke('overlay:preferences:get'), setOverlayPreferences: invoke('overlay:preferences:set'), onOverlayCommand: subscribe('overlay:command'),
  captureScreenshot: invoke('screen:capture'),
  validateScreenshot: invoke('screen:validate'),
  onDisplaysChanged: subscribe('screen:changed'),
  listDisplays: invoke('screen:list'), moveOverlay: invoke('overlay:move'),
  requestAction: invoke('overlay:action'), importDocument: invoke('document:import'), exportSession: invoke('session:export'),
  windowControl: invoke('window:control'),
  onPrepareClose: subscribe('app:prepare-close'), readyToClose: invoke('app:close-ready'),
});
