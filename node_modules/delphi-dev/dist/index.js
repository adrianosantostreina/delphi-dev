#!/usr/bin/env node
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
const commander_1 = require("commander");
const detect_1 = require("./detect");
const plugin_1 = require("./plugin");
const vscode_ext_1 = require("./vscode-ext");
const hooks_1 = require("./hooks");
const rag_1 = require("./rag");
const verify_1 = require("./verify");
const ui_1 = require("./ui");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const RAG_DEST = path.join(os.homedir(), '.claude', 'plugins', 'delphi-dev', 'rag', 'rag.db');
const program = new commander_1.Command();
program.name('delphi-dev').description('delphi-dev Claude Code plugin installer').version('2.0.0');
program
    .command('install', { isDefault: true })
    .description('Install delphi-dev plugin, VS Code extension, and RAG database')
    .action(async () => {
    (0, ui_1.header)('Installing delphi-dev v2.0');
    const sys = (0, detect_1.detectSystem)();
    if (!sys.hasClaudeCLI) {
        (0, ui_1.error)('Claude Code CLI not found. Install from https://claude.ai/code');
        process.exit(1);
    }
    if (!sys.hasGit) {
        (0, ui_1.error)('git not found. Required for plugin installation.');
        process.exit(1);
    }
    (0, ui_1.step)('Installing Claude Code plugin...');
    (0, plugin_1.installPlugin)();
    (0, ui_1.success)('Plugin installed');
    (0, ui_1.step)('Registering hooks in ~/.claude/settings.json...');
    (0, hooks_1.registerHooks)();
    (0, ui_1.success)('Hooks registered');
    const s = (0, ui_1.spinner)('Downloading RAG knowledge base...');
    try {
        const release = await (0, rag_1.fetchLatestRelease)();
        const url = (0, rag_1.getRagDownloadUrl)(release);
        if (url) {
            await (0, rag_1.downloadRagDb)(url, RAG_DEST);
            s.succeed(`RAG database downloaded (${release.tag_name})`);
        }
        else {
            s.warn('RAG database not found in latest release — skipping');
        }
    }
    catch {
        s.warn('Could not download RAG database — run "npx delphi-dev sync-kb" later');
    }
    if ((0, vscode_ext_1.isVSCodeAvailable)()) {
        (0, ui_1.step)('Installing VS Code extension...');
        try {
            (0, vscode_ext_1.installVSCodeExtension)();
            (0, ui_1.success)('VS Code extension installed');
        }
        catch {
            (0, ui_1.warn)('VS Code extension install failed — install manually: adrianosantos.delphi-dev-vscode');
        }
    }
    else {
        (0, ui_1.warn)('VS Code not detected — skipping extension install');
    }
    const result = (0, verify_1.verifyInstallation)();
    (0, ui_1.summary)([
        { label: 'Claude Code CLI', ok: result.claudeOk },
        { label: 'delphi-dev plugin active', ok: result.pluginOk },
        { label: 'RAG database ready', ok: result.ragOk },
        { label: 'VS Code extension', ok: result.vscodeOk, note: !(0, vscode_ext_1.isVSCodeAvailable)() ? 'VS Code not detected' : undefined },
        { label: 'Hooks registered', ok: result.hooksOk },
    ]);
    if (!result.pluginOk) {
        (0, ui_1.error)('Plugin not active. Try: claude plugin list');
        process.exit(1);
    }
});
program
    .command('update')
    .description('Update plugin and RAG database to latest version')
    .action(async () => {
    (0, ui_1.header)('Updating delphi-dev');
    (0, ui_1.step)('Pulling latest plugin...');
    (0, plugin_1.installPlugin)();
    (0, ui_1.success)('Plugin updated');
    const s = (0, ui_1.spinner)('Updating RAG database...');
    try {
        const release = await (0, rag_1.fetchLatestRelease)();
        const url = (0, rag_1.getRagDownloadUrl)(release);
        if (url) {
            await (0, rag_1.downloadRagDb)(url, RAG_DEST);
            s.succeed('RAG updated');
        }
        else
            s.warn('No rag.db in latest release');
    }
    catch {
        s.fail('RAG update failed');
    }
});
program
    .command('sync-kb')
    .description('Download latest RAG knowledge base from GitHub Releases')
    .action(async () => {
    const s = (0, ui_1.spinner)('Downloading RAG knowledge base...');
    const release = await (0, rag_1.fetchLatestRelease)();
    const url = (0, rag_1.getRagDownloadUrl)(release);
    if (!url) {
        s.fail('No rag.db asset in latest release');
        process.exit(1);
    }
    await (0, rag_1.downloadRagDb)(url, RAG_DEST);
    s.succeed(`Downloaded rag.db from ${release.tag_name}`);
});
program
    .command('verify')
    .description('Verify delphi-dev installation status')
    .action(() => {
    const result = (0, verify_1.verifyInstallation)();
    (0, ui_1.summary)([
        { label: 'Claude Code CLI', ok: result.claudeOk },
        { label: 'Plugin active', ok: result.pluginOk },
        { label: 'RAG database', ok: result.ragOk },
        { label: 'VS Code extension', ok: result.vscodeOk },
        { label: 'Hooks registered', ok: result.hooksOk },
    ]);
    const allOk = Object.values(result).every(Boolean);
    process.exit(allOk ? 0 : 1);
});
program
    .command('uninstall')
    .description('Remove delphi-dev plugin and clean up hooks')
    .action(() => {
    (0, ui_1.header)('Uninstalling delphi-dev');
    (0, ui_1.step)('Removing hooks...');
    (0, hooks_1.removeHooks)();
    (0, ui_1.success)('Hooks removed');
    (0, ui_1.warn)('Plugin files remain in ~/.claude/plugins/delphi-dev — remove manually if desired');
});
program.parse();
//# sourceMappingURL=index.js.map