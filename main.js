// main.js
import {app, BrowserWindow, globalShortcut, ipcMain, nativeTheme} from 'electron';
import path from 'path';
import {fileURLToPath} from 'url';
import {Client} from 'ssh2';
import Store from 'electron-store';
import {getAllSSHConnections, getSSHConfigForAlias} from './sshConfigHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const store = new Store();
const activeDockerStreams = {};
let mainWindow;
let ssh;

function saveBounds() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        store.set('windowBounds', mainWindow.getBounds());
    }
}

function createMainWindow() {
    const savedBounds = store.get('windowBounds') || {width: 800, height: 600};

    mainWindow = new BrowserWindow({
        width: savedBounds.width,
        height: savedBounds.height,
        minHeight: 40,
        minWidth: 250,
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile('index.html');
    mainWindow.setMenu(null);

    mainWindow.on('resize', saveBounds);
    mainWindow.on('move', saveBounds);
    mainWindow.on('close', saveBounds);
}

ipcMain.handle('store-get', (event, key, defaultValue) => {
    return store.get(key, defaultValue);
});

ipcMain.handle('store-set', (event, key, value) => {
    store.set(key, value);
    return true;
});

ipcMain.on('start-docker-stats', (event, {hostAlias, dockerAppsFilter, tableFields}) => {
    if (!hostAlias || typeof hostAlias !== 'string') {
        event.sender.send('docker-stats-update', {host: hostAlias, error: 'Invalid host alias.'});
        return;
    }

    let connectionData;
    try {
        connectionData = getSSHConfigForAlias(hostAlias);
    } catch (err) {
        event.sender.send('docker-stats-update', {host: hostAlias, error: err.message});
        return;
    }

    const maxRetries = 5;
    let retryCount = 0;
    const retryDelay = 5000;

    function connectClient() {
        const client = new Client();

        client.on('ready', () => {
            let containers = '';
            if (Array.isArray(dockerAppsFilter) && dockerAppsFilter.length > 0) {
                containers = dockerAppsFilter.join(' ') + ' ';
            }

            let formatString = '{{json .}}';
            if (Array.isArray(tableFields) && tableFields.length > 0) {
                const parts = tableFields.map(key => `"${key}":"{{.${key}}}"`);
                formatString = `{${parts.join(',')}}`;
            }

            let cmd = `docker stats ${containers}--format '${formatString}'`;
            client.exec(cmd, (err, stream) => {
                if (err) {
                    client.end();
                    event.sender.send('docker-stats-update', {host: hostAlias, error: err.message});
                    return;
                }

                activeDockerStreams[hostAlias] = client;

                stream.on('data', (data) => {
                    let lines = data.toString().split('\n').filter(line => line.trim().length > 0);
                    let parsedUpdates = [];
                    lines.forEach(line => {
                        try {
                            if (line.trim().length > 25) {
                                const parsed = JSON.parse(line);
                                parsedUpdates.push(parsed);
                            }
                        } catch (e) {
                            console.error(`Error parsing docker stats JSON for ${hostAlias}:`, e);
                        }
                    });

                    if (parsedUpdates.length > 0) {
                        event.sender.send('docker-stats-update', {host: hostAlias, data: parsedUpdates});
                    }
                });

                stream.on('close', () => {
                    client.end();
                    delete activeDockerStreams[hostAlias];
                });
            });
        });

        client.on('error', (err) => {
            console.error(`Connection error for ${hostAlias}:`, err.message);

            if (retryCount < maxRetries) {
                retryCount++;
                console.log(`Retrying connection for ${hostAlias} (${retryCount}/${maxRetries})...`);
                setTimeout(connectClient, retryDelay);
            } else {
                event.sender.send('docker-stats-update', {
                    host: hostAlias,
                    error: `Connection failed after ${maxRetries} retries: ${err.message}`
                });
            }
        });

        client.connect(connectionData);
    }

    connectClient();
});

ipcMain.on('stop-docker-stats', (event, {hostAlias}) => {
    if (activeDockerStreams[hostAlias]) {
        activeDockerStreams[hostAlias].end();
        delete activeDockerStreams[hostAlias];
    }
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
        return {error: err.message};
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
                        return reject({error: err.message});
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
                reject({error: err.message});
            });
            client.connect(sshConfig);
        });
    } catch (err) {
        return {error: err.message};
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

    globalShortcut.register('CommandOrControl+Shift+I', () => {
        if (mainWindow) {
            const isVisible = mainWindow.webContents.isDevToolsOpened();
            if (isVisible) {
                mainWindow.webContents.closeDevTools();
            } else {
                mainWindow.webContents.openDevTools();
            }
        }
    });

}).catch((error) => {
    console.error('Error during app initialization:', error);
});

process.on('uncaughtException', (err) => {
    console.error('An unhandled exception occurred:', err);
});
