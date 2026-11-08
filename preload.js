const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desk', {
  onKey: (cb) => ipcRenderer.on('key', (_e, k) => cb(k)),
});
