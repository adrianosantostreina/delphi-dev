import { openDatabase } from './index';
import type { Tier } from './snapshot';

export interface Hit {
  path: string;
  tier: Tier;
  category: string;
  title: string;
  heading: string;
  snippet: string;
  score: number;
}

export interface SearchOptions {
  limit?: number;
  tier?: Tier;
  minScore?: number;
}

// Calibrated on 2026-10-15 against knowledge/ (115 docs): see docs/rag-governance.md.
export const MIN_SCORE = 7.5;
export const STRONG_SCORE = 9.5;
export const SNIPPET_MAX = 400;
const MAX_TERMS = 12;

const STOPWORDS = new Set([
  'como', 'para', 'por', 'que', 'com', 'uma', 'dos', 'das', 'nos', 'nas', 'nao', 'mais', 'isso', 'esse',
  'essa', 'este', 'esta', 'qual', 'quando', 'onde', 'meu', 'minha', 'seu', 'sua', 'pelo', 'pela', 'ser',
  'tem', 'ter', 'faz', 'fazer', 'sobre', 'entre', 'depois', 'antes', 'ainda', 'tambem', 'muito', 'porque',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'what', 'how', 'why', 'when', 'where', 'not', 'are',
  'was', 'into', 'your', 'you', 'can', 'does', 'have', 'has', 'but', 'use', 'using',
]);
const COMPILER_CODE = /^[efwh]\d{4}$/;

/** Every term is a quoted bareword, so FTS5 operators and SQL in the prompt are inert. */
export function buildMatchQuery(text: string): string | null {
  const folded = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const picked: string[] = [];
  for (const token of folded.match(/[\p{L}\p{N}_]+/gu) ?? []) {
    if (picked.length >= MAX_TERMS) break;
    if (picked.includes(token) || STOPWORDS.has(token)) continue;
    if (token.length < 3 && !COMPILER_CODE.test(token)) continue;
    picked.push(token);
  }
  return picked.length ? picked.map((t) => `"${t}"`).join(' OR ') : null;
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

export function searchIndex(dbPath: string, text: string, opts: SearchOptions = {}): Hit[] {
  const query = buildMatchQuery(text);
  if (!query) return [];
  const limit = Math.min(Math.max(opts.limit ?? 3, 1), 5);
  const minScore = opts.minScore ?? MIN_SCORE;
  const db = openDatabase(dbPath, true);
  let rows: Hit[];
  try {
    rows = db.prepare(`
      SELECT path, tier, category, title, heading,
             snippet(sections, 2, '', '', '…', 48) AS snippet,
             -bm25(sections, 5.0, 3.0, 1.0, 4.0, 0.0, 0.0, 0.0) AS score
      FROM sections WHERE sections MATCH ? ORDER BY score DESC LIMIT 50
    `).all(query) as unknown as Hit[];
  } finally {
    db.close();
  }
  const seen = new Set<string>();
  const best = rows.filter((r) => {
    if (r.score < minScore || (opts.tier && r.tier !== opts.tier) || seen.has(r.path)) return false;
    seen.add(r.path);
    return true;
  });
  const ordered = [...best.filter((r) => r.tier === 'canonical'), ...best.filter((r) => r.tier === 'community')];
  return ordered.slice(0, limit).map((r) => ({ ...r, snippet: truncate(r.snippet, SNIPPET_MAX) }));
}

export const PRECEDENCE =
  'Canonical prevalece sobre community; community só complementa. Para o arquivo inteiro, use a ferramenta kb_get com o path.';

export function formatInjection(hits: Hit[]): string {
  if (!hits.length) return '';
  const body = hits
    .map((h) => `[${h.tier}/${h.category}] ${h.path} — ${h.title}${h.heading ? ` › ${h.heading}` : ''}\n${h.snippet}`)
    .join('\n\n');
  return `[DELPHI-DEV KNOWLEDGE]\n(${PRECEDENCE})\n\n${body}\n[/DELPHI-DEV KNOWLEDGE]`;
}
