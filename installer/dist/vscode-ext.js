"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installVSCodeExtension = installVSCodeExtension;
exports.isVSCodeExtensionInstalled = isVSCodeExtensionInstalled;
exports.isVSCodeAvailable = isVSCodeAvailable;
const child_process_1 = require("child_process");
const EXTENSION_ID = 'adrianosantos.delphi-dev-vscode';
function spawn(cmd, args) {
    const result = (0, child_process_1.spawnSync)(cmd, args, { stdio: 'inherit', shell: false });
    if (result.status !== 0) {
        throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
    }
}
function installVSCodeExtension() {
    spawn('code', ['--install-extension', EXTENSION_ID]);
}
function isVSCodeExtensionInstalled() {
    try {
        const result = (0, child_process_1.spawnSync)('code', ['--list-extensions'], { encoding: 'utf-8', shell: false });
        if (result.status !== 0)
            return false;
        return (result.stdout ?? '').toLowerCase().includes('adrianosantos.delphi-dev-vscode');
    }
    catch {
        return false;
    }
}
function isVSCodeAvailable() {
    try {
        const result = (0, child_process_1.spawnSync)('code', ['--version'], { stdio: 'ignore', shell: false });
        return result.status === 0;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=vscode-ext.js.map