import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { KB_DIRS } from './paths';

export type Tier = 'canonical' | 'community';

export interface KbDoc {
  path: string;
  tier: Tier;
  title: string;
  category: string;
  tags: string;
  body: string;
  sha256: string;
  bytes: number;
  frontmatter: Record<string, string>;
}

export interface Snapshot {
  root: string;
  docs: KbDoc[];
  id: string;
}

export function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: text };
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) frontmatter[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { frontmatter, body: match[2] };
}

export function tierForPath(rel: string): Tier | null {
  const first = rel.split('/')[0];
  if (first === 'core' || first === 'fmx') return 'canonical';
  if (first === 'community') return 'community';
  return null;
}

export function snapshotId(files: { path: string; sha256: string }[]): string {
  return sha256(files.map((f) => `${f.path}:${f.sha256}`).sort().join('\n'));
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'INDEX.md') out.push(full);
  }
  return out;
}

export function readSnapshot(root: string): Snapshot {
  const docs: KbDoc[] = [];
  for (const top of KB_DIRS) {
    for (const file of walk(path.join(root, top))) {
      const rel = path.relative(root, file).split(path.sep).join('/');
      const tier = tierForPath(rel);
      if (!tier) continue;
      const buf = fs.readFileSync(file);
      const { frontmatter, body } = parseFrontmatter(buf.toString('utf8'));
      const h1 = body.match(/^#\s+(.+)$/m);
      docs.push({
        path: rel,
        tier,
        title: frontmatter.title || (h1 ? h1[1].trim() : path.basename(file, '.md')),
        category: frontmatter.category || (top === 'fmx' ? 'fmx' : 'general'),
        tags: frontmatter.tags || '',
        body,
        sha256: sha256(buf),
        bytes: buf.length,
        frontmatter,
      });
    }
  }
  docs.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { root, docs, id: snapshotId(docs) };
}
