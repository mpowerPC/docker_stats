const { app, BrowserWindow, ipcMain, Menu, nativeTheme } = require('electron');
const { Client } = require('ssh2');
const getSSHConfigForAlias = require('./sshConfigHelper');

let mainWindow;

function createMainWindow() {
    const bgColor = nativeTheme.shouldUseDarkColors ? '#333' : '#fff';
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        backgroundColor: bgColor,
        vibrancy: process.platform === 'darwin' ? (nativeTheme.shouldUseDarkColors ? 'dark' : 'light') : undefined,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
    mainWindow.loadFile('index.html');
}

function createManageWindow() {
    const manageWindow = new BrowserWindow({
        width: 600,
        height: 600,
        title: 'Manage SSH Connections',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
    manageWindow.loadFile('manage.html');
}

function createAppMenu() {
    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Manage SSH Connections',
                    click: () => {
                        createManageWindow();
                    },
                },
                { role: 'quit' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'toggleDevTools' },
            ],
        },
    ];
    return Menu.buildFromTemplate(menuTemplate);
}

app.whenReady().then(() => {
    createMainWindow();
    const menu = createAppMenu();
    Menu.setApplicationMenu(menu);
});

ipcMain.on('fetch-docker-stats', (event, connectionInput) => {
    let connectionData;
    try {
        if (connectionInput && connectionInput.hostAlias) {
            connectionData = getSSHConfigForAlias(connectionInput.hostAlias);
        } else {
            event.reply('docker-stats-error', 'Host alias is required.');
            return;
        }
    } catch (err) {
        event.reply('docker-stats-error', err.message);
        return;
    }

    const ssh = new Client();
    ssh.on('ready', () => {
        const cmd = 'docker stats --no-stream --format "{{json .}}"';
        ssh.exec(cmd, (err, stream) => {
            if (err) {
                event.reply('docker-stats-error', err.message);
                return;
            }
            let dataBuffer = '';
            stream.on('data', (data) => {
                dataBuffer += data.toString();
            });
            stream.stderr.on('data', (data) => {
                console.error(`STDERR: ${data}`);
            });
            stream.on('close', () => {
                ssh.end();
                event.reply('docker-stats-data', dataBuffer);
            });
        });
    });

    ssh.on('error', (err) => {
        event.reply('docker-stats-error', err.message);
    });

    ssh.connect(connectionData);
});