#!/usr/bin/env node
import { Command } from 'commander';
import { detectSystem } from './detect';
import { installPlugin, isPluginInstalled } from './plugin';
import { installVSCodeExtension, isVSCodeAvailable, isVSCodeExtensionInstalled } from './vscode-ext';
import { removeHooks } from './hooks';
import { verifyInstallation } from './verify';
import { header, step, success, warn, error, summary } from './ui';
import chalk from 'chalk';
import { packageVersion } from './version';
import { DEFAULT_BRANCH, clearRefState, isPrerelease, planInstallRef, planUpdateRef, readRefState, writeRefState, type RefPlan } from './ref';
import { detectTargets, installedPortableTargets, portableHints, readInstallManifest, realProbe, resolveTargets, runPortable, type Target } from './targets';

const program = new Command();
program.name('delphi-dev').description('delphi-dev Claude Code plugin installer').version(packageVersion());

/** Prints which ref is being installed (nothing for a stable install, whose behaviour is unchanged). */
function describeRef(plan: RefPlan): string | null {
  if (plan.ref) return `Ref: ${plan.ref} (${plan.explicit ? 'chosen with --ref' : 'pre-release version of this package'})`;
  if (plan.unpin) return `Returning to the stable line (${DEFAULT_BRANCH}): leaving the ref installed earlier`;
  return null;
}

/** Remembers the ref in use so that "update" keeps it. Never fails the install. */
function recordRef(plan: RefPlan): void {
  try {
    if (plan.ref) writeRefState({ ref: plan.ref, explicit: plan.explicit, version: packageVersion() });
    else if (plan.unpin) clearRefState();
  } catch (err) {
    warn(`Could not record the installed ref: ${err instanceof Error ? err.message : String(err)}`);
  }
}

program
  .command('install', { isDefault: true })
  .description('Install delphi-dev for Claude Code (and the VS Code extension); Codex/OpenCode only with --target')
  .option('--target <list>', 'claude, codex, opencode, a comma list, or all (default: claude only)')
  .option('--from <path>', 'use an existing checkout instead of ~/.delphi-dev/plugin (development)')
  .option('--scope <scope>', 'user (default) or project (Codex/OpenCode only)')
  .option('--project <dir>', 'project folder for --scope project')
  .option('--dry-run', 'show what would change; executes and writes nothing')
  .option('--force', 'overwrite files that are not ours (a backup is made)')
  .option('--ref <ref>', 'tag, branch or sha of the repository to install (default: the latest stable; a pre-release package installs its own tag)')
  .action(async (opts: { target?: string; from?: string; scope?: string; project?: string; dryRun?: boolean; force?: boolean; ref?: string }) => {
    let targets: Target[];
    let plan: RefPlan;
    try {
      targets = resolveTargets(opts.target);
      plan = planInstallRef({ flag: opts.ref, version: packageVersion(), state: readRefState() });
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    const portable = targets.filter((t) => t !== 'claude');
    // --from uses a checkout the user already has: the ref does not apply to the portable part then.
    const refUsed = targets.includes('claude') || !opts.from;
    let refAnnounced = false;
    const announceRef = (): void => {
      const text = describeRef(plan);
      if (text && refUsed && !refAnnounced) {
        refAnnounced = true;
        step(text);
      }
    };
    const portableOpts = { ...opts, ref: plan.ref, ...(plan.unpin ? { unpin: true } : {}) };
    let portableFailed = false;
    let portablePartial = false;
    if (portable.length) {
      header(`Installing delphi-dev for ${portable.join(' + ')}`);
      announceRef();
      try {
        const outcome = runPortable('install', portable, portableOpts);
        if (refUsed && !opts.dryRun) recordRef(plan);
        if (outcome === 'partial') {
          // kb-cli exit 2: it ran, but protected some of the user's files. Not a success, not a crash.
          portablePartial = true;
          warn(`delphi-dev PARTIALLY installed for ${portable.join(' + ')}: some items were not applied (see the ! and ? lines above). Restart the agent session; re-run after fixing them, or see the README.`);
        } else if (opts.dryRun) success(`Dry run for ${portable.join(' + ')} — nothing was written`);
        else success(`delphi-dev installed for ${portable.join(' + ')} — restart the agent session`);
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        // A Codex/OpenCode problem must never stop the Claude Code install that was also requested.
        if (!targets.includes('claude')) process.exit(1);
        portableFailed = true;
      }
      if (!targets.includes('claude')) {
        if (portablePartial) process.exit(2);
        return;
      }
    }

    header('Installing delphi-dev v2.2');
    announceRef();

    // Codex/OpenCode are never touched without --target: if they are around, only say how to opt in.
    if (!opts.target) {
      for (const cmd of portableHints(detectTargets(realProbe()))) {
        console.log(chalk.dim(`Tip: Codex/OpenCode detected - to install delphi-dev there too, run: ${cmd}`));
      }
    }

    if (opts.dryRun) {
      // Dry run executes nothing at all: not even the Claude Code part (plugin, settings.json, VS Code).
      step('[dry-run] would install the Claude Code plugin (git clone/pull + claude plugin marketplace add/install)');
      if (plan.ref) step(`[dry-run] would leave the plugin checkout on ${plan.ref}`);
      step('[dry-run] would remove legacy delphi-dev hooks from ~/.claude/settings.json');
      if (isVSCodeAvailable()) {
        step(isPrerelease(packageVersion())
          ? '[dry-run] would skip the Marketplace extension (the beta is a .vsix on the GitHub Release)'
          : '[dry-run] would install the VS Code extension');
      }
      success('Dry run - nothing was changed');
      return;
    }

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
    installPlugin({ ref: plan.ref, unpin: plan.unpin });
    recordRef(plan);
    success('Plugin installed');

    // v4: hooks are declared by the plugin itself (hooks/hooks.json). The installer only
    // strips entries that v2.0–v2.2.1 wrote into settings.json, keeping everyone else's.
    step('Cleaning up legacy delphi-dev hooks in ~/.claude/settings.json...');
    removeHooks();
    success('Legacy hooks cleaned');

    // A pre-release is not on the Marketplace: its extension is a .vsix attached to the GitHub Release.
    const betaExtension = isPrerelease(packageVersion());
    if (betaExtension) {
      step('VS Code extension: the beta is a .vsix on the GitHub Release (not the Marketplace); see the README for "code --install-extension"');
    } else if (isVSCodeAvailable()) {
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

    if (!betaExtension && (!isVSCodeAvailable() || !isVSCodeExtensionInstalled())) {
      console.log(chalk.dim('💡 Tip: Install the Delphi Dev extension for VS Code — search "Delphi Dev" in the Extensions panel or run:'));
      console.log(chalk.dim('   code --install-extension adrianosantos.delphi-dev-vscode'));
      console.log('');
    }

    if (!result.pluginOk) {
      error('Plugin not active. Try: claude plugin list');
      process.exit(1);
    }
    if (portableFailed) process.exit(1);
    if (portablePartial) process.exit(2);
  });

program
  .command('update')
  .description('Update the delphi-dev plugin (the knowledge base updates itself; use /update in a session)')
  .option('--ref <ref>', 'tag, branch or sha to update to (default: the ref recorded at install time)')
  .action((opts: { ref?: string }) => {
    header('Updating delphi-dev');
    let plan: ReturnType<typeof planUpdateRef>;
    try {
      plan = planUpdateRef({ flag: opts.ref, version: packageVersion(), state: readRefState() });
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    if (plan.ref) {
      step(`Ref: ${plan.ref} (${plan.explicit ? 'chosen with --ref' : 'pre-release version of this package'})`);
      if (plan.kept) warn(`update keeps the ref recorded at install time (${plan.ref}); to return to the stable line run: npx delphi-dev`);
    }
    const installed = installedPortableTargets(readInstallManifest());
    // Without a Codex/OpenCode install this is exactly the historical Claude Code update.
    if (!installed.length || detectSystem().hasClaudeCLI) {
      step('Pulling latest plugin...');
      installPlugin({ ref: plan.ref });
      if (plan.ref) recordRef(plan);
      success('Plugin updated — restart your Claude Code session');
    }
    if (installed.length) {
      step(`Updating ${installed.join(' + ')}...`);
      let partial = false;
      try {
        const outcome = runPortable('install', installed, { ref: plan.ref });
        if (plan.ref) recordRef(plan);
        if (outcome === 'partial') {
          partial = true;
          warn(`Update of ${installed.join(' + ')} was PARTIAL: some items were not applied (see the ! and ? lines above)`);
        } else {
          success(`Updated ${installed.join(' + ')} — restart the agent session`);
        }
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
      if (partial) process.exit(2);
    }
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
    const installed = installedPortableTargets(readInstallManifest());
    if (installed.length) {
      step(`Removing delphi-dev from ${installed.join(' + ')}...`);
      try {
        runPortable('uninstall', installed, {});
        success('Codex/OpenCode files removed (only what delphi-dev installed)');
      } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      }
    }
  });

program.parse();
