import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Config {
  suggestions: 'on' | 'off';
  offline: boolean;
}

export interface State {
  lastCheck: string | null;
  lastResult: string | null;
  remoteCommit: string | null;
  remotePluginVersion: string | null;
}

const EMPTY_STATE: State = { lastCheck: null, lastResult: null, remoteCommit: null, remotePluginVersion: null };
export const LOG_MAX_BYTES = 1024 * 1024;

function readJson(file: string): Record<string, unknown> {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

export function readConfig(data: string): Config {
  const raw = readJson(path.join(data, 'config.json'));
  return { suggestions: raw.suggestions === 'off' ? 'off' : 'on', offline: raw.offline === true };
}

export function writeConfig(data: string, patch: Partial<Config>): Config {
  const next = { ...readConfig(data), ...patch };
  writeJson(path.join(data, 'config.json'), next);
  return next;
}

export function readState(data: string): State {
  const raw = readJson(path.join(data, 'state.json'));
  const pick = (key: keyof State) => (typeof raw[key] === 'string' ? (raw[key] as string) : null);
  return {
    lastCheck: pick('lastCheck'),
    lastResult: pick('lastResult'),
    remoteCommit: pick('remoteCommit'),
    remotePluginVersion: pick('remotePluginVersion'),
  };
}

export function writeState(data: string, patch: Partial<State>): State {
  const next = { ...EMPTY_STATE, ...readState(data), ...patch };
  writeJson(path.join(data, 'state.json'), next);
  return next;
}

export function isOffline(data: string, env: NodeJS.ProcessEnv): boolean {
  return env.DELPHI_DEV_KB_OFFLINE === '1' || readConfig(data).offline;
}

export function logError(data: string, where: string, err: unknown): void {
  try {
    const dir = path.join(data, 'logs');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'kb.log');
    if (fs.existsSync(file) && fs.statSync(file).size > LOG_MAX_BYTES) fs.renameSync(file, `${file}.1`);
    const message = err instanceof Error ? err.stack ?? `${err.name}: ${err.message}` : String(err);
    fs.appendFileSync(file, `${new Date().toISOString()} [${where}] ${message}\n`);
  } catch {
    // logging must never break a hook or a tool call
  }
}
