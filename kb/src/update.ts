import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveActive } from './active';
import { diffFiles, parseManifest } from './manifest';
import { cacheCurrentDir, MANIFEST_URL, rawFileUrl } from './paths';
import { isOffline, logError, readState, writeState } from './prefs';
import { readSnapshot, sha256 } from './snapshot';

export type Fetcher = (url: string, timeoutMs: number) => Promise<Buffer>;

export const nodeFetcher: Fetcher = async (url, timeoutMs) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'delphi-dev-kb' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
};

export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const UPDATE_DEADLINE_MS = 60_000;
const MANIFEST_TIMEOUT_MS = 5_000;
const FILE_TIMEOUT_MS = 15_000;

export interface UpdateOptions {
  root: string;
  data: string;
  env: NodeJS.ProcessEnv;
  pluginVersion: string;
  fetcher?: Fetcher;
  force?: boolean;
  now?: Date;
}

export interface UpdateResult {
  status: 'up-to-date' | 'updated' | 'offline' | 'skipped' | 'failed';
  added: number;
  changed: number;
  removed: number;
  commit: string | null;
  remotePluginVersion: string | null;
  error?: string;
}

export function isCheckDue(data: string, now: Date): boolean {
  const last = readState(data).lastCheck;
  if (!last) return true;
  const at = Date.parse(last);
  return Number.isNaN(at) || now.getTime() - at > CHECK_INTERVAL_MS;
}

function writeInto(dir: string, rel: string, content: Buffer): void {
  const full = path.join(dir, ...rel.split('/'));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

/** Removal must never turn a finished update into a failure: errors are logged, not thrown. */
export function removeBestEffort(target: string, data: string): void {
  try {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 });
  } catch (err) {
    logError(data, 'update:cleanup', err);
  }
}

const STALE_MS = 10 * 60 * 1000;

/** Drops leftovers of interrupted updates (current-old-*, staging-*) older than 10 minutes. */
function sweepStale(data: string): void {
  const cache = path.join(data, 'kb-cache');
  try {
    for (const name of fs.readdirSync(cache)) {
      if (!/^(current-old-|staging-)/.test(name)) continue;
      const full = path.join(cache, name);
      try {
        if (Date.now() - fs.statSync(full).mtimeMs > STALE_MS) removeBestEffort(full, data);
      } catch (err) {
        logError(data, 'update:cleanup', err);
      }
    }
  } catch {
    // no cache dir yet
  }
}

function swapIntoCurrent(data: string, staging: string): void {
  const current = cacheCurrentDir(data);
  const old = `${current}-old-${process.pid}-${Date.now()}`;
  if (fs.existsSync(current)) fs.renameSync(current, old);
  try {
    fs.renameSync(staging, current);
  } catch (err) {
    if (fs.existsSync(old)) fs.renameSync(old, current);
    throw err;
  }
  removeBestEffort(old, data);
}

export async function runUpdate(opts: UpdateOptions): Promise<UpdateResult> {
  const { root, data, env, pluginVersion, fetcher = nodeFetcher, force = false, now = new Date() } = opts;
  const none = { added: 0, changed: 0, removed: 0, commit: null, remotePluginVersion: null };
  if (isOffline(data, env)) return { status: 'offline', ...none };
  if (!force && !isCheckDue(data, now)) return { status: 'skipped', ...none };

  sweepStale(data);
  const started = Date.now();
  const staging = path.join(data, 'kb-cache', `staging-${process.pid}-${started}`);
  try {
    const manifest = parseManifest(JSON.parse((await fetcher(MANIFEST_URL, MANIFEST_TIMEOUT_MS)).toString('utf8')));
    const active = resolveActive(root, data, env, pluginVersion);
    const local = readSnapshot(active.dir).docs.map((d) => ({ path: d.path, sha256: d.sha256, bytes: d.bytes }));
    const diff = diffFiles(local, manifest.files);
    const counts = {
      added: diff.added.length,
      changed: diff.changed.length,
      removed: diff.removed.length,
      commit: manifest.commit,
      remotePluginVersion: manifest.pluginVersion,
    };
    const remoteState = { lastCheck: now.toISOString(), remoteCommit: manifest.commit, remotePluginVersion: manifest.pluginVersion };

    if (!counts.added && !counts.changed && !counts.removed) {
      writeState(data, { ...remoteState, lastResult: 'up-to-date' });
      return { status: 'up-to-date', ...counts };
    }

    fs.mkdirSync(staging, { recursive: true });
    const changedPaths = new Set(diff.changed.map((f) => f.path));
    const remotePaths = new Set(manifest.files.map((f) => f.path));
    for (const f of local) {
      if (remotePaths.has(f.path) && !changedPaths.has(f.path)) {
        writeInto(staging, f.path, fs.readFileSync(path.join(active.dir, ...f.path.split('/'))));
      }
    }
    for (const f of [...diff.added, ...diff.changed]) {
      if (Date.now() - started > UPDATE_DEADLINE_MS) throw new Error('update deadline exceeded');
      const body = await fetcher(rawFileUrl(manifest.commit, f.path), FILE_TIMEOUT_MS);
      if (sha256(body) !== f.sha256) throw new Error(`sha256 mismatch for ${f.path}`);
      writeInto(staging, f.path, body);
    }
    fs.writeFileSync(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(staging, 'meta.json'), JSON.stringify({ pluginVersion, commit: manifest.commit }));
    swapIntoCurrent(data, staging);
    writeState(data, { ...remoteState, lastResult: 'updated' });
    return { status: 'updated', ...counts };
  } catch (err) {
    fs.rmSync(staging, { recursive: true, force: true });
    const message = err instanceof Error ? err.message : String(err);
    // lastCheck stays untouched so the next start retries.
    writeState(data, { lastResult: `failed: ${message}` });
    return { status: 'failed', ...none, error: message };
  }
}
