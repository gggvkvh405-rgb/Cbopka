import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('cbopkaAPI', {
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  setServerUrl: (url) => ipcRenderer.invoke('set-server-url', url),
  getVersion: () => ipcRenderer.invoke('get-version')
});
