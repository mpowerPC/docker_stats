// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getShouldUseDarkColors: async () => {
        try {
            return await ipcRenderer.invoke('get-native-theme');
        } catch (error) {
            return false;
        }
    },
    getSSHConnections: () => ipcRenderer.invoke('get-ssh-connections'),
    fetchDockerStats: (connectionInput) => ipcRenderer.invoke('fetch-docker-stats', connectionInput),
    send: (channel, data) => ipcRenderer.send(channel, data),
    receive: (channel, func) =>
        ipcRenderer.on(channel, (event, ...args) => func(...args))
});