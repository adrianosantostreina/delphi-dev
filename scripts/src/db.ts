import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as sqliteVec from 'sqlite-vec';

// Max L2 distance for a canonical chunk to win a retrieval slot. Embeddings are
// normalized, so L2 distance ranges 0 (identical) .. ~2 (opposite). Calibrable.
export const RELEVANCE_FLOOR = 1.0;

// Absolute cutoff: a chunk farther than this is dropped outright, even when it
// would otherwise fill a slot. Without it the search can never return empty and
// every prompt gets three chunks, relevant or not. Slightly above
// RELEVANCE_FLOOR so a marginally-weak canonical can still serve as fallback.
// NOT yet calibrated against a real-world corpus — override per install.
export const DEFAULT_MAX_DISTANCE = Number(process.env.DELPHI_RAG_MAX_DISTANCE ?? 1.1);

// Trust tiers, most authoritative first. 'local' is captured from the user's own
// sessions: it passed no review gate at all, so it must never outrank curated
// content. Writers MUST pass it explicitly — see embedFile.
export type Tier = 'canonical' | 'community' | 'local';

export interface KnowledgeChunk {
  path: string;
  chunkIndex: number;
  content: string;
  embedding: Float32Array;
  category: 'bugs' | 'architecture' | 'patterns' | 'failures' | 'general';
  agent: string | null;
  tier: Tier;
}

export interface SearchResult {
  content: string;
  category: string;
  path: string;
  distance: number;
  tier: string;
}

const SCHEMA = `
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS knowledge (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  path        TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content     TEXT NOT NULL,
  category    TEXT NOT NULL,
  agent       TEXT,
  tier        TEXT NOT NULL DEFAULT 'canonical',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vec USING vec0(embedding float[384]);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_tier ON knowledge(tier);
`;

export function openDb(dbPath: string): Database.Database {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  // sqlite-vec must be loaded BEFORE creating the vec0 virtual table.
  sqliteVec.load(db);
  db.exec(SCHEMA);
  return db;
}

export function insertChunk(db: Database.Database, chunk: KnowledgeChunk): void {
  const insertKnowledge = db.prepare(
    `INSERT INTO knowledge (path, chunk_index, content, category, agent, tier) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertVec = db.prepare(`INSERT INTO knowledge_vec (rowid, embedding) VALUES (?, ?)`);
  const transaction = db.transaction((c: KnowledgeChunk) => {
    const result = insertKnowledge.run(c.path, c.chunkIndex, c.content, c.category, c.agent, c.tier);
    // sqlite-vec requires the rowid bound as a strict integer (BigInt). A plain
    // number is rejected with "Only integers are allowed for primary key values".
    insertVec.run(BigInt(result.lastInsertRowid), Buffer.from(c.embedding.buffer));
  });
  transaction(chunk);
}

export function countChunks(db: Database.Database): number {
  return (db.prepare('SELECT COUNT(*) as n FROM knowledge').get() as { n: number }).n;
}

export function countByTier(db: Database.Database, tier: string): number {
  return (db.prepare('SELECT COUNT(*) as n FROM knowledge WHERE tier = ?').get(tier) as { n: number }).n;
}

export function clearDb(db: Database.Database): void {
  db.exec('DELETE FROM knowledge; DELETE FROM knowledge_vec;');
}

// Slot-precedence selection: relevant canonical (distance <= floor) claims slots
// first, then community, then local (unreviewed session capture). Above-floor
// canonical stays the last fallback. Ordering alone never drops anything —
// applyDistanceCutoff does that.
export function selectByTier(
  canonical: SearchResult[],
  community: SearchResult[],
  local: SearchResult[],
  topK: number,
  relevanceFloor: number
): SearchResult[] {
  const out: SearchResult[] = [];
  const relevantCanonical = canonical.filter((r) => r.distance <= relevanceFloor);
  const weakCanonical = canonical.filter((r) => r.distance > relevanceFloor);

  for (const group of [relevantCanonical, community, local, weakCanonical]) {
    for (const r of group) {
      if (out.length >= topK) break;
      out.push(r);
    }
  }
  return out.slice(0, topK);
}

// Absolute relevance gate. Returning an empty list is a valid, desirable outcome:
// formatSearchResults yields '' for it and the hook then injects nothing.
export function applyDistanceCutoff(results: SearchResult[], maxDistance: number): SearchResult[] {
  return results.filter((r) => r.distance <= maxDistance);
}

export interface RagHealth {
  total: number;
  canonical: number;
  community: number;
  local: number;
  /** No curated content at all — the install never received a built rag.db. */
  curatedMissing: boolean;
}

export function ragHealth(db: Database.Database): RagHealth {
  const canonical = countByTier(db, 'canonical');
  const community = countByTier(db, 'community');
  const local = countByTier(db, 'local');
  return {
    total: countChunks(db),
    canonical,
    community,
    local,
    curatedMissing: canonical === 0,
  };
}

export function searchSimilar(
  db: Database.Database,
  queryEmbedding: Float32Array,
  topK: number = 3,
  agentFilter?: string,
  maxDistance: number = DEFAULT_MAX_DISTANCE
): SearchResult[] {
  const vecBytes = Buffer.from(queryEmbedding.buffer);
  // Pull a wide candidate pool so tier partitioning has enough to choose from.
  const pool = Math.max(topK * 6, 24);
  const poolQuery = db.prepare(`
    WITH matches AS (
      SELECT rowid, distance
      FROM knowledge_vec
      WHERE embedding MATCH ?
      ORDER BY distance
      LIMIT ?
    )
    SELECT k.content, k.category, k.path, k.tier, k.agent, m.distance
    FROM matches m
    JOIN knowledge k ON k.id = m.rowid
    ORDER BY m.distance
  `);
  const rows = poolQuery.all(vecBytes, pool) as Array<SearchResult & { agent: string | null }>;

  // Agent-scoped memory floats matching chunks to the front of their own tier,
  // without overriding tier precedence.
  const ordered = agentFilter
    ? [...rows].sort((a, b) => Number(b.agent === agentFilter) - Number(a.agent === agentFilter))
    : rows;

  const canonical = ordered.filter((r) => r.tier === 'canonical');
  const community = ordered.filter((r) => r.tier === 'community');
  const local = ordered.filter((r) => r.tier === 'local');
  const selected = selectByTier(canonical, community, local, topK, RELEVANCE_FLOOR);
  return applyDistanceCutoff(selected, maxDistance).map(
    ({ content, category, path, distance, tier }) => ({ content, category, path, distance, tier })
  );
}
