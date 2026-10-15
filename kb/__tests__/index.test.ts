import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureIndex, openDatabase, readIndexSnapshotId } from '../src/index';
import { readSnapshot } from '../src/snapshot';
import { FIXTURE, tmpDir, writeTree } from './helpers';

function snapshotOf(files: Record<string, string>) {
  const dir = tmpDir('kb-knowledge-');
  writeTree(dir, files);
  return { dir, snap: readSnapshot(dir) };
}

function count(dbPath: string): number {
  const db = openDatabase(dbPath, true);
  try {
    return (db.prepare('SELECT count(*) AS n FROM sections').get() as { n: number }).n;
  } finally {
    db.close();
  }
}

describe('index', () => {
  it('builds an FTS5 index with one row per section and the snapshot id', () => {
    const { snap } = snapshotOf(FIXTURE);
    const dbPath = path.join(tmpDir(), 'kb.db');
    expect(ensureIndex(snap, dbPath)).toBe(dbPath);
    expect(readIndexSnapshotId(dbPath)).toBe(snap.id);
    expect(count(dbPath)).toBeGreaterThanOrEqual(snap.docs.length);
  });

  it('does not rebuild when the snapshot did not change', () => {
    const { snap } = snapshotOf(FIXTURE);
    const dbPath = path.join(tmpDir(), 'kb.db');
    ensureIndex(snap, dbPath);
    const before = fs.statSync(dbPath).mtimeMs;
    ensureIndex(snap, dbPath);
    expect(fs.statSync(dbPath).mtimeMs).toBe(before);
  });

  it('rebuilds when the snapshot changes', () => {
    const { dir, snap } = snapshotOf(FIXTURE);
    const dbPath = path.join(tmpDir(), 'kb.db');
    ensureIndex(snap, dbPath);
    fs.writeFileSync(path.join(dir, 'core', 'novo.md'), '# Novo\n\ntexto\n');
    const next = readSnapshot(dir);
    ensureIndex(next, dbPath);
    expect(readIndexSnapshotId(dbPath)).toBe(next.id);
  });

  it('replaces a corrupted index', () => {
    const { snap } = snapshotOf(FIXTURE);
    const dbPath = path.join(tmpDir(), 'kb.db');
    fs.writeFileSync(dbPath, 'isto não é sqlite');
    expect(readIndexSnapshotId(dbPath)).toBeNull();
    expect(ensureIndex(snap, dbPath)).toBe(dbPath);
    expect(readIndexSnapshotId(dbPath)).toBe(snap.id);
  });

  // Review Focus 1: on Windows another process holding kb.db makes rename fail.
  // A directory at dbPath makes rename fail on every OS.
  it('falls back to the fresh temp index when the rename fails', () => {
    const { snap } = snapshotOf(FIXTURE);
    const dbPath = path.join(tmpDir(), 'kb.db');
    fs.mkdirSync(dbPath);
    const used = ensureIndex(snap, dbPath);
    expect(used).not.toBe(dbPath);
    expect(readIndexSnapshotId(used)).toBe(snap.id);
  });
});
