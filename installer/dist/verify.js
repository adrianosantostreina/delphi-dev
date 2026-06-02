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
exports.verifyInstallation = verifyInstallation;
const detect_1 = require("./detect");
const plugin_1 = require("./plugin");
const vscode_ext_1 = require("./vscode-ext");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const RAG_PATH = path.join(os.homedir(), '.claude', 'plugins', 'delphi-dev', 'rag', 'rag.db');
function verifyInstallation() {
    const system = (0, detect_1.detectSystem)();
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    let hooksOk = false;
    if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        hooksOk = !!(settings.hooks?.SubagentStop && settings.hooks?.UserPromptSubmit);
    }
    return {
        claudeOk: system.hasClaudeCLI,
        pluginOk: (0, plugin_1.isPluginInstalled)(),
        ragOk: fs.existsSync(RAG_PATH),
        vscodeOk: !(0, vscode_ext_1.isVSCodeAvailable)() || (0, vscode_ext_1.isVSCodeExtensionInstalled)(),
        hooksOk,
    };
}
//# sourceMappingURL=verify.js.map