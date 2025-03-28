// main.js
const { app, BrowserWindow, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const { Client } = require('ssh2');
const { getAllSSHConnections, getSSHConfigForAlias } = require('./sshConfigHelper');

let mainWindow;
let ssh;

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    mainWindow.loadFile('index.html');
    mainWindow.setMenu(null);
}

ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('toggle-fullscreen', () => {
    if (mainWindow) {
        const isFullScreen = mainWindow.isFullScreen();
        mainWindow.setFullScreen(!isFullScreen);
    }
});

ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.handle('get-ssh-connections', async () => {
    try {
        return getAllSSHConnections();
    } catch (err) {
        console.error("Error fetching SSH connections:", err);
        return [];
    }
});

ipcMain.handle('get-ssh-config', async (event, hostAlias) => {
    try {
        const config = getSSHConfigForAlias(hostAlias);
        return config;
    } catch (err) {
        console.error("Error retrieving SSH config for", hostAlias, ":", err.message);
        return { error: err.message };
    }
});

ipcMain.on('fetch-docker-stats', (event, connectionInput) => {
    let connectionData;
    try {
        if (!connectionInput || typeof connectionInput.hostAlias !== 'string') {
            event.reply('docker-stats-error', 'Invalid host alias.');
            return;
        }

        connectionData = getSSHConfigForAlias(connectionInput.hostAlias);
    } catch (err) {
        event.reply('docker-stats-error', err.message);
        return;
    }

    ssh = new Client();
    ssh.on('ready', () => {
        const cmd = 'docker stats --no-stream --format "{{json .}}"';
        ssh.exec(cmd, (err, stream) => {
            if (err) {
                event.reply('docker-stats-error', err.message);
                return;
            }
            let dataBuffer = '';
            stream.on('data', data => {
                dataBuffer += data.toString();
            });
            stream.stderr.on('data', data => {
                console.error(`STDERR: ${data}`);
            });
            stream.on('close', () => {
                ssh.end();
                event.reply('docker-stats-data', dataBuffer);
            });
        });
    });

    ssh.on('error', err => {
        event.reply('docker-stats-error', err.message);
    });

    ssh.connect(connectionData);
});

ipcMain.handle('get-native-theme', () => {
    return nativeTheme.shouldUseDarkColors;
});

app.on('before-quit', () => {
    if (ssh && ssh.state === 'connected') {
        ssh.end();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.whenReady().then(() => {
    createMainWindow();
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}).catch((error) => {
    console.error('Error during app initialization:', error);
});

process.on('uncaughtException', (err) => {
    console.error('An unhandled exception occurred:', err);
});