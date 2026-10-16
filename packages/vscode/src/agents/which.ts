import * as fs from 'node:fs';
import * as path from 'node:path';

export interface WhichOptions {
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  /** true when the path is an existing file (executable on POSIX). */
  exists: (file: string) => boolean;
}

const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';

/** Case-insensitive env lookup: Windows exposes `Path`, not `PATH`. */
function envValue(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const key = Object.keys(env).find((k) => k.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : env[key];
}

/**
 * Looks for an executable on PATH without running anything.
 * Empty entries and relative ones (".", "bin") are ignored: they mean the current directory,
 * which must never be searched for a binary to trust.
 */
export function findOnPath(cmd: string, o: WhichOptions): boolean {
  if (!cmd || /[\\/]/.test(cmd)) return false;
  const win = o.platform === 'win32';
  const p = win ? path.win32 : path.posix;
  const raw = envValue(o.env, 'PATH') ?? '';
  const dirs = raw
    .split(win ? ';' : ':')
    .map((d) => (win ? d.trim().replace(/^"(.*)"$/, '$1') : d))
    .filter((d) => d !== '' && p.isAbsolute(d));
  const exts = win
    ? (envValue(o.env, 'PATHEXT') || DEFAULT_PATHEXT).split(';').map((e) => e.trim()).filter((e) => e !== '')
    : [];
  const names = win
    ? [...(exts.some((e) => cmd.toLowerCase().endsWith(e.toLowerCase())) ? [cmd] : []), ...exts.map((e) => cmd + e)]
    : [cmd];
  return dirs.some((dir) => names.some((name) => o.exists(p.join(dir, name))));
}

export function isExecutableFile(file: string, platform: NodeJS.Platform = process.platform): boolean {
  try {
    if (!fs.statSync(file).isFile()) return false;
    if (platform !== 'win32') fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function commandOnPath(cmd: string): boolean {
  return findOnPath(cmd, { env: process.env, platform: process.platform, exists: (f) => isExecutableFile(f) });
}
