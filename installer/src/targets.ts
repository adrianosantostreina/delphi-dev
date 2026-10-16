import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { commandExists } from './detect';
import { checkoutRef, cloneAtRef, returnToDefaultBranch } from './ref';

export type Target = 'claude' | 'codex' | 'opencode';
export const ALL_TARGETS: Target[] = ['claude', 'codex', 'opencode'];
export const REPO_URL = 'https://github.com/adrianosantostreina/delphi-dev.git';

export interface Probe {
  commandExists(cmd: string): boolean;
  pathExists(p: string): boolean;
  home: string;
  vscodeExtensions: string[];
}

export function detectTargets(p: Probe): Record<Target, boolean> {
  const ext = (id: string): boolean => p.vscodeExtensions.includes(id);
  return {
    claude: p.commandExists('claude --version'),
    codex: p.commandExists('codex --version') || p.pathExists(path.join(p.home, '.codex')) || ext('openai.chatgpt'),
    opencode:
      p.commandExists('opencode --version') ||
      p.pathExists(path.join(p.home, '.config', 'opencode')) ||
      ext('sst-dev.opencode'),
  };
}

/**
 * Without `--target` the install is the historical one: Claude Code only. Detection never decides
 * what gets written to Codex/OpenCode (their config files are the user's); it only feeds
 * `portableHints`, which prints the command that would do it.
 */
export function resolveTargets(flag: string | undefined, _detected?: Record<Target, boolean>): Target[] {
  if (!flag) return ['claude'];
  if (flag.trim() === 'all') return [...ALL_TARGETS];
  const picked = flag.split(',').map((s) => s.trim()).filter(Boolean);
  if (!picked.length) throw new Error('--target vazio (use claude, codex, opencode ou all)');
  const unknown = picked.filter((t) => !ALL_TARGETS.includes(t as Target));
  if (unknown.length) throw new Error(`alvo(s) desconhecido(s): ${unknown.join(', ')} (use claude, codex, opencode ou all)`);
  return ALL_TARGETS.filter((t) => picked.includes(t));
}

/** The exact commands to suggest when Codex/OpenCode are around but `--target` was not given. */
export function portableHints(detected: Record<Target, boolean>): string[] {
  return (['codex', 'opencode'] as Target[]).filter((t) => detected[t]).map((t) => `npx delphi-dev --target ${t}`);
}

export function checkoutDir(home: string = os.homedir()): string {
  return path.join(home, '.delphi-dev', 'plugin');
}

export interface CheckoutDeps {
  run(cmd: string, args: string[]): { status: number | null };
  exists(p: string): boolean;
}

/**
 * `dryRun` never runs git: an existing checkout is reused as is, and a missing one is reported as
 * `null` ("would be cloned") because there is nothing to run `kb-cli --dry-run` from.
 */
export interface CheckoutRefOptions {
  /** Tag, branch or sha to leave the checkout on. Absent: the historical default-branch behaviour. */
  ref?: string;
  /** No ref, but the checkout is pinned from an earlier install: put it back on the default branch. */
  unpin?: boolean;
}

export function ensureCheckout(
  dest: string,
  from: string | undefined,
  deps: CheckoutDeps,
  dryRun = false,
  opt: CheckoutRefOptions = {},
): string | null {
  if (from) {
    if (!deps.exists(path.join(from, 'runtime', 'kb-cli.mjs'))) {
      throw new Error(`--from ${from}: runtime/kb-cli.mjs nao encontrado (esse checkout e da v4?)`);
    }
    return from;
  }
  if (deps.exists(path.join(dest, '.git'))) {
    if (opt.ref) {
      if (!dryRun) checkoutRef(dest, opt.ref, deps.run);
    } else if (opt.unpin) {
      if (!dryRun) returnToDefaultBranch(dest, deps.run);
    } else if (!dryRun) {
      // Offline or diverged: keep what is already there.
      deps.run('git', ['-C', dest, 'pull', '--ff-only']);
    }
    return dest;
  }
  if (dryRun) return null;
  if (opt.ref) {
    cloneAtRef(dest, opt.ref, deps.run, REPO_URL);
    return dest;
  }
  const result = deps.run('git', ['clone', '--depth=1', REPO_URL, dest]);
  if (result.status !== 0) throw new Error('git clone falhou');
  return dest;
}

export function kbCliArgs(
  cmd: 'install' | 'uninstall',
  checkout: string,
  targets: Target[],
  o: { scope?: string; project?: string; dryRun?: boolean; force?: boolean },
): string[] {
  const portable = targets.filter((t) => t !== 'claude');
  const target = portable.length > 1 ? 'all' : portable[0];
  const args = [path.join(checkout, 'runtime', 'kb-cli.mjs'), cmd, '--target', target, '--checkout', checkout];
  if (o.scope) args.push('--scope', o.scope);
  if (o.project) args.push('--project', o.project);
  if (o.dryRun) args.push('--dry-run');
  if (o.force) args.push('--force');
  return args;
}

export function installedPortableTargets(manifestJson: string | null): Target[] {
  if (!manifestJson) return [];
  try {
    const m = JSON.parse(manifestJson) as Record<string, { files?: unknown[]; dirs?: unknown[] } | undefined>;
    return (['codex', 'opencode'] as Target[]).filter((t) => (m[t]?.files?.length ?? 0) + (m[t]?.dirs?.length ?? 0) > 0);
  } catch {
    return [];
  }
}

export function realProbe(): Probe {
  let extensions: string[] = [];
  try {
    extensions = execSync('code --list-extensions', { encoding: 'utf-8', stdio: 'pipe', timeout: 15000 })
      .split(/\r?\n/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  } catch {
    extensions = [];
  }
  return {
    commandExists,
    pathExists: (p) => fs.existsSync(p),
    home: os.homedir(),
    vscodeExtensions: extensions,
  };
}

/**
 * kb-cli install exits 0 (everything applied), 2 (ran, but some items were refused or skipped on
 * purpose to protect the user's files) or anything else (an error). 'partial' is NOT a failure and
 * NOT a clean success: the caller must say so.
 */
export function portableOutcome(cmd: 'install' | 'uninstall', status: number | null): 'ok' | 'partial' {
  if (status === 0) return 'ok';
  if (status === 2 && cmd === 'install') return 'partial';
  throw new Error(`kb-cli ${cmd} falhou (codigo ${status})`);
}

export function runPortable(
  cmd: 'install' | 'uninstall',
  targets: Target[],
  o: { from?: string; scope?: string; project?: string; dryRun?: boolean; force?: boolean; ref?: string; unpin?: boolean },
): 'ok' | 'partial' {
  const portable = targets.filter((t) => t !== 'claude');
  if (!portable.length) return 'ok';
  // git is a real executable on every platform: no shell, so a home path with spaces stays one argument.
  const deps: CheckoutDeps = {
    run: (c, a) => spawnSync(c, a, { stdio: 'inherit' }),
    exists: (p) => fs.existsSync(p),
  };
  const checkout = ensureCheckout(checkoutDir(), o.from ? path.resolve(o.from) : undefined, deps, !!o.dryRun, { ref: o.ref, unpin: o.unpin });
  if (checkout === null) {
    console.log(`[dry-run] would clone ${REPO_URL}${o.ref ? ` at ${o.ref}` : ''} to ${checkoutDir()} and then run kb-cli ${cmd} --dry-run`);
    return 'ok';
  }
  const args = kbCliArgs(cmd, checkout, portable, o);
  if (!fs.existsSync(args[0])) {
    throw new Error(`${args[0]} nao encontrado: o checkout nao tem o suporte a Codex/OpenCode (use --from <checkout v4>)`);
  }
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  return portableOutcome(cmd, result.status);
}

/** Same location rule as kb-cli (`manifestPath`): $DELPHI_DEV_DATA or ~/.delphi-dev. */
export function manifestFile(home: string = os.homedir(), env: NodeJS.ProcessEnv = process.env): string {
  return path.join(env.DELPHI_DEV_DATA || path.join(home, '.delphi-dev'), 'install-manifest.json');
}

export function readInstallManifest(home: string = os.homedir(), env: NodeJS.ProcessEnv = process.env): string | null {
  try {
    return fs.readFileSync(manifestFile(home, env), 'utf-8');
  } catch {
    return null;
  }
}
