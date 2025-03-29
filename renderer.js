// renderer.js
const dockerStatsMap = new Map();

document.getElementById('closeButton').addEventListener('click', () => {
    window.electronAPI.send('close-window');
});

document.getElementById('minimizeButton').addEventListener('click', () => {
    window.electronAPI.send('minimize-window');
});

document.getElementById('fullscreenButton').addEventListener('click', () => {
    window.electronAPI.send('toggle-fullscreen');
});

document.getElementById('settingsButton').addEventListener('click', () => {
    const settingsButton = document.getElementById('settingsButton');
    if (settingsButton) {
        settingsButton.addEventListener('click', () => {
            setActiveTab('application');
            document.getElementById('settingsOverlay').style.display = 'block';
        });
    }
});

document.getElementById('closeSettingsButton').addEventListener('click', () => {
    const closeSettingsButton = document.getElementById('closeSettingsButton');
    if (closeSettingsButton) {
        closeSettingsButton.addEventListener('click', () => {
            document.getElementById('settingsOverlay').style.display = 'none';
        });
    }
});

document.getElementById('menuSSHConnections').addEventListener('click', () => {
    setActiveTab('ssh');
});

document.getElementById('menuTableFields').addEventListener('click', () => {
    setActiveTab('tableFilter');
});

document.getElementById('menuAppearance').addEventListener('click', () => {
    setActiveTab('appearance');
});

document.getElementById('menuApplication').addEventListener('click', () => {
    setActiveTab('application');
});

let isStreaming = false;

async function startStreaming() {
    let sshSettingsJSON = localStorage.getItem('sshConnectionSettings');
    if (!sshSettingsJSON) {
        return alert("No SSH connection settings found. Please configure connections in Settings.");
    }
    let sshSettings;
    try {
        sshSettings = JSON.parse(sshSettingsJSON);
    } catch (err) {
        console.error("Error parsing SSH settings:", err);
        return alert("Error reading SSH settings.");
    }

    const enabledConnections = Object.keys(sshSettings).filter(host =>
        sshSettings[host].useConnectionEnabled === "true"
    );
    if (enabledConnections.length === 0) {
        return alert("No enabled SSH connections found. Please enable one in Settings.");
    }

    enabledConnections.forEach(host => {
        const hostSettings = sshSettings[host] || {};
        const dockerAppsFilter = hostSettings.dockerAppsFilter || [];
        window.electronAPI.startDockerStats({ hostAlias: host, dockerAppsFilter });
    });
}

function stopStreaming() {
    let sshSettingsJSON = localStorage.getItem('sshConnectionSettings');
    if (!sshSettingsJSON) return;
    let sshSettings;
    try {
        sshSettings = JSON.parse(sshSettingsJSON);
    } catch (err) {
        console.error("Error parsing SSH settings:", err);
        return;
    }
    const enabledConnections = Object.keys(sshSettings).filter(host =>
        sshSettings[host].useConnectionEnabled === "true"
    );

    enabledConnections.forEach(host => {
        window.electronAPI.stopDockerStats({ hostAlias: host });
    });
}

document.getElementById('playButton').addEventListener('click', () => {
    if (!isStreaming) {
        startStreaming();
        isStreaming = true;
        document.getElementById('playButton').textContent = "Pause";
    } else {
        stopStreaming();
        isStreaming = false;
        document.getElementById('playButton').textContent = "Play";
    }
});

function rebuildDockerStatsTables() {
    dockerStatsMap.forEach((value, host) => {
        const hostSection = document.getElementById(`stats-${host}`);
        if (hostSection) {
            const oldTable = hostSection.querySelector('table');
            if (oldTable) {
                hostSection.removeChild(oldTable);
            }
            const newEntry = initializeDockerStatsTable(host);
            dockerStatsMap.set(host, newEntry);
        }
    });
}

function initializeDockerStatsTable(host, fields = ["ID", "Container", "Name", "CPUPerc", "MemUsage", "MemPerc", "NetIO", "BlockIO", "PIDs"], formatHeaders = true) {
    const statsContainer = document.getElementById('statsContainer');
    if (!statsContainer) {
        console.error("Stats container not found in the DOM.");
        return null;
    }

    let hostSection = document.getElementById(`stats-${host}`);
    if (!hostSection) {
        hostSection = document.createElement('div');
        hostSection.id = `stats-${host}`;
        const hostHeader = document.createElement('h3');
        hostHeader.textContent = host;
        hostSection.appendChild(hostHeader);
        statsContainer.appendChild(hostSection);
    } else {
        const existingTable = hostSection.querySelector('table');
        if (existingTable) {
            hostSection.removeChild(existingTable);
        }
    }

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    fields.forEach(field => {
        const th = document.createElement('th');
        let displayField = field;
        if (formatHeaders) {
            switch (field) {
                case "CPUPerc":
                    displayField = "CPU %";
                    break;
                case "MemPerc":
                    displayField = "MEM %";
                    break;
                default:
                    displayField = field;
            }
        }
        th.textContent = displayField;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    hostSection.appendChild(table);

    return { table, tbody };
}

function updateDockerStatsTable(host, newData, defaultFields = ["ID", "Container", "Name", "CPUPerc", "MemUsage", "MemPerc", "NetIO", "BlockIO", "PIDs"]) {
    if (!Array.isArray(newData)) {
        console.warn("newData is not an array. Wrapping it in an array.");
        newData = [newData];
    }

    let fields = defaultFields;  // default fallback.
    const keysString = localStorage.getItem('dockerKeys');
    if (keysString) {
        try {
            const parsedKeys = JSON.parse(keysString);
            if (Array.isArray(parsedKeys) && parsedKeys.length > 0) {
                fields = parsedKeys;
            }
        } catch (err) {
            console.error("Error parsing dockerKeys from localStorage:", err);
        }
    }

    let tableEntry = dockerStatsMap.get(host);
    if (!tableEntry || !tableEntry.table) {
        tableEntry = initializeDockerStatsTable(host, fields);
        dockerStatsMap.set(host, tableEntry);
    }

    let tbody = tableEntry.tbody;
    if (!tbody) {
        if (tableEntry.table) {
            tbody = tableEntry.table.querySelector('tbody');
            if (!tbody) {
                tbody = document.createElement('tbody');
                tableEntry.table.appendChild(tbody);
            }
        } else {
            console.error(`Table element is undefined for host: ${host}`);
            return;
        }
        tableEntry.tbody = tbody;
    }

    tbody.innerHTML = '';

    newData.forEach(dataObj => {
        const row = document.createElement('tr');
        fields.forEach(field => {
            const td = document.createElement('td');
            td.textContent = dataObj[field] !== undefined ? dataObj[field] : '-';
            row.appendChild(td);
        });
        tbody.appendChild(row);
    });

    dockerStatsMap.set(host, { table: tableEntry.table, tbody, currentData: newData });
}

window.electronAPI.receive('docker-stats-update', (update) => {
    const statsContainer = document.getElementById('statsContainer');

    if (!update.host) {
        console.error("Update does not include a host.");
        return;
    }

    if (update.error) {
        let hostSection = document.getElementById(`stats-${update.host}`);
        if (!hostSection) {
            hostSection = document.createElement('div');
            hostSection.id = `stats-${update.host}`;
            const hostHeader = document.createElement('h3');
            hostHeader.textContent = update.host;
            hostSection.appendChild(hostHeader);
            statsContainer.appendChild(hostSection);
        }
        hostSection.querySelectorAll('table').forEach(table => table.remove());
        const errorP = document.createElement('p');
        errorP.className = "error-message";
        errorP.textContent = `Error: ${update.error}`;
        hostSection.appendChild(errorP);
        dockerStatsMap.delete(update.host);
        return;
    }

    if (update.data.length > 0) {
        updateDockerStatsTable(update.host, update.data);
    } else {
        let hostSection = document.getElementById(`stats-${update.host}`);
        if (!hostSection) {
            hostSection = document.createElement('div');
            hostSection.id = `stats-${update.host}`;
            const hostHeader = document.createElement('h3');
            hostHeader.textContent = update.host;
            hostSection.appendChild(hostHeader);
            statsContainer.appendChild(hostSection);
        }
        hostSection.querySelectorAll('table').forEach(table => table.remove());
        const noDataP = document.createElement('p');
        noDataP.textContent = "No matching Docker stats data found.";
        hostSection.appendChild(noDataP);
    }
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

    document.getElementById('appApplyButton').style.display = 'none';
    document.getElementById('sshApplyButton').style.display = 'none';
    document.getElementById('tableApplyButton').style.display = 'none';
    document.getElementById('themeApplyButton').style.display = 'none';

    const headerTitle = document.getElementById('settingsPanelTitle');

    if (tab === 'application') {
        document.getElementById('menuApplication').classList.add('active');
        headerTitle.textContent = 'Application';
        document.getElementById('settingsApplication').style.display = 'block';
        document.getElementById('appApplyButton').style.display = 'block';
        updateApplicationSettingsUI();
    } else if (tab === 'ssh') {
        document.getElementById('menuSSHConnections').classList.add('active');
        headerTitle.textContent = 'Connection Settings';
        document.getElementById('settingsSSHConnections').style.display = 'block';
        document.getElementById('sshApplyButton').style.display = 'block';
        populateSSHDropdown();
    } else if (tab === 'tableFilter') {
        document.getElementById('menuTableFields').classList.add('active');
        headerTitle.textContent = 'Table Field Settings';
        document.getElementById('settingsTableFields').style.display = 'block';
        document.getElementById('tableApplyButton').style.display = 'block';
        updateTableFields();
    } else if (tab === 'appearance') {
        document.getElementById('menuAppearance').classList.add('active');
        headerTitle.textContent = 'Appearance Settings';
        document.getElementById('settingsAppearance').style.display = 'block';
        document.getElementById('themeApplyButton').style.display = 'block';
    }
}

function updateApplicationSettingsUI() {
    const startupCheckbox = document.getElementById('startupCheckbox');
    const storedStartupBehavior = localStorage.getItem('startupBehavior');
    startupCheckbox.checked = storedStartupBehavior === 'true';
}

document.getElementById('appApplyButton').addEventListener('click', (e) => {
    e.preventDefault();
    const startupCheckbox = document.getElementById('startupCheckbox');
    const startupBehavior = startupCheckbox.checked ? "true" : "false";
    localStorage.setItem('startupBehavior', startupBehavior);
});

function populateSSHDropdown() {
    window.electronAPI.getSSHConnections().then(hosts => {
        const dropdown = document.getElementById('sshDropdown');
        if (!dropdown) {
            console.error('SSH dropdown element not found.');
            return;
        }

        dropdown.innerHTML = '';

        if (!hosts || hosts.length === 0) {
            const option = document.createElement('option');
            option.textContent = 'No SSH connections found';
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

        let activeConn = localStorage.getItem('activeConnection');
        if (!activeConn || !hosts.includes(activeConn)) {
            activeConn = hosts[0];
            localStorage.setItem('activeConnection', activeConn);
        }
        dropdown.value = activeConn;

        const currentConnElem = document.getElementById('currentSSHConnection');
        if (currentConnElem) {
            currentConnElem.textContent = activeConn;
            updateConnectionSettings(activeConn);
        } else {
            console.warn('Current SSH connection display element not found.');
        }
    }).catch(err => {
        console.error("Error fetching SSH connections:", err);
    });
}

document.getElementById('sshDropdown').addEventListener('change', () => {
    const dropdown = document.getElementById('sshDropdown');
    if (!dropdown) {
        console.error('SSH dropdown element not found.');
        return;
    }
    const selectedHost = dropdown.value;

    const currentConnElem = document.getElementById('currentSSHConnection');
    if (currentConnElem) {
        currentConnElem.textContent = selectedHost;
    } else {
        console.warn('Current SSH connection display element not found.');
    }

    updateConnectionSettings(selectedHost);
});

function updateConnectionSettings(selectedHost) {
    if (!selectedHost) {
        console.error("No SSH connection selected. Skipping Docker apps update.");
        return;
    }

    let sshSettings = localStorage.getItem('sshConnectionSettings');
    if (sshSettings) {
        try {
            sshSettings = JSON.parse(sshSettings);
        } catch (e) {
            console.error("Error parsing SSH settings:", e);
            sshSettings = {};
        }
    } else {
        sshSettings = {};
    }

    const hostSettings = sshSettings[selectedHost] || {};
    const useConnCheckbox = document.getElementById('useConnectionCheckbox');
    useConnCheckbox.checked = hostSettings.useConnectionEnabled === "true";

    window.electronAPI.getDockerApps(selectedHost).then(result => {
        const dockerAppsGrid = document.getElementById('dockerAppsGrid');
        dockerAppsGrid.innerHTML = '';

        if (result.error) {
            useConnCheckbox.checked = false;
            useConnCheckbox.disabled = true;
            dockerAppsGrid.innerHTML = `<p class="error-message">Unable to fetch Docker apps: ${result.error}</p>`;
        } else if (Array.isArray(result)) {
            useConnCheckbox.disabled = false;
            result.forEach(appName => {
                const appDiv = document.createElement('div');
                appDiv.className = 'docker-app-item';
                appDiv.textContent = appName;
                appDiv.addEventListener('click', () => {
                    appDiv.classList.toggle('selected');
                });
                dockerAppsGrid.appendChild(appDiv);
            });

            if (hostSettings.dockerAppsFilter && Array.isArray(hostSettings.dockerAppsFilter)) {
                Array.from(dockerAppsGrid.children).forEach(appEl => {
                    if (hostSettings.dockerAppsFilter.includes(appEl.textContent)) {
                        appEl.classList.add('selected');
                    }
                });
            }
        }
    }).catch(err => {
        console.error("Error fetching Docker apps:", err);
    });
}

document.getElementById('sshApplyButton').addEventListener('click', () => {
    const dropdown = document.getElementById('sshDropdown');
    const selectedHost = dropdown.value;

    const selectedApps = Array.from(document.querySelectorAll('#dockerAppsGrid .docker-app-item.selected'))
        .map(item => item.textContent);

    const useConnCheckbox = document.getElementById('useConnectionCheckbox');
    const useConnectionEnabled = useConnCheckbox.checked ? "true" : "false";

    let sshSettings = localStorage.getItem('sshConnectionSettings');
    if (sshSettings) {
        try {
            sshSettings = JSON.parse(sshSettings);
        } catch (e) {
            console.error("Error parsing existing SSH settings:", e);
            sshSettings = {};
        }
    } else {
        sshSettings = {};
    }

    sshSettings[selectedHost] = {
        useConnectionEnabled: useConnectionEnabled,
        dockerAppsFilter: selectedApps
    };

    localStorage.setItem('sshConnectionSettings', JSON.stringify(sshSettings));

});

function updateTableFields() {
    const keysString = localStorage.getItem('dockerKeys');
    let savedKeys = [];
    if (keysString) {
        try {
            savedKeys = JSON.parse(keysString);
        } catch (err) {
            console.error("Error parsing saved Docker keys:", err);
        }
    }

    [...document.querySelectorAll('input[name="dockerKey"]')].forEach(checkbox => {
        checkbox.checked = savedKeys.includes(checkbox.value);
    });
}

document.getElementById('tableApplyButton').addEventListener('click', (e) => {
    e.preventDefault();

    const selectedKeys = Array.from(document.querySelectorAll('input[name="dockerKey"]:checked'))
        .map(checkbox => checkbox.value);
    localStorage.setItem('dockerKeys', JSON.stringify(selectedKeys));
    rebuildDockerStatsTables();
});

const themeOptions = document.querySelectorAll('.theme-option');

themeOptions.forEach(option => {
    option.addEventListener('click', () => {
        themeOptions.forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        document.querySelector('#appearanceForm input[name="theme"]').value = option.getAttribute('data-theme');
    });
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

document.getElementById('themeApplyButton').addEventListener('click', () => {
    const hiddenInput = document.querySelector('#appearanceForm input[name="theme"]');
    const selectedTheme = hiddenInput.value;

    if (selectedTheme) {
        if (selectedTheme === "default") {
            localStorage.removeItem('theme');
            window.electronAPI.getShouldUseDarkColors()
                .then(isDark => {
                    const systemTheme = isDark ? 'dark' : 'light';
                    document.documentElement.setAttribute('data-theme', systemTheme);
                    updateAppearanceSelection(systemTheme);
                })
                .catch(err => {
                    console.error("Error getting system theme:", err);
                });
        } else {
            localStorage.setItem('theme', selectedTheme);
            document.documentElement.setAttribute('data-theme', selectedTheme);
            updateAppearanceSelection(selectedTheme);
        }
    }
});
