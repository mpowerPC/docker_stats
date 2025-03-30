// renderer.js
let isStreaming = false;
let savedFields = [];

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

async function startStreaming() {
    let sshSettings = {};
    window.myStore.get('sshConnectionSettings', '{}').then(storedStartupBehavior => {
        if (storedStartupBehavior !== '{}') {
            try {
                sshSettings = JSON.parse(storedStartupBehavior);
            } catch (e) {
                console.error("Error parsing SSH settings:", e);
            }
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
            window.electronAPI.startDockerStats({hostAlias: host, dockerAppsFilter: dockerAppsFilter, tableFields: savedFields});
        });
    });
}

function stopStreaming() {
    let sshSettings = {};
    window.myStore.get('sshConnectionSettings', '{}').then(storedStartupBehavior => {
        if (storedStartupBehavior !== '{}') {
            try {
                sshSettings = JSON.parse(storedStartupBehavior);
            } catch (e) {
                console.error("Error parsing SSH settings:", e);
            }
        }
        const enabledConnections = Object.keys(sshSettings).filter(host =>
            sshSettings[host].useConnectionEnabled === "true"
        );

        enabledConnections.forEach(host => {
            window.electronAPI.stopDockerStats({ hostAlias: host });
        });
    });
}

document.getElementById('playButton').addEventListener('click', () => {
    if (!isStreaming) {
        startStreaming().then(() => {
            isStreaming = true;
            document.getElementById('playButton').innerHTML = '||';
        });
    } else {
        stopStreaming();
        isStreaming = false;
        document.getElementById('playButton').innerHTML = '▶';
    }
});

window.electronAPI.receive('docker-stats-update', (update) => {
    if (update.error || update.data.length === 0) {
        return;
    }
    updateDockerStatsTable(update.host, update.data);
});

function updateDockerStatsTable(host, newData) {
    const statsContainer = document.getElementById('statsContainer');
    let table = statsContainer.getElementsByTagName("table")
    if (!table[0]) {
        initializeDockerStatsTable();
        table = statsContainer.getElementsByTagName("table")
    }

    let tbody = table[0].getElementsByTagName("tbody");
    tbody = tbody[0];
    if (tbody.rows.length === 0) {
        createHostRows(host, newData, tbody);
    } else {
        let exists = false
        for (const row of tbody.rows) {
            if (row.dataset.host === host) {
                exists = true;
                break;
            }
        }

        if (!exists) {
            createHostRows(host, newData, tbody);
        } else {
            let i = 0;
            for (const row of tbody.rows) {
                if (row.dataset.host === host) {
                    if (i !== 0) {
                        let j = 0;
                        const cells = row.cells;
                        savedFields.forEach(field => {
                            cells[j].textContent = newData[i - 1][field] !== undefined ? newData[i - 1][field] : '-';
                            j++;
                        });
                    }
                    i++;
                }
            }
        }
    }
}

function initializeDockerStatsTable() {
    const statsContainer = document.getElementById('statsContainer');

    statsContainer.innerHTML = '';

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    savedFields.forEach(field => {
        const th = document.createElement('th');
        th.textContent = field;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    statsContainer.appendChild(table);
}

function createHostRows(host, newData, tbody) {
    let row = document.createElement('tr');
    let td = document.createElement('td');

    td.colSpan = savedFields.length;
    td.style.textAlign = 'center';
    td.style.fontWeight = 'bold';
    td.textContent = host;
    row.appendChild(td);
    row.dataset.host = host;
    tbody.appendChild(row);

    newData.forEach(dataObj => {
        row = document.createElement('tr');
        row.dataset.host = host;
        savedFields.forEach(field => {
            td = document.createElement('td');
            td.textContent = dataObj[field] !== undefined ? dataObj[field] : '-';
            row.appendChild(td);
        });
        tbody.appendChild(row);
    });
}

function rebuildDockerStatsTables() {
    const lastStreamingSetting = isStreaming;

    if (isStreaming) {
        stopStreaming();
        isStreaming = false;
        document.getElementById('playButton').innerHTML = '▶';
    }

    initializeDockerStatsTable();

    if (lastStreamingSetting) {
        startStreaming().then(() => {
            isStreaming = true;
            document.getElementById('playButton').innerHTML = '||';
        });
    }
}

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
    window.myStore.get('startupBehavior', 'false').then(storedStartupBehavior => {
        startupCheckbox.checked = storedStartupBehavior === 'true';
    });
}

document.getElementById('appApplyButton').addEventListener('click', (e) => {
    e.preventDefault();
    const startupCheckbox = document.getElementById('startupCheckbox');
    const startupBehavior = startupCheckbox.checked ? "true" : "false";
    window.myStore.set('startupBehavior', startupBehavior).then();
});

function populateSSHDropdown() {
    window.electronAPI.getSSHConnections().then(hosts => {
        const dropdown = document.getElementById('sshDropdown');
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

        const selectedHost = hosts[0];
        dropdown.value = selectedHost;

        const currentConnElem = document.getElementById('currentSSHConnection');
        if (currentConnElem) {
            currentConnElem.textContent = selectedHost;
        }
        updateConnectionSettings(selectedHost);
    }).catch(err => {
        console.error("Error fetching SSH connections:", err);
    });
}

document.getElementById('sshDropdown').addEventListener('change', () => {
    const dropdown = document.getElementById('sshDropdown');
    const selectedHost = dropdown.value;
    const currentConnElem = document.getElementById('currentSSHConnection');
    if (currentConnElem) {
        currentConnElem.textContent = selectedHost;
    }
    updateConnectionSettings(selectedHost);
});

function updateConnectionSettings(selectedHost) {
    if (!selectedHost) {
        console.error("No SSH connection selected. Skipping Docker apps update.");
        return;
    }

    let sshSettings = {};
    window.myStore.get('sshConnectionSettings', '{}').then(storedStartupBehavior => {
        if (storedStartupBehavior !== '{}') {
            try {
                sshSettings = JSON.parse(storedStartupBehavior);
            } catch (e) {
                console.error("Error parsing SSH settings:", e);
                sshSettings = {};
            }
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
    });
}

document.getElementById('sshApplyButton').addEventListener('click', () => {
    const dropdown = document.getElementById('sshDropdown');
    const selectedHost = dropdown.value;

    const selectedApps = Array.from(document.querySelectorAll('#dockerAppsGrid .docker-app-item.selected'))
        .map(item => item.textContent);

    const useConnCheckbox = document.getElementById('useConnectionCheckbox');
    const useConnectionEnabled = useConnCheckbox.checked ? "true" : "false";

    let sshSettings = {};
    window.myStore.get('sshConnectionSettings', '{}').then(storedStartupBehavior => {
        if (storedStartupBehavior !== '{}') {
            try {
                sshSettings = JSON.parse(storedStartupBehavior);
            } catch (e) {
                console.error("Error parsing SSH settings:", e);
                sshSettings = {};
            }
        }

        sshSettings[selectedHost] = {
            useConnectionEnabled: useConnectionEnabled,
            dockerAppsFilter: selectedApps
        };

        window.myStore.set('sshConnectionSettings', JSON.stringify(sshSettings)).then(() => {
            rebuildDockerStatsTables();
        });
    });
});

function updateTableFields(onLoad = false) {
    window.myStore.get('tableFields', '[]').then(tableFields => {
        if (tableFields !== '[]') {
            try {
                savedFields = JSON.parse(tableFields);
            } catch (e) {
                console.error("Error parsing tableFields:", e);
                savedFields = [];
            }
        } else {
            savedFields = [];
        }

        [...document.querySelectorAll('input[name="tableField"]')].forEach(checkbox => {
            checkbox.checked = savedFields.includes(checkbox.value);
        });

        if (onLoad) {
            rebuildDockerStatsTables();
        }
    });
}

document.getElementById('tableApplyButton').addEventListener('click', (e) => {
    e.preventDefault();

    const tableFields = Array.from(document.querySelectorAll('input[name="tableField"]:checked'))
        .map(checkbox => checkbox.value);

    window.myStore.set('tableFields', JSON.stringify(tableFields)).then(() => {
        savedFields = tableFields;
        rebuildDockerStatsTables();
    });
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
    window.myStore.get('theme', '').then(storedTheme => {
        window.electronAPI.getShouldUseDarkColors().then(isDark => {
            if (!storedTheme) {
                storedTheme = isDark ? 'dark' : 'light';
            }
            document.documentElement.setAttribute('data-theme', storedTheme);
            updateAppearanceSelection(storedTheme);
        });
    });
}

document.getElementById('themeApplyButton').addEventListener('click', () => {
    const hiddenInput = document.querySelector('#appearanceForm input[name="theme"]');
    const selectedTheme = hiddenInput.value;

    if (selectedTheme) {
        if (selectedTheme === "default") {
            window.myStore.set('theme', "").then(() => {
                window.electronAPI.getShouldUseDarkColors().then(isDark => {
                    const systemTheme = isDark ? 'dark' : 'light';
                    document.documentElement.setAttribute('data-theme', systemTheme);
                    updateAppearanceSelection(systemTheme);
                });
            });

        } else {
            window.myStore.set('theme', selectedTheme).then(() => {
                document.documentElement.setAttribute('data-theme', selectedTheme);
                updateAppearanceSelection(selectedTheme);
            });
        }
    }
});

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    updateTableFields(true);
});

document.getElementById('statsContainer').addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
        const currentFontSize = parseFloat(window.getComputedStyle(document.getElementById('statsContainer')).fontSize);
        const step = 1;
        let newFontSize;
        if (e.deltaY < 0) {
            newFontSize = currentFontSize + step;
        } else {
            newFontSize = currentFontSize - step;
        }
        newFontSize = Math.max(10, Math.min(newFontSize, 30));
        statsContainer.style.fontSize = newFontSize + 'px';
    }
});
