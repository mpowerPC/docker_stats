// manage.js
const fs = require('fs');
const path = require('path');
const SSHConfig = require('ssh-config');

function loadSSHConfig() {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const configPath = path.join(homeDir, '.ssh', 'config');
    if (!fs.existsSync(configPath)) {
        return [];
    }
    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = SSHConfig.parse(configContent);
    let hosts = [];

    config.forEach(entry => {
        if (entry.param && entry.param.toLowerCase() === 'host') {
            if (Array.isArray(entry.value)) {
                entry.value.forEach(alias => {
                    if (alias !== '*') hosts.push(alias);
                });
            } else {
                if (entry.value !== '*') {
                    hosts.push(entry.value);
                }
            }
        }
    });
    return hosts;
}

function renderConnections() {
    const sshList = document.getElementById('sshList');
    sshList.innerHTML = '';
    const hosts = loadSSHConfig();
    if (hosts.length === 0) {
        sshList.innerHTML = '<li>No SSH connections found in .ssh/config.</li>';
        return;
    }
    hosts.forEach(host => {
        const li = document.createElement('li');
        li.textContent = host + ' ';
        const selectButton = document.createElement('button');
        selectButton.textContent = 'Select';
        selectButton.addEventListener('click', () => {
            localStorage.setItem('activeConnection', host);
            alert('Active connection set to ' + host);
        });
        li.appendChild(selectButton);
        sshList.appendChild(li);
    });
}

document.getElementById('keysForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const checkboxes = document.querySelectorAll('input[name="dockerKey"]:checked');
    const selectedKeys = [];
    checkboxes.forEach(checkbox => { selectedKeys.push(checkbox.value); });
    localStorage.setItem('dockerKeys', JSON.stringify(selectedKeys));
    alert('Docker stats display keys saved.');
});

renderConnections();