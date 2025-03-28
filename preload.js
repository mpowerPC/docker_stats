// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getShouldUseDarkColors: async () => {
        try {
            const result = await ipcRenderer.invoke('get-native-theme');
            return result;
        } catch (error) {
            return false;
        }
    },
    getSSHConnections: () => ipcRenderer.invoke('get-ssh-connections'),
    send: (channel, data) => ipcRenderer.send(channel, data),
    receive: (channel, func) =>
        ipcRenderer.on(channel, (event, ...args) => func(...args))
});