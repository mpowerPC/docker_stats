// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('myStore', {
  get: (key, defaultValue) => ipcRenderer.invoke('store-get', key, defaultValue),
  set: (key, value) => ipcRenderer.invoke('store-set', key, value)
});

contextBridge.exposeInMainWorld('electronAPI', {
  getShouldUseDarkColors: async () => {
    try {
      return await ipcRenderer.invoke('get-native-theme');
    } catch (error) {
      return false;
    }
  },
  getSSHConnections: () => ipcRenderer.invoke('get-ssh-connections'),
  getDockerApps: (connectionAlias) => ipcRenderer.invoke('get-docker-apps', connectionAlias),
  startDockerStats: (connectionInput) => ipcRenderer.send('start-docker-stats', connectionInput),
  stopDockerStats: (connectionInput) => ipcRenderer.send('stop-docker-stats', connectionInput),
  send: (channel, data) => ipcRenderer.send(channel, data),
  receive: (channel, func) =>
    ipcRenderer.on(channel, (event, ...args) => func(...args))
});
