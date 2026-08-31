#!/usr/bin/env node
import { Command } from 'commander';
import { detectSystem } from './detect';
import { installPlugin, isPluginInstalled } from './plugin';
import { installVSCodeExtension, isVSCodeAvailable, isVSCodeExtensionInstalled } from './vscode-ext';
import { removeHooks } from './hooks';
import { fetchLatestRelease, getRagDownloadUrl, downloadRagDb } from './rag';
import { verifyInstallation } from './verify';
import { header, step, success, warn, error, spinner, summary } from './ui';
import chalk from 'chalk';
import * as os from 'os';
import * as path from 'path';

const RAG_DEST = path.join(os.homedir(), '.claude', 'plugins', 'delphi-dev', 'rag', 'rag.db');

const program = new Command();
program.name('delphi-dev').description('delphi-dev Claude Code plugin installer').version('2.2.2');

program
  .command('install', { isDefault: true })
  .description('Install delphi-dev plugin, VS Code extension, and RAG database')
  .action(async () => {
    header('Installing delphi-dev v2.2');

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

    // v2.2.2: hooks (RAG-search/capture/auto-BOM) are disabled. They depend on
    // built JS + native deps that aren't shipped/built in the user environment,
    // which broke clean installs on Windows. Proactively strip any stale hooks a
    // previous broken v2.x install left in settings.json so prompts stop erroring.
    step('Cleaning up legacy hooks in ~/.claude/settings.json...');
    removeHooks();
    success('Legacy hooks cleaned (hooks return in v3.0)');

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
      { label: 'RAG knowledge base', ok: result.ragOk, note: !result.ragOk ? 'missing — run "npx delphi-dev sync-kb"' : undefined },
      { label: 'VS Code extension', ok: result.vscodeOk, note: !isVSCodeAvailable() ? 'not detected' : undefined },
    ]);

    if (!isVSCodeAvailable() || !isVSCodeExtensionInstalled()) {
      console.log(chalk.dim('💡 Tip: Install the Delphi Dev extension for VS Code — search "Delphi Dev" in the Extensions panel or run:'));
      console.log(chalk.dim('   code --install-extension adrianosantos.delphi-dev-vscode'));
      console.log('');
    }

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
      { label: 'RAG knowledge base', ok: result.ragOk, note: !result.ragOk ? 'run "npx delphi-dev sync-kb" to download' : undefined },
      { label: 'VS Code extension', ok: result.vscodeOk },
    ]);
    const allOk = result.claudeOk && result.pluginOk && result.vscodeOk;
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
