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
exports.registerHooks = registerHooks;
exports.removeHooks = removeHooks;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const PLUGIN_BASE = path.join(os.homedir(), '.claude', 'plugins', 'delphi-dev');
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const DELPHI_HOOK_KEYS = ['SubagentStop', 'Stop', 'UserPromptSubmit', 'PostToolUse'];
function buildHooks() {
    return {
        SubagentStop: [{
                matcher: '*',
                hooks: [{ type: 'command', command: `node "${PLUGIN_BASE}/scripts/capture.js" --mode=agent` }],
            }],
        Stop: [{
                matcher: '*',
                hooks: [{ type: 'command', command: `node "${PLUGIN_BASE}/scripts/capture.js" --mode=session` }],
            }],
        UserPromptSubmit: [{
                matcher: '*',
                hooks: [{ type: 'command', command: `node "${PLUGIN_BASE}/scripts/search.js"` }],
            }],
        PostToolUse: [{
                matcher: 'Write|Edit',
                hooks: [{ type: 'command', command: `node "${PLUGIN_BASE}/hooks/fix-encoding.js"` }],
            }],
    };
}
function readSettings() {
    if (!fs.existsSync(SETTINGS_PATH))
        return {};
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
}
function writeSettings(settings) {
    const dir = path.dirname(SETTINGS_PATH);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}
function registerHooks() {
    const settings = readSettings();
    const existing = settings.hooks ?? {};
    const newHooks = buildHooks();
    const merged = { ...existing };
    for (const [event, handlers] of Object.entries(newHooks)) {
        if (!merged[event])
            merged[event] = handlers;
    }
    writeSettings({ ...settings, hooks: merged });
}
function removeHooks() {
    const settings = readSettings();
    const hooks = settings.hooks ?? {};
    for (const key of DELPHI_HOOK_KEYS) {
        delete hooks[key];
    }
    writeSettings({ ...settings, hooks });
}
//# sourceMappingURL=hooks.js.map