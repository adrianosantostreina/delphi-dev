#!/usr/bin/env node
import { Command } from 'commander';
import { detectSystem } from './detect';
import { installPlugin, isPluginInstalled } from './plugin';
import { installVSCodeExtension, isVSCodeAvailable, isVSCodeExtensionInstalled } from './vscode-ext';
import { removeHooks } from './hooks';
import { verifyInstallation } from './verify';
import { header, step, success, warn, error, summary } from './ui';
import chalk from 'chalk';

const program = new Command();
program.name('delphi-dev').description('delphi-dev Claude Code plugin installer').version('2.2.2');

program
  .command('install', { isDefault: true })
  .description('Install delphi-dev plugin and VS Code extension')
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

    // v4: hooks are declared by the plugin itself (hooks/hooks.json). The installer only
    // strips entries that v2.0–v2.2.1 wrote into settings.json, keeping everyone else's.
    step('Cleaning up legacy delphi-dev hooks in ~/.claude/settings.json...');
    removeHooks();
    success('Legacy hooks cleaned');

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
  .description('Update the delphi-dev plugin (the knowledge base updates itself; use /update in a session)')
  .action(() => {
    header('Updating delphi-dev');
    step('Pulling latest plugin...');
    installPlugin();
    success('Plugin updated — restart your Claude Code session');
  });

program
  .command('sync-kb')
  .description('Deprecated: the knowledge base now updates itself')
  .action(() => {
    warn('The knowledge base now updates itself. Inside a session, run /update to refresh it now.');
  });

program
  .command('verify')
  .description('Verify delphi-dev installation status')
  .action(() => {
    const result = verifyInstallation();
    summary([
      { label: 'Claude Code CLI', ok: result.claudeOk },
      { label: 'Plugin active', ok: result.pluginOk },
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
