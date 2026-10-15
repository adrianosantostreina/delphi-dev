import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'node:path';
import { ensureIndex } from '../src/index';
import { readSnapshot } from '../src/snapshot';
import { buildMatchQuery, formatInjection, searchIndex, SNIPPET_MAX, type Hit } from '../src/search';
import { FIXTURE, tmpDir, writeTree } from './helpers';

let dbPath: string;

beforeAll(() => {
  const dir = tmpDir('kb-knowledge-');
  writeTree(dir, { ...FIXTURE, 'core/longo.md': `# Longo\n\n## Parte\n${'palavra '.repeat(300)}firebird\n` });
  dbPath = ensureIndex(readSnapshot(dir), path.join(tmpDir(), 'kb.db'));
});

describe('buildMatchQuery', () => {
  it('folds diacritics, drops stopwords and short tokens, keeps compiler codes', () => {
    expect(buildMatchQuery('Como resolver a Conexão com o E2356?')).toBe('"resolver" OR "conexao" OR "e2356"');
  });

  it('returns null when nothing is searchable', () => {
    expect(buildMatchQuery('o que é isso?')).toBeNull();
    expect(buildMatchQuery('')).toBeNull();
  });

  it('caps the query at 12 distinct terms', () => {
    const q = buildMatchQuery(Array.from({ length: 30 }, (_, i) => `termo${i}`).join(' '))!;
    expect(q.split(' OR ')).toHaveLength(12);
  });
});

describe('searchIndex', () => {
  it('finds a document ignoring accents', () => {
    const hits = searchIndex(dbPath, 'conexao mojibake', { minScore: 0 });
    expect(hits[0].path).toBe('core/encoding.md');
  });

  it('puts canonical before community even when community scores higher', () => {
    const hits = searchIndex(dbPath, 'class var E2356 instance field', { minScore: 0, limit: 5 });
    const tiers = hits.map((h) => h.tier);
    expect(tiers).toContain('community');
    expect(tiers.indexOf('canonical')).toBeLessThan(tiers.indexOf('community'));
  });

  it('returns one hit per document', () => {
    const hits = searchIndex(dbPath, 'E2356 class var', { minScore: 0, limit: 5 });
    expect(new Set(hits.map((h) => h.path)).size).toBe(hits.length);
  });

  it('filters by tier, minScore and clamps limit to 1..5', () => {
    expect(searchIndex(dbPath, 'E2356', { minScore: 0, tier: 'community' }).every((h) => h.tier === 'community')).toBe(true);
    expect(searchIndex(dbPath, 'E2356', { minScore: 1e9 })).toEqual([]);
    expect(searchIndex(dbPath, 'firebird mrcancel ontap e2356 bom', { minScore: 0, limit: 50 }).length).toBeLessThanOrEqual(5);
    expect(searchIndex(dbPath, 'firebird', { minScore: 0, limit: 0 })).toHaveLength(1);
  });

  it('limits snippets to SNIPPET_MAX characters', () => {
    const hits = searchIndex(dbPath, 'firebird palavra', { minScore: 0, limit: 5 });
    expect(hits.every((h) => h.snippet.length <= SNIPPET_MAX)).toBe(true);
  });

  // Review Focus 2: FTS5 syntax in the prompt must never throw.
  it.each([
    'NEAR(a b) AND OR NOT *',
    '"; DROP TABLE sections; --',
    'campo-com-hifen (parenteses) "aspas" ^ :col',
  ])('does not throw on %s', (prompt) => {
    expect(() => searchIndex(dbPath, prompt, { minScore: 0 })).not.toThrow();
  });
});

describe('formatInjection', () => {
  it('returns empty text for no hits', () => {
    expect(formatInjection([])).toBe('');
  });

  it('labels each hit with tier, category and path', () => {
    const hit: Hit = {
      path: 'core/a.md', tier: 'canonical', category: 'general', title: 'T', heading: 'H', snippet: 'trecho', score: 3,
    };
    const text = formatInjection([hit]);
    expect(text).toContain('[DELPHI-DEV KNOWLEDGE]');
    expect(text).toContain('[canonical/general] core/a.md — T › H\ntrecho');
    expect(text).toContain('kb_get');
    expect(text.endsWith('[/DELPHI-DEV KNOWLEDGE]')).toBe(true);
  });

  it('marks only hits below lowConfidenceBelow and leaves the default output unchanged', () => {
    const mk = (path: string, score: number): Hit => ({
      path, tier: 'canonical', category: 'general', title: 'T', heading: 'H', snippet: 'trecho', score,
    });
    const hits = [mk('core/forte.md', 8), mk('core/fraco.md', 3)];
    const marked = formatInjection(hits, { lowConfidenceBelow: 5 });
    expect(marked).toContain('[canonical/general] core/forte.md — T › H\ntrecho');
    expect(marked).toContain('[canonical/general] core/fraco.md — T › H (baixa confiança)\ntrecho');
    expect(marked.match(/baixa confiança/g)).toHaveLength(1);
    expect(formatInjection(hits)).not.toContain('baixa confiança');
    expect(formatInjection(hits, {})).toBe(formatInjection(hits));
  });
});
