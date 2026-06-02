"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.installPlugin = installPlugin;
exports.isPluginInstalled = isPluginInstalled;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const PLUGIN_DEST = path.join(os.homedir(), '.claude', 'plugins', 'delphi-dev');
const REPO_URL = 'https://github.com/adrianosantostreina/delphi-dev.git';
function spawn(cmd, args) {
    const result = (0, child_process_1.spawnSync)(cmd, args, { stdio: 'inherit', shell: false });
    if (result.status !== 0) {
        throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
    }
}
function installPlugin() {
    if (fs.existsSync(PLUGIN_DEST)) {
        spawn('git', ['-C', PLUGIN_DEST, 'pull', '--ff-only']);
    }
    else {
        spawn('git', ['clone', '--depth=1', REPO_URL, PLUGIN_DEST]);
    }
    spawn('claude', ['plugin', 'install', PLUGIN_DEST]);
}
function isPluginInstalled() {
    try {
        const output = (0, child_process_1.execSync)('claude plugin list', { encoding: 'utf-8' });
        return output.includes('delphi-dev');
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=plugin.js.map