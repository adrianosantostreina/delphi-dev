import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { splitSections } from './chunk';
import type { Snapshot } from './snapshot';

export const INDEX_SCHEMA = '1';
const TEMP_MAX_AGE_MS = 10 * 60 * 1000;

// Loaded on demand: a static import would crash the Node 18 bundles at startup.
const requireCjs = createRequire(import.meta.url);

export function openDatabase(file: string, readOnly = false): DatabaseSync {
  const sqlite = requireCjs('node:sqlite') as typeof import('node:sqlite');
  return new sqlite.DatabaseSync(file, { readOnly });
}

export function readIndexSnapshotId(dbPath: string): string | null {
  if (!fs.existsSync(dbPath) || !fs.statSync(dbPath).isFile()) return null;
  try {
    const db = openDatabase(dbPath, true);
    try {
      const get = (key: string) =>
        (db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value?: string } | undefined)?.value;
      return get('schema') === INDEX_SCHEMA ? get('snapshot_id') ?? null : null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export function writeIndex(snapshot: Snapshot, file: string): void {
  const db = openDatabase(file);
  try {
    db.exec(`
      CREATE VIRTUAL TABLE sections USING fts5(
        title, heading, body, tags,
        path UNINDEXED, tier UNINDEXED, category UNINDEXED,
        tokenize = 'unicode61 remove_diacritics 2'
      );
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    `);
    const insert = db.prepare(
      'INSERT INTO sections (title, heading, body, tags, path, tier, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    const meta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    db.exec('BEGIN');
    for (const doc of snapshot.docs) {
      for (const section of splitSections(doc.body)) {
        insert.run(doc.title, section.heading, section.body, doc.tags, doc.path, doc.tier, doc.category);
      }
    }
    meta.run('snapshot_id', snapshot.id);
    meta.run('schema', INDEX_SCHEMA);
    meta.run('built_at', new Date().toISOString());
    db.exec('COMMIT');
  } finally {
    db.close();
  }
}

function removeStaleTemps(dbPath: string): void {
  const dir = path.dirname(dbPath);
  const prefix = `${path.basename(dbPath)}.tmp-`;
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith(prefix)) continue;
    const full = path.join(dir, name);
    try {
      if (Date.now() - fs.statSync(full).mtimeMs > TEMP_MAX_AGE_MS) fs.rmSync(full, { force: true });
    } catch {
      // another process may be using it
    }
  }
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function ensureIndex(snapshot: Snapshot, dbPath: string): string {
  if (readIndexSnapshotId(dbPath) === snapshot.id) return dbPath;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  removeStaleTemps(dbPath);
  const tmp = `${dbPath}.tmp-${process.pid}-${Date.now()}`;
  writeIndex(snapshot, tmp);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      fs.renameSync(tmp, dbPath);
      return dbPath;
    } catch {
      sleepSync(50);
    }
  }
  // kb.db is held open by another process (Windows): use the fresh copy for this call.
  return tmp;
}
