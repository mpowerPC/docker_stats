// main.js
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { Client } = require('ssh2');
const getSSHConfigForAlias = require('./sshConfigHelper');

let mainWindow;

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });
    mainWindow.loadFile('index.html');

    const template = [
        {
            label: 'File',
            submenu: [
                { role: 'quit' }
            ],
        }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

}

app.whenReady().then(createMainWindow);

ipcMain.on('fetch-docker-stats', (event, connectionInput) => {
    let connectionData;
    try {
        if (connectionInput && connectionInput.hostAlias) {
            connectionData = getSSHConfigForAlias(connectionInput.hostAlias);
        } else {
            throw new Error('Host alias is required in the connection input.');
        }
    } catch (err) {
        event.reply('docker-stats-error', err.message);
        return;
    }

    const ssh = new Client();
    ssh.on('ready', () => {
        console.log('SSH connection established using config file.');
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
        console.error(`SSH Error: ${err}`);
        event.reply('docker-stats-error', err.message);
    });

    ssh.connect(connectionData);
});