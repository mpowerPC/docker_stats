// sshConfigHelper.js
const fs = require('fs');
const path = require('path');
const SSHConfig = require('ssh-config');

function getSSHConfigForAlias(hostAlias) {
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
    let identityKey = opts.IdentityFile || opts.identityfile;
    if (identityKey) {
        const keyPath = Array.isArray(identityKey) ? identityKey[0] : identityKey;
        identityFile = keyPath.replace(/^~(?=$|\/)/, homeDir);
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
        privateKey: identityFile ? fs.readFileSync(identityFile) : undefined,
    };
}

module.exports = getSSHConfigForAlias;