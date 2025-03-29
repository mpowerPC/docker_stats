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
            nodeIntegration: false,
        },
    });
    mainWindow.loadFile('index.html');
    mainWindow.setMenu(null);
}

ipcMain.handle('fetch-docker-stats', async (event, { hostAlias, dockerAppsFilter }) => {
    if (!hostAlias || typeof hostAlias !== 'string') {
        throw new Error('Invalid host alias.');
    }

    let connectionData;
    try {
        connectionData = getSSHConfigForAlias(hostAlias);
    } catch (err) {
        throw new Error(err.message);
    }

    return new Promise((resolve, reject) => {
        const client = new Client();
        client.on('ready', () => {
            let cmd = 'docker stats --no-stream --format "{{json .}}"';
            if (Array.isArray(dockerAppsFilter) && dockerAppsFilter.length > 0) {
                cmd = `docker stats ${dockerAppsFilter.join(' ')} --no-stream --format "{{json .}}"`;
            }

            client.exec(cmd, (err, stream) => {
                if (err) {
                    client.end();
                    return reject(err.message);
                }
                let dataBuffer = '';
                stream.on('data', (data) => {
                    dataBuffer += data.toString();
                });
                stream.stderr.on('data', (data) => {
                    console.error(`STDERR: ${data}`);
                });
                stream.on('close', () => {
                    client.end();
                    resolve(dataBuffer);
                });
            });
        });

        client.on('error', err => {
            reject(err.message);
        });

        client.connect(connectionData);
    });
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
        return getSSHConfigForAlias(hostAlias);
    } catch (err) {
        console.error("Error retrieving SSH config for", hostAlias, ":", err.message);
        return { error: err.message };
    }
});

ipcMain.handle('get-docker-apps', async (event, connectionAlias) => {
    try {
        const sshConfig = getSSHConfigForAlias(connectionAlias);
        return await new Promise((resolve, reject) => {
            const client = new Client();
            client.on('ready', () => {
                client.exec('docker ps --format "{{.Names}}"', (err, stream) => {
                    if (err) {
                        client.end();
                        return reject({ error: err.message });
                    }
                    let output = '';
                    stream.on('data', data => {
                        output += data.toString();
                    });
                    stream.stderr.on('data', data => {
                        console.error(`STDERR: ${data}`);
                    });
                    stream.on('close', () => {
                        client.end();
                        const apps = output.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                        resolve(apps);
                    });
                });
            });
            client.on('error', err => {
                reject({ error: err.message });
            });
            client.connect(sshConfig);
        });
    } catch (err) {
        return { error: err.message };
    }
});

ipcMain.handle('get-native-theme', () => {
    return nativeTheme.shouldUseDarkColors;
});

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
})
.catch((error) => {
    console.error('Error during app initialization:', error);
});

process.on('uncaughtException', (err) => {
    console.error('An unhandled exception occurred:', err);
});
