import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { commandExists } from './detect';

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

export function resolveTargets(flag: string | undefined, detected: Record<Target, boolean>): Target[] {
  if (!flag) return ALL_TARGETS.filter((t) => detected[t]);
  if (flag.trim() === 'all') return [...ALL_TARGETS];
  const picked = flag.split(',').map((s) => s.trim()).filter(Boolean);
  if (!picked.length) throw new Error('--target vazio (use claude, codex, opencode ou all)');
  const unknown = picked.filter((t) => !ALL_TARGETS.includes(t as Target));
  if (unknown.length) throw new Error(`alvo(s) desconhecido(s): ${unknown.join(', ')} (use claude, codex, opencode ou all)`);
  return ALL_TARGETS.filter((t) => picked.includes(t));
}

export function checkoutDir(home: string = os.homedir()): string {
  return path.join(home, '.delphi-dev', 'plugin');
}

export interface CheckoutDeps {
  run(cmd: string, args: string[]): { status: number | null };
  exists(p: string): boolean;
}

export function ensureCheckout(dest: string, from: string | undefined, deps: CheckoutDeps): string {
  if (from) {
    if (!deps.exists(path.join(from, 'runtime', 'kb-cli.mjs'))) {
      throw new Error(`--from ${from}: runtime/kb-cli.mjs nao encontrado (esse checkout e da v4?)`);
    }
    return from;
  }
  if (deps.exists(path.join(dest, '.git'))) {
    // Offline or diverged: keep what is already there.
    deps.run('git', ['-C', dest, 'pull', '--ff-only']);
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

export function runPortable(
  cmd: 'install' | 'uninstall',
  targets: Target[],
  o: { from?: string; scope?: string; project?: string; dryRun?: boolean; force?: boolean },
): void {
  const portable = targets.filter((t) => t !== 'claude');
  if (!portable.length) return;
  // git is a real executable on every platform: no shell, so a home path with spaces stays one argument.
  const deps: CheckoutDeps = {
    run: (c, a) => spawnSync(c, a, { stdio: 'inherit' }),
    exists: (p) => fs.existsSync(p),
  };
  const checkout = ensureCheckout(checkoutDir(), o.from ? path.resolve(o.from) : undefined, deps);
  const args = kbCliArgs(cmd, checkout, portable, o);
  if (!fs.existsSync(args[0])) {
    throw new Error(`${args[0]} nao encontrado: o checkout nao tem o suporte a Codex/OpenCode (use --from <checkout v4>)`);
  }
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`kb-cli ${cmd} falhou (codigo ${result.status})`);
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
