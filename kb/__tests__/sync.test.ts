import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { applySync, classifyDest, planSync, readSyncState, STATE_FILE } from '../src/sync';
import { sha256 } from '../src/snapshot';
import { tmpDir, writeTree } from './helpers';

function setup() {
  const source = tmpDir('kb-shared-');
  const knowledge = tmpDir('kb-knowledge-');
  writeTree(source, {
    'novo-core.md': '# Novo geral\n',
    'fmx-novo.md': '# Algo\n',
    'tema-firemonkey.md': '# Dica de FireMonkey\n',
    'igual.md': '# Igual\n',
    'mudou.md': '# Mudou v2\n',
    'conflito.md': '# Conflito origem\n',
    'ja-em-fmx.md': '# Sem marca\n',
    'INDEX.md': '# índice',
    'AGENTS.md': 'x', 'AGENTS.pt-BR.md': 'x', 'CLAUDE.md': 'x', 'notas.txt': 'x',
  });
  writeTree(knowledge, {
    'core/INDEX.md': '# Core\n',
    'fmx/INDEX.md': '# FMX\n',
    'core/igual.md': '# Igual\n',
    'core/mudou.md': '# Mudou v1\n',
    'core/conflito.md': '# Conflito editado no plugin\n',
    'fmx/ja-em-fmx.md': '# Sem marca\n',
    'core/so-no-plugin.md': '# Só aqui\n',
  });
  const state = { 'mudou.md': { dest: 'core' as const, sha256: sha256('# Mudou v1\n') } };
  return { source, knowledge, state };
}

describe('classifyDest', () => {
  it('sends fmx- names and FireMonkey titles to fmx', () => {
    expect(classifyDest('fmx-x.md', '# t')).toBe('fmx');
    expect(classifyDest('x.md', '# [FMX] t')).toBe('fmx');
    expect(classifyDest('x.md', '# Dica de FireMonkey')).toBe('fmx');
    expect(classifyDest('x.md', '# Horse e JWT')).toBe('core');
  });
});

describe('planSync', () => {
  it('classifies every file and excludes non-knowledge files', () => {
    const { source, knowledge, state } = setup();
    const plan = Object.fromEntries(planSync(source, knowledge, state).map((i) => [i.name, `${i.dest}:${i.action}`]));
    expect(plan).toEqual({
      'novo-core.md': 'core:new',
      'fmx-novo.md': 'fmx:new',
      'tema-firemonkey.md': 'fmx:new',
      'igual.md': 'core:same',
      'mudou.md': 'core:changed',
      'conflito.md': 'core:conflict',
      'ja-em-fmx.md': 'fmx:same',
      'so-no-plugin.md': 'core:plugin-only',
    });
  });
});

describe('applySync', () => {
  it('copies new and changed files byte for byte, indexes new ones and never touches conflicts', () => {
    const { source, knowledge, state } = setup();
    const next = applySync(planSync(source, knowledge, state), source, knowledge, state);

    expect(fs.readFileSync(path.join(knowledge, 'core', 'novo-core.md'), 'utf8')).toBe('# Novo geral\n');
    expect(fs.readFileSync(path.join(knowledge, 'fmx', 'fmx-novo.md'), 'utf8')).toBe('# Algo\n');
    expect(fs.readFileSync(path.join(knowledge, 'core', 'mudou.md'), 'utf8')).toBe('# Mudou v2\n');
    expect(fs.readFileSync(path.join(knowledge, 'core', 'conflito.md'), 'utf8')).toBe('# Conflito editado no plugin\n');

    const coreIndex = fs.readFileSync(path.join(knowledge, 'core', 'INDEX.md'), 'utf8');
    expect(coreIndex).toContain('## Importados via /sync-kb');
    expect(coreIndex).toContain('- [novo-core.md](novo-core.md) — Novo geral');
    expect(coreIndex).not.toContain('mudou.md');

    expect(next['novo-core.md']).toEqual({ dest: 'core', sha256: sha256('# Novo geral\n') });
    expect(next['mudou.md'].sha256).toBe(sha256('# Mudou v2\n'));
    expect(next['igual.md']).toBeDefined();
    expect(next['conflito.md']).toBeUndefined();
    expect(readSyncState(knowledge)).toEqual(next);
    expect(fs.existsSync(path.join(knowledge, STATE_FILE))).toBe(true);
  });

  it('is idempotent', () => {
    const { source, knowledge, state } = setup();
    const first = applySync(planSync(source, knowledge, state), source, knowledge, state);
    const again = planSync(source, knowledge, first);
    expect(again.filter((i) => i.action === 'new' || i.action === 'changed')).toEqual([]);
  });
});

describe('sync line endings', () => {
  it('treats a CRLF source and an LF destination with the same text as same', () => {
    const source = tmpDir('kb-shared-');
    const knowledge = tmpDir('kb-knowledge-');
    writeTree(source, { 'a.md': '# A\r\nlinha\r\n' });
    writeTree(knowledge, { 'core/a.md': '# A\nlinha\n' });
    expect(planSync(source, knowledge, {}).map((i) => i.action)).toEqual(['same']);
  });

  it('treats a CRLF destination and an LF source as same, and changed when only the source moved', () => {
    const source = tmpDir('kb-shared-');
    const knowledge = tmpDir('kb-knowledge-');
    writeTree(source, { 'a.md': '# A\nlinha\n', 'b.md': '# B v2\n' });
    writeTree(knowledge, { 'core/a.md': '# A\r\nlinha\r\n', 'core/b.md': '# B v1\r\n' });
    const state = { 'b.md': { dest: 'core' as const, sha256: sha256('# B v1\n') } };
    const plan = Object.fromEntries(planSync(source, knowledge, state).map((i) => [i.name, i.action]));
    expect(plan).toEqual({ 'a.md': 'same', 'b.md': 'changed' });
  });

  it('copies a CRLF source as LF and stores the normalised hash', () => {
    const source = tmpDir('kb-shared-');
    const knowledge = tmpDir('kb-knowledge-');
    writeTree(source, { 'a.md': '# A\r\nlinha\r\n' });
    writeTree(knowledge, { 'core/INDEX.md': '# Core\n' });
    const items = planSync(source, knowledge, {});
    const next = applySync(items, source, knowledge, {});
    expect(fs.readFileSync(path.join(knowledge, 'core', 'a.md'), 'utf8')).toBe('# A\nlinha\n');
    expect(next['a.md'].sha256).toBe(sha256('# A\nlinha\n'));
  });
});
