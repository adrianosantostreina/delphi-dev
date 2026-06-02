#!/usr/bin/env node
import { Command } from 'commander';
import { detectSystem } from './detect';
import { installPlugin, isPluginInstalled } from './plugin';
import { installVSCodeExtension, isVSCodeAvailable } from './vscode-ext';
import { registerHooks, removeHooks } from './hooks';
import { fetchLatestRelease, getRagDownloadUrl, downloadRagDb } from './rag';
import { verifyInstallation } from './verify';
import { header, step, success, warn, error, spinner, summary } from './ui';
import * as os from 'os';
import * as path from 'path';

const RAG_DEST = path.join(os.homedir(), '.claude', 'plugins', 'delphi-dev', 'rag', 'rag.db');

const program = new Command();
program.name('delphi-dev').description('delphi-dev Claude Code plugin installer').version('2.0.0');

program
  .command('install', { isDefault: true })
  .description('Install delphi-dev plugin, VS Code extension, and RAG database')
  .action(async () => {
    header('Installing delphi-dev v2.0');

    const sys = detectSystem();
    if (!sys.hasClaudeCLI) {
      error('Claude Code CLI not found. Install from https://claude.ai/code');
      process.exit(1);
    }
    if (!sys.hasGit) {
      error('git not found. Required for plugin installation.');
      process.exit(1);
    }

    step('Installing Claude Code plugin...');
    installPlugin();
    success('Plugin installed');

    step('Registering hooks in ~/.claude/settings.json...');
    registerHooks();
    success('Hooks registered');

    const s = spinner('Downloading RAG knowledge base...');
    try {
      const release = await fetchLatestRelease();
      const url = getRagDownloadUrl(release);
      if (url) {
        await downloadRagDb(url, RAG_DEST);
        s.succeed(`RAG database downloaded (${release.tag_name})`);
      } else {
        s.warn('RAG database not found in latest release — skipping');
      }
    } catch {
      s.warn('Could not download RAG database — run "npx delphi-dev sync-kb" later');
    }

    if (isVSCodeAvailable()) {
      step('Installing VS Code extension...');
      try {
        installVSCodeExtension();
        success('VS Code extension installed');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('not yet on the Marketplace')) {
          warn('VS Code extension not yet on the Marketplace — search "Delphi Dev" in VS Code Extensions when available');
        } else {
          warn('VS Code extension install failed — install manually: adrianosantos.delphi-dev-vscode');
        }
      }
    } else {
      warn('VS Code not detected — skipping extension install');
    }

    const result = verifyInstallation();
    summary([
      { label: 'Claude Code CLI', ok: result.claudeOk },
      { label: 'delphi-dev plugin active', ok: result.pluginOk },
      { label: 'RAG database ready', ok: result.ragOk },
      { label: 'VS Code extension', ok: result.vscodeOk, note: !isVSCodeAvailable() ? 'VS Code not detected' : undefined },
      { label: 'Hooks registered', ok: result.hooksOk },
    ]);

    if (!result.pluginOk) {
      error('Plugin not active. Try: claude plugin list');
      process.exit(1);
    }
  });

program
  .command('update')
  .description('Update plugin and RAG database to latest version')
  .action(async () => {
    header('Updating delphi-dev');
    step('Pulling latest plugin...');
    installPlugin();
    success('Plugin updated');
    const s = spinner('Updating RAG database...');
    try {
      const release = await fetchLatestRelease();
      const url = getRagDownloadUrl(release);
      if (url) { await downloadRagDb(url, RAG_DEST); s.succeed('RAG updated'); }
      else s.warn('No rag.db in latest release');
    } catch { s.fail('RAG update failed'); }
  });

program
  .command('sync-kb')
  .description('Download latest RAG knowledge base from GitHub Releases')
  .action(async () => {
    const s = spinner('Downloading RAG knowledge base...');
    const release = await fetchLatestRelease();
    const url = getRagDownloadUrl(release);
    if (!url) { s.fail('No rag.db asset in latest release'); process.exit(1); }
    await downloadRagDb(url, RAG_DEST);
    s.succeed(`Downloaded rag.db from ${release.tag_name}`);
  });

program
  .command('verify')
  .description('Verify delphi-dev installation status')
  .action(() => {
    const result = verifyInstallation();
    summary([
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
    header('Uninstalling delphi-dev');
    step('Removing hooks...');
    removeHooks();
    success('Hooks removed');
    warn('Plugin files remain in ~/.claude/plugins/delphi-dev — remove manually if desired');
  });

program.parse();
