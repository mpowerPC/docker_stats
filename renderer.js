// renderer.js
const { ipcRenderer } = require('electron');

document.getElementById('fetchButton').addEventListener('click', () => {
    const activeConnection = localStorage.getItem('activeConnection');
    if (!activeConnection) {
        return alert('No active connection selected. Please set one in the Manage SSH Connections window.');
    }
    ipcRenderer.send('fetch-docker-stats', { hostAlias: activeConnection });
});

ipcRenderer.on('docker-stats-data', (event, data) => {
    const containerFilter = localStorage.getItem('dockerFilter') || '';
    const keysRaw = localStorage.getItem('dockerKeys');
    let selectedKeys = keysRaw ? JSON.parse(keysRaw) : [];

    let stats = [];
    data.split('\n').forEach(line => {
        if (line.trim().length) {
            try {
                let statObj = JSON.parse(line);
                if (containerFilter && statObj.Name && !statObj.Name.includes(containerFilter)) {
                    return;
                }
                stats.push(statObj);
            } catch (error) {
                console.error('Error parsing JSON:', error);
            }
        }
    });

    const container = document.getElementById('statsContainer');
    container.innerHTML = '';

    if (stats.length === 0) {
        container.textContent = 'No docker stats to display.';
        return;
    }

    let headerKeys = selectedKeys.length > 0 ? selectedKeys : Object.keys(stats[0]);
    let tableHTML = '<table>';
    tableHTML += '<thead><tr>';
    headerKeys.forEach(key => {
        tableHTML += `<th>${key}</th>`;
    });
    tableHTML += '</tr></thead>';
    tableHTML += '<tbody>';
    stats.forEach(stat => {
        tableHTML += '<tr>';
        headerKeys.forEach(key => {
            tableHTML += `<td>${(stat[key] !== undefined ? stat[key] : '-')}</td>`;
        });
        tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table>';

    container.innerHTML = tableHTML;
});

ipcRenderer.on('docker-stats-error', (event, errorMessage) => {
    document.getElementById('statsContainer').textContent = `Error: ${errorMessage}`;
});