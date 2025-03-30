// sshConfigHelper.js
import fs from 'fs';
import path from 'path';
import SSHConfig from 'ssh-config';


export function getSSHConfigForAlias(hostAlias) {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const configPath = path.join(homeDir, '.ssh', 'config');

    if (!fs.existsSync(configPath)) {
        throw new Error('No SSH config file found.');
    }

    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = SSHConfig.parse(configContent);
    const opts = config.compute(hostAlias);

    if (!opts || Object.keys(opts).length === 0) {
        throw new Error(`No SSH configuration found for host alias: ${hostAlias}`);
    }

    let identityFile;
    if (opts.identityfile) {
        const keyPath = Array.isArray(opts.identityfile)
            ? opts.identityfile[0]
            : opts.identityfile;
        identityFile = path.resolve(
            keyPath.startsWith('~') ? keyPath.replace(/^~(?=$|[\/\\])/, homeDir) : keyPath
        );
    } else {
        identityFile = path.join(homeDir, '.ssh', 'id_rsa');
    }

    if (!fs.existsSync(identityFile)) {
        throw new Error(`Identity file not found at: ${identityFile}`);
    }

    return {
        host: opts.HostName || hostAlias,
        port: opts.Port ? parseInt(opts.Port, 10) : 22,
        username: opts.User,
        privateKey: fs.readFileSync(identityFile),
    };
}

export function getAllSSHConnections() {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const configPath = path.join(homeDir, '.ssh', 'config');

    if (!fs.existsSync(configPath)) {
        throw new Error('No SSH config file found.');
    }

    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = SSHConfig.parse(configContent);
    const hosts = [];

    config.forEach(entry => {
        if (entry.param && entry.param.trim().toLowerCase() === 'host') {
            let ignoreEntry = false;
            if (entry.config && Array.isArray(entry.config)) {
                entry.config.forEach(sub => {
                    if (
                        sub.param &&
                        sub.param.trim().toLowerCase() === 'user' &&
                        sub.value &&
                        sub.value.trim().toLowerCase() === 'git'
                    ) {
                        ignoreEntry = true;
                    }
                });
            }

            if (ignoreEntry) {
                return;
            }

            if (Array.isArray(entry.value)) {
                entry.value.forEach(alias => {
                    alias = alias.trim();
                    if (alias !== '*' && !hosts.includes(alias)) {
                        hosts.push(alias);
                    }
                });
            } else {
                const alias = entry.value.trim();
                if (alias !== '*' && !hosts.includes(alias)) {
                    hosts.push(alias);
                }
            }
        }
    });

    return hosts;
}
