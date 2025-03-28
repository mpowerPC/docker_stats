// renderer.js
document.getElementById('settingsButton').addEventListener('click', () => {
    setActiveTab('ssh');
    document.getElementById('settingsOverlay').style.display = 'block';
});

document.getElementById('closeSettingsButton').addEventListener('click', () => {
    document.getElementById('settingsOverlay').style.display = 'none';
});

document.getElementById('menuSSHConnections').addEventListener('click', () => {
    setActiveTab('ssh');
});

document.getElementById('menuDockerFields').addEventListener('click', () => {
    setActiveTab('docker');
});

document.getElementById('menuAppearance').addEventListener('click', () => {
    setActiveTab('appearance');
});

document.getElementById('closeButton').addEventListener('click', () => {
    window.electronAPI.send('close-window');
});

document.getElementById('minimizeButton').addEventListener('click', () => {
    window.electronAPI.send('minimize-window');
});

document.getElementById('fullscreenButton').addEventListener('click', () => {
    window.electronAPI.send('toggle-fullscreen');
});

document.getElementById('fetchButton').addEventListener('click', () => {
    const activeConnection = localStorage.getItem('activeConnection');
    if (!activeConnection) {
        return alert('No active connection selected. Please go to Settings and choose one.');
    }
    window.electronAPI.send('fetch-docker-stats', { hostAlias: activeConnection });
});

window.electronAPI.receive('docker-stats-data', (data) => {
    const statsContainer = document.getElementById('statsContainer');
    const keysRaw = localStorage.getItem('dockerKeys');
    const selectedKeys = keysRaw ? JSON.parse(keysRaw) : [];
    let stats = [];
    data.split('\n').forEach(line => {
        if (line.trim().length) {
            try {
                const statObj = JSON.parse(line);
                stats.push(statObj);
            } catch (error) {
                console.error('Error parsing JSON:', error);
            }
        }
    });
    statsContainer.innerHTML = '';
    if (stats.length === 0) {
        statsContainer.textContent = 'No docker stats to display.';
        return;
    }
    const headerKeys = selectedKeys.length ? selectedKeys : Object.keys(stats[0]);
    let tableHTML = '<table>';
    tableHTML += '<thead><tr>';
    headerKeys.forEach(key => tableHTML += `<th>${key}</th>`);
    tableHTML += '</tr></thead>';
    tableHTML += '<tbody>';
    stats.forEach(stat => {
        tableHTML += '<tr>';
        headerKeys.forEach(key => tableHTML += `<td>${stat[key] || '-'}</td>`);
        tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table>';
    statsContainer.innerHTML = tableHTML;
});

window.electronAPI.receive('docker-stats-error', (errorMessage) => {
    document.getElementById('statsContainer').textContent = `Error: ${errorMessage}`;
});

function setActiveTab(tab) {
    document.querySelectorAll('.settingsMenu .menuItem').forEach(item => {
        item.classList.remove('active');
    });

    document.querySelectorAll('.settingsPanel').forEach(panel => {
        panel.style.display = 'none';
    });

    document.getElementById('sshApplyButton').style.display = 'none';
    document.getElementById('dockerApplyButton').style.display = 'none';
    document.getElementById('themeApplyButton').style.display = 'none';

    const headerTitle = document.getElementById('settingsPanelTitle');

    if (tab === 'ssh') {
        document.getElementById('menuSSHConnections').classList.add('active');
        headerTitle.textContent = 'SSH Connections';
        document.getElementById('settingsSSHConnections').style.display = 'block';
        document.getElementById('sshApplyButton').style.display = 'block';
        renderSSHConnections();
    } else if (tab === 'docker') {
        document.getElementById('menuDockerFields').classList.add('active');
        headerTitle.textContent = 'Filter Docker Stats Fields';
        document.getElementById('settingsDockerFields').style.display = 'block';
        document.getElementById('dockerApplyButton').style.display = 'block';
    } else if (tab === 'appearance') {
        document.getElementById('menuAppearance').classList.add('active');
        headerTitle.textContent = 'Appearance';
        document.getElementById('settingsAppearance').style.display = 'block';
        document.getElementById('themeApplyButton').style.display = 'block';
        window.electronAPI.getShouldUseDarkColors().then(isDark => {
            const currentTheme = localStorage.getItem('theme') || (isDark ? 'dark' : 'light');
            const radioEl = document.querySelector(`input[name="theme"][value="${currentTheme}"]`);
            if (radioEl) {
                radioEl.checked = true;
            }
            document.querySelector('#appearanceForm input[name="theme"]').value = currentTheme;
        }).catch(err => {
            console.error("Error retrieving system theme:", err);
        });
    }
}

function renderSSHConnections() {
    window.electronAPI.getSSHConnections().then(hosts => {
        const dropdown = document.getElementById('sshDropdown');
        dropdown.innerHTML = ''; // Clear previous options

        if (!hosts || hosts.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'No SSH connections found in .ssh/config';
            option.disabled = true;
            dropdown.appendChild(option);
            return;
        }

        hosts.forEach(host => {
            const option = document.createElement('option');
            option.value = host;
            option.textContent = host;
            dropdown.appendChild(option);
        });

        const activeConn = localStorage.getItem('activeConnection');
        if (activeConn) {
            dropdown.value = activeConn;
        }
    }).catch(err => {
        console.error("Error fetching SSH connections:", err);
        const dropdown = document.getElementById('sshDropdown');
        dropdown.innerHTML = '<option>Error loading connections</option>';
    });
}

document.getElementById('sshApplyButton').addEventListener('click', () => {
    const dropdown = document.getElementById('sshDropdown');
    const selectedHost = dropdown.value;
    if (selectedHost) {
        localStorage.setItem('activeConnection', selectedHost);
    }
});

document.getElementById('dockerApplyButton').addEventListener('click', (e) => {
    e.preventDefault();
    const checkboxes = document.querySelectorAll('#keysForm input[name="dockerKey"]:checked');
    const selectedKeys = [];
    checkboxes.forEach(checkbox => {
        selectedKeys.push(checkbox.value);
    });
    localStorage.setItem('dockerKeys', JSON.stringify(selectedKeys));
    alert('Docker stats display keys applied.');
});

const themeOptions = document.querySelectorAll('.theme-option');

themeOptions.forEach(option => {
    option.addEventListener('click', () => {
        themeOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        document.querySelector('#appearanceForm input[name="theme"]').value = option.getAttribute('data-theme');
    });
});

document.getElementById('themeApplyButton').addEventListener('click', () => {
    const hiddenInput = document.querySelector('#appearanceForm input[name="theme"]');
    const selectedTheme = hiddenInput.value;
    if (selectedTheme) {
        if (selectedTheme === "default") {
            localStorage.removeItem('theme');
            window.electronAPI.getShouldUseDarkColors().then(isDark => {
                const systemTheme = isDark ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', systemTheme);
                updateAppearanceSelection(systemTheme);
            }).catch(err => {
                console.error("Error getting system theme:", err);
            });
        } else {
            localStorage.setItem('theme', selectedTheme);
            document.documentElement.setAttribute('data-theme', selectedTheme);
            updateAppearanceSelection(selectedTheme);
        }
    }
});

function updateAppearanceSelection(currentTheme) {
    document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('selected'));
    const selectedOption = document.querySelector(`.theme-option[data-theme="${currentTheme}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
    document.querySelector('#appearanceForm input[name="theme"]').value = currentTheme;
}

function initTheme() {
    let storedTheme = localStorage.getItem('theme');
    if (!storedTheme) {
        storedTheme = window.electronAPI.getShouldUseDarkColors() ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', storedTheme);
    updateAppearanceSelection(storedTheme);
}

document.addEventListener("DOMContentLoaded", initTheme);
