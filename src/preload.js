const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('focusTracker', Object.freeze({
  getSnapshot: () => ipcRenderer.invoke('state:get'),
  command: (action, value) => ipcRenderer.invoke('timer:command', { action, value }),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
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
}));
