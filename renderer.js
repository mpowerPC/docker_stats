// renderer.js
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

document.getElementById('fetchButton').addEventListener('click', async () => {
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

    const enabledConnections = Object.keys(sshSettings).filter(host => {
        return sshSettings[host].useConnectionEnabled === "true";
    });

    if (enabledConnections.length === 0) {
        return alert("No enabled SSH connections found. Please enable one in Settings.");
    }

    const statsContainer = document.getElementById('statsContainer');
    statsContainer.innerHTML = '';

    try {
        let keysString = localStorage.getItem('dockerKeys');
        let dockerKeys = [];
        if (keysString) {
            try {
                dockerKeys = JSON.parse(keysString);
            } catch (parseErr) {
                console.error("Error parsing docker keys:", parseErr);
            }
        }

        const results = await Promise.all(enabledConnections.map(async (host) => {
            try {
                const hostSettings = sshSettings[host] || {};
                const dockerAppsFilter = hostSettings.dockerAppsFilter || [];

                const statsData = await window.electronAPI.fetchDockerStats({
                    hostAlias: host,
                    dockerAppsFilter: dockerAppsFilter,
                });

                const dataObjects = statsData
                    .split('\n')
                    .filter(line => line.trim().length)
                    .map(line => {
                        try {
                            return JSON.parse(line);
                        } catch (parseErr) {
                            console.error(`Error parsing docker stats JSON for ${host}:`, parseErr);
                            return null;
                        }
                    })
                    .filter(obj => obj !== null);

                let filteredData = dataObjects;
                if (dockerKeys.length > 0) {
                    filteredData = dataObjects.map(obj => {
                        let filteredObj = {};
                        dockerKeys.forEach(key => {
                            if (obj.hasOwnProperty(key)) {
                                filteredObj[key] = obj[key];
                            }
                        });
                        return filteredObj;
                    });
                }

                return { host, data: filteredData };
            } catch (err) {
                console.error(`Error fetching stats for ${host}:`, err);
                return { host, error: err.message };
            }
        }));

        results.forEach(result => {
            const hostHeader = document.createElement('h3');
            hostHeader.textContent = result.host;
            statsContainer.appendChild(hostHeader);

            if (result.error) {
                const errorP = document.createElement('p');
                errorP.className = "error-message";
                errorP.textContent = `Error: ${result.error}`;
                statsContainer.appendChild(errorP);
            } else if (Array.isArray(result.data) && result.data.length > 0) {
                const table = document.createElement('table');
                const keys = Object.keys(result.data[0]);
                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                keys.forEach(key => {
                    const th = document.createElement('th');
                    th.textContent = key;
                    headerRow.appendChild(th);
                });
                thead.appendChild(headerRow);
                table.appendChild(thead);

                const tbody = document.createElement('tbody');
                result.data.forEach(rowData => {
                    const row = document.createElement('tr');
                    keys.forEach(key => {
                        const td = document.createElement('td');
                        td.textContent = rowData[key] !== undefined ? rowData[key] : '-';
                        row.appendChild(td);
                    });
                    tbody.appendChild(row);
                });
                table.appendChild(tbody);
                statsContainer.appendChild(table);
            } else {
                const noDataP = document.createElement('p');
                noDataP.textContent = "No matching Docker stats data found.";
                statsContainer.appendChild(noDataP);
            }
        });
    } catch (err) {
        console.error("Error fetching stats from enabled connections:", err);
        alert("An error occurred while fetching docker stats. Please check the console for details.");
    }
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
