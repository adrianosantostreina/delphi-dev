"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectSystem = detectSystem;
const child_process_1 = require("child_process");
function detectSystem() {
    return {
        nodeVersion: process.version,
        hasClaudeCLI: commandExists('claude --version'),
        hasVSCode: commandExists('code --version'),
        hasGit: commandExists('git --version'),
    };
}
function commandExists(cmd) {
    try {
        (0, child_process_1.execSync)(cmd, { stdio: 'ignore' });
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=detect.js.map