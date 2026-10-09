const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('api', {
  pathOf: (f) => webUtils.getPathForFile(f),
  pick: () => ipcRenderer.invoke('pick'),
  supported: (f) => ipcRenderer.invoke('supported', f),
  compress: (o) => ipcRenderer.invoke('compress', o),
  reveal: (f) => ipcRenderer.invoke('reveal', f),
  onProgress: (cb) => ipcRenderer.on('progress', (_, d) => cb(d)),
});
