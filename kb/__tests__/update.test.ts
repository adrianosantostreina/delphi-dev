import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveActive } from '../src/active';
import { buildManifest } from '../src/manifest';
import { cacheCurrentDir, MANIFEST_URL, rawFileUrl } from '../src/paths';
import { readState, writeState } from '../src/prefs';
import { readSnapshot, sha256 } from '../src/snapshot';
import { removeBestEffort, runUpdate, type Fetcher } from '../src/update';
import { FIXTURE, makePluginRoot, tmpDir, writeTree } from './helpers';

const COMMIT = 'abcdef1';
const NOW = new Date('2026-10-14T12:00:00Z');

/** Remote = FIXTURE with encoding.md changed, firedac.md removed and a new fmx doc. */
function remoteSetup() {
  const remoteDir = tmpDir('kb-remote-');
  const files = { ...FIXTURE, 'core/encoding.md': '# Encoding\n\nversão nova\n', 'fmx/novo.md': '# Novo\n\nconteúdo\n' };
  delete (files as Record<string, string>)['core/firedac.md'];
  writeTree(remoteDir, files);
  const manifest = buildManifest(readSnapshot(remoteDir), COMMIT, '4.0.0', NOW);
  const responses = new Map<string, Buffer>([[MANIFEST_URL, Buffer.from(JSON.stringify(manifest))]]);
  for (const f of manifest.files) {
    responses.set(rawFileUrl(COMMIT, f.path), fs.readFileSync(path.join(remoteDir, ...f.path.split('/'))));
  }
  const calls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    calls.push(url);
    const body = responses.get(url);
    if (!body) throw new Error(`404 ${url}`);
    return body;
  };
  return { manifest, responses, fetcher, calls };
}

describe('runUpdate', () => {
  it('downloads only what changed and switches to the updated snapshot', async () => {
    const root = makePluginRoot(FIXTURE);
    const data = tmpDir();
    const { fetcher, calls } = remoteSetup();
    const result = await runUpdate({ root, data, env: {}, pluginVersion: '4.0.0', fetcher, now: NOW });

    expect(result).toMatchObject({ status: 'updated', added: 1, changed: 1, removed: 1, commit: COMMIT, remotePluginVersion: '4.0.0' });
    expect(calls.filter((u) => u !== MANIFEST_URL).sort()).toEqual(
      [rawFileUrl(COMMIT, 'core/encoding.md'), rawFileUrl(COMMIT, 'fmx/novo.md')].sort(),
    );
    const current = cacheCurrentDir(data);
    expect(fs.readFileSync(path.join(current, 'core', 'encoding.md'), 'utf8')).toContain('versão nova');
    expect(fs.existsSync(path.join(current, 'core', 'firedac.md'))).toBe(false);
    expect(fs.existsSync(path.join(current, 'core', 'class-var.md'))).toBe(true);
    expect(resolveActive(root, data, {}, '4.0.0')).toMatchObject({ kind: 'updated', commit: COMMIT });
    expect(readState(data)).toMatchObject({ lastCheck: NOW.toISOString(), lastResult: 'updated', remoteCommit: COMMIT });
  });

  it('reports up-to-date when the active snapshot already matches', async () => {
    const root = makePluginRoot(FIXTURE);
    const manifest = buildManifest(readSnapshot(path.join(root, 'knowledge')), COMMIT, '4.0.0', NOW);
    const fetcher: Fetcher = async () => Buffer.from(JSON.stringify(manifest));
    const data = tmpDir();
    const result = await runUpdate({ root, data, env: {}, pluginVersion: '4.0.0', fetcher, now: NOW });
    expect(result.status).toBe('up-to-date');
    expect(fs.existsSync(cacheCurrentDir(data))).toBe(false);
  });

  it('keeps the current snapshot and does not mark the check when a hash does not match', async () => {
    const root = makePluginRoot(FIXTURE);
    const data = tmpDir();
    const { fetcher, responses } = remoteSetup();
    responses.set(rawFileUrl(COMMIT, 'fmx/novo.md'), Buffer.from('adulterado'));
    const result = await runUpdate({ root, data, env: {}, pluginVersion: '4.0.0', fetcher, now: NOW });
    expect(result.status).toBe('failed');
    expect(result.error).toContain('sha256 mismatch');
    expect(fs.existsSync(cacheCurrentDir(data))).toBe(false);
    expect(fs.readdirSync(path.join(data, 'kb-cache')).filter((n) => n.startsWith('staging-'))).toEqual([]);
    expect(readState(data).lastCheck).toBeNull();
  });

  it('fails on a manifest that points outside knowledge/', async () => {
    const root = makePluginRoot(FIXTURE);
    const bad = { schema: 1, commit: COMMIT, generatedAt: NOW.toISOString(), pluginVersion: '4.0.0',
      files: [{ path: 'core/../../evil.md', sha256: sha256('x'), bytes: 1 }] };
    const fetcher: Fetcher = async () => Buffer.from(JSON.stringify(bad));
    const result = await runUpdate({ root, data: tmpDir(), env: {}, pluginVersion: '4.0.0', fetcher, now: NOW });
    expect(result.status).toBe('failed');
  });

  it('does nothing offline', async () => {
    const fetcher: Fetcher = async () => { throw new Error('should not fetch'); };
    const result = await runUpdate({
      root: makePluginRoot(FIXTURE), data: tmpDir(), env: { DELPHI_DEV_KB_OFFLINE: '1' }, pluginVersion: '4.0.0', fetcher,
    });
    expect(result.status).toBe('offline');
  });

  it('skips within 24h unless forced', async () => {
    const root = makePluginRoot(FIXTURE);
    const data = tmpDir();
    writeState(data, { lastCheck: new Date(NOW.getTime() - 60_000).toISOString() });
    const { fetcher } = remoteSetup();
    expect((await runUpdate({ root, data, env: {}, pluginVersion: '4.0.0', fetcher, now: NOW })).status).toBe('skipped');
    expect((await runUpdate({ root, data, env: {}, pluginVersion: '4.0.0', fetcher, now: NOW, force: true })).status).toBe('updated');
  });
});

describe('update cleanup', () => {
  it('sweeps stale current-old-* and staging-* dirs but keeps fresh ones', async () => {
    const root = makePluginRoot(FIXTURE);
    const manifest = buildManifest(readSnapshot(path.join(root, 'knowledge')), COMMIT, '4.0.0', NOW);
    const fetcher: Fetcher = async () => Buffer.from(JSON.stringify(manifest));
    const data = tmpDir();
    const cache = path.join(data, 'kb-cache');
    const mk = (name: string, ageMin: number) => {
      const dir = path.join(cache, name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'x.txt'), 'x');
      const t = new Date(Date.now() - ageMin * 60_000);
      fs.utimesSync(dir, t, t);
    };
    mk('current-old-stale', 20);
    mk('staging-stale', 20);
    mk('current-old-fresh', 1);
    mk('other-stale', 20);
    const result = await runUpdate({ root, data, env: {}, pluginVersion: '4.0.0', fetcher, now: NOW });
    expect(result.status).toBe('up-to-date');
    expect(fs.existsSync(path.join(cache, 'current-old-stale'))).toBe(false);
    expect(fs.existsSync(path.join(cache, 'staging-stale'))).toBe(false);
    expect(fs.existsSync(path.join(cache, 'current-old-fresh'))).toBe(true);
    expect(fs.existsSync(path.join(cache, 'other-stale'))).toBe(true);
  });

  it('removeBestEffort never throws, even when removal fails', () => {
    const data = tmpDir();
    expect(() => removeBestEffort(path.join(data, 'does-not-exist'), data)).not.toThrow();
    expect(() => removeBestEffort('bad\0path', data)).not.toThrow();
  });
});

