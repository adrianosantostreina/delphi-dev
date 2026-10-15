import { describe, it, expect } from 'vitest';
import { buildManifest, diffFiles, parseManifest, type Manifest } from '../src/manifest';
import { readSnapshot } from '../src/snapshot';
import { FIXTURE, tmpDir, writeTree } from './helpers';

const SHA = 'a'.repeat(64);

function valid(): Manifest {
  return {
    schema: 1, commit: 'abc1234', generatedAt: '2026-10-14T00:00:00.000Z', pluginVersion: '4.0.0',
    files: [{ path: 'core/a.md', sha256: SHA, bytes: 10 }],
  };
}

describe('manifest', () => {
  it('lists every snapshot doc with hash and size', () => {
    const dir = tmpDir();
    writeTree(dir, FIXTURE);
    const snap = readSnapshot(dir);
    const m = buildManifest(snap, 'abc1234', '4.0.0', new Date('2026-10-14T00:00:00Z'));
    expect(m.generatedAt).toBe('2026-10-14T00:00:00.000Z');
    expect(m.files.map((f) => f.path)).toEqual(snap.docs.map((d) => d.path));
    expect(m.files[0]).toEqual({ path: snap.docs[0].path, sha256: snap.docs[0].sha256, bytes: snap.docs[0].bytes });
  });

  it('accepts a valid manifest', () => {
    expect(parseManifest(valid())).toEqual(valid());
  });

  it.each([
    ['schema', { ...valid(), schema: 2 }],
    ['commit', { ...valid(), commit: 'not a sha' }],
    ['traversal', { ...valid(), files: [{ path: 'core/../../x.md', sha256: SHA, bytes: 1 }] }],
    ['local tier', { ...valid(), files: [{ path: 'local/x.md', sha256: SHA, bytes: 1 }] }],
    ['sha', { ...valid(), files: [{ path: 'core/a.md', sha256: 'xyz', bytes: 1 }] }],
    ['null', null],
  ])('rejects a manifest with bad %s', (_name, input) => {
    expect(() => parseManifest(input)).toThrow();
  });

  it('diffs added, changed and removed files', () => {
    const local = [
      { path: 'core/same.md', sha256: '1', bytes: 1 },
      { path: 'core/changed.md', sha256: '2', bytes: 1 },
      { path: 'core/gone.md', sha256: '3', bytes: 1 },
    ];
    const remote = [
      { path: 'core/same.md', sha256: '1', bytes: 1 },
      { path: 'core/changed.md', sha256: '9', bytes: 1 },
      { path: 'fmx/new.md', sha256: '4', bytes: 1 },
    ];
    const d = diffFiles(local, remote);
    expect(d.added.map((f) => f.path)).toEqual(['fmx/new.md']);
    expect(d.changed.map((f) => f.path)).toEqual(['core/changed.md']);
    expect(d.removed).toEqual(['core/gone.md']);
  });
});
