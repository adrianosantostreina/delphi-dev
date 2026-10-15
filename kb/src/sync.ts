import * as fs from 'node:fs';
import * as path from 'node:path';
import { sha256 } from './snapshot';

export type SyncAction = 'new' | 'same' | 'changed' | 'conflict' | 'plugin-only';
type Dest = 'core' | 'fmx';

export interface SyncItem {
  name: string;
  dest: Dest;
  action: SyncAction;
}

export type SyncState = Record<string, { dest: Dest; sha256: string }>;

export const EXCLUDED = /^(INDEX|CLAUDE|AGENTS(\.[\w-]+)?)\.md$/i;
export const STATE_FILE = '.sync-state.json';
const IMPORT_HEADING = '## Importados via /sync-kb';

function firstH1(content: string): string {
  return content.replace(/^\uFEFF/, '').match(/^#\s+(.+)$/m)?.[1]?.trim() ?? '';
}

/** Line-ending-insensitive bytes: a CRLF checkout (core.autocrlf) must compare equal to the LF index. */
export function normalizeEol(data: Buffer): Buffer {
  return Buffer.from(data.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
}

export function classifyDest(name: string, content: string): Dest {
  return /^fmx-/i.test(name) || /\bFMX\b|FireMonkey/i.test(firstH1(content)) ? 'fmx' : 'core';
}

export function readSyncState(knowledgeDir: string): SyncState {
  try {
    return JSON.parse(fs.readFileSync(path.join(knowledgeDir, STATE_FILE), 'utf8'));
  } catch {
    return {};
  }
}

function sourceFiles(sourceDir: string): string[] {
  return fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md') && !EXCLUDED.test(e.name))
    .map((e) => e.name)
    .sort();
}

function pluginFiles(knowledgeDir: string, dest: Dest): string[] {
  const dir = path.join(knowledgeDir, dest);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => n.endsWith('.md') && n !== 'INDEX.md');
}

export function planSync(sourceDir: string, knowledgeDir: string, state: SyncState): SyncItem[] {
  const items: SyncItem[] = [];
  const names = sourceFiles(sourceDir);
  for (const name of names) {
    const sourceBytes = normalizeEol(fs.readFileSync(path.join(sourceDir, name)));
    const existing = (['core', 'fmx'] as Dest[]).find((d) => fs.existsSync(path.join(knowledgeDir, d, name)));
    const dest = existing ?? state[name]?.dest ?? classifyDest(name, sourceBytes.toString('utf8'));
    if (!existing) {
      items.push({ name, dest, action: 'new' });
      continue;
    }
    const destHash = sha256(normalizeEol(fs.readFileSync(path.join(knowledgeDir, dest, name))));
    const sourceHash = sha256(sourceBytes);
    const action: SyncAction =
      destHash === sourceHash ? 'same' : state[name]?.sha256 === destHash ? 'changed' : 'conflict';
    items.push({ name, dest, action });
  }
  const known = new Set(names);
  for (const dest of ['core', 'fmx'] as Dest[]) {
    for (const name of pluginFiles(knowledgeDir, dest)) {
      if (!known.has(name)) items.push({ name, dest, action: 'plugin-only' });
    }
  }
  return items;
}

function appendToIndex(knowledgeDir: string, dest: Dest, lines: string[]): void {
  if (!lines.length) return;
  const file = path.join(knowledgeDir, dest, 'INDEX.md');
  let content = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : `# ${dest}\n`;
  if (!content.includes(IMPORT_HEADING)) content = `${content.replace(/\s*$/, '')}\n\n${IMPORT_HEADING}\n`;
  fs.writeFileSync(file, `${content.replace(/\s*$/, '')}\n${lines.join('\n')}\n`);
}

export function applySync(items: SyncItem[], sourceDir: string, knowledgeDir: string, state: SyncState): SyncState {
  const next: SyncState = { ...state };
  const indexLines: Record<Dest, string[]> = { core: [], fmx: [] };
  for (const item of items) {
    if (item.action === 'conflict' || item.action === 'plugin-only') continue;
    const bytes = normalizeEol(fs.readFileSync(path.join(sourceDir, item.name)));
    if (item.action === 'new' || item.action === 'changed') {
      fs.mkdirSync(path.join(knowledgeDir, item.dest), { recursive: true });
      fs.writeFileSync(path.join(knowledgeDir, item.dest, item.name), bytes);
    }
    if (item.action === 'new') {
      indexLines[item.dest].push(`- [${item.name}](${item.name}) \u2014 ${firstH1(bytes.toString('utf8')) || item.name}`);
    }
    next[item.name] = { dest: item.dest, sha256: sha256(bytes) };
  }
  appendToIndex(knowledgeDir, 'core', indexLines.core);
  appendToIndex(knowledgeDir, 'fmx', indexLines.fmx);
  fs.writeFileSync(path.join(knowledgeDir, STATE_FILE), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
