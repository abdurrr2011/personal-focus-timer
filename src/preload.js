const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('focusTracker', Object.freeze({
  getSnapshot: () => ipcRenderer.invoke('state:get'),
  getSessionHistory: () => ipcRenderer.invoke('history:get'),
  clearSessionHistory: () => ipcRenderer.invoke('history:clear'),
  exportData: (kind) => ipcRenderer.invoke('data:export', kind),
  command: (action, value) => ipcRenderer.invoke('timer:command', { action, value }),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  chooseAlertSound: () => ipcRenderer.invoke('sound:choose'),
  resetAlertSound: () => ipcRenderer.invoke('sound:reset'),
  windowAction: (action) => ipcRenderer.invoke('window:action', action),
  onTick: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('timer:tick', listener);
    return () => ipcRenderer.removeListener('timer:tick', listener);
  },
  onComplete: (callback) => {
    const listener = (_event, snapshot) => callback(snapshot);
    ipcRenderer.on('timer:complete', listener);
    return () => ipcRenderer.removeListener('timer:complete', listener);
  },
  onHistoryError: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('history:error', listener);
    return () => ipcRenderer.removeListener('history:error', listener);
  },
}));
