import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseFrontmatter, readSnapshot, sha256, snapshotId, tierForPath } from '../src/snapshot';
import { FIXTURE, tmpDir, writeTree } from './helpers';

function knowledge(files: Record<string, string | Buffer>): string {
  const dir = tmpDir('kb-knowledge-');
  writeTree(dir, files);
  return dir;
}

describe('snapshot', () => {
  it('maps folders to tiers and ignores anything else', () => {
    expect(tierForPath('core/a.md')).toBe('canonical');
    expect(tierForPath('fmx/a.md')).toBe('canonical');
    expect(tierForPath('community/a.md')).toBe('community');
    expect(tierForPath('local/a.md')).toBeNull();
  });

  it('reads docs, skips INDEX.md and unknown folders, sorts by path', () => {
    const dir = knowledge({ ...FIXTURE, 'local/noise.md': '# ruído\n', 'core/notes.txt': 'x' });
    const snap = readSnapshot(dir);
    expect(snap.docs.map((d) => d.path)).toEqual([
      'community/2026-10-01-class-var-dica.md',
      'core/class-var.md',
      'core/encoding.md',
      'core/firedac.md',
      'fmx/modal.md',
      'fmx/ontap.md',
    ]);
  });

  it('falls back to H1 for title and folder for category', () => {
    const snap = readSnapshot(knowledge(FIXTURE));
    const core = snap.docs.find((d) => d.path === 'core/encoding.md')!;
    const fmx = snap.docs.find((d) => d.path === 'fmx/modal.md')!;
    const community = snap.docs.find((d) => d.path.startsWith('community/'))!;
    expect(core).toMatchObject({ tier: 'canonical', title: 'Encoding UTF-8 com BOM', category: 'general', tags: '' });
    expect(fmx.category).toBe('fmx');
    expect(community).toMatchObject({ tier: 'community', title: 'Dica sobre class var e E2356', category: 'bugs' });
    expect(community.body.startsWith('# Dica')).toBe(true);
  });

  it('parses frontmatter written with BOM and CRLF, hashing the raw bytes', () => {
    const raw = '﻿---\r\ntitle: "Com BOM"\r\ncategory: bugs\r\n---\r\n# H1\r\n\r\ncorpo\r\n';
    const dir = knowledge({ 'community/bom.md': raw });
    const doc = readSnapshot(dir).docs[0];
    expect(doc.title).toBe('Com BOM');
    expect(doc.category).toBe('bugs');
    expect(doc.sha256).toBe(sha256(Buffer.from(raw, 'utf8')));
    expect(doc.bytes).toBe(Buffer.byteLength(raw, 'utf8'));
    expect(parseFrontmatter('sem frontmatter').frontmatter).toEqual({});
  });

  it('has an id that depends on content only', () => {
    const a = readSnapshot(knowledge(FIXTURE));
    const b = readSnapshot(knowledge(FIXTURE));
    expect(a.id).toBe(b.id);
    const changedDir = knowledge(FIXTURE);
    fs.appendFileSync(path.join(changedDir, 'core', 'encoding.md'), 'mais\n');
    expect(readSnapshot(changedDir).id).not.toBe(a.id);
    expect(snapshotId([{ path: 'b', sha256: '2' }, { path: 'a', sha256: '1' }]))
      .toBe(snapshotId([{ path: 'a', sha256: '1' }, { path: 'b', sha256: '2' }]));
  });

  it('returns an empty snapshot for a missing folder', () => {
    expect(readSnapshot(path.join(tmpDir(), 'nope')).docs).toEqual([]);
  });
});
