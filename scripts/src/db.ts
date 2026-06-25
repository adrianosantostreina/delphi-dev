import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as sqliteVec from 'sqlite-vec';

// Max L2 distance for a canonical chunk to win a retrieval slot. Embeddings are
// normalized, so L2 distance ranges 0 (identical) .. ~2 (opposite). Calibrable.
export const RELEVANCE_FLOOR = 1.0;

export interface KnowledgeChunk {
  path: string;
  chunkIndex: number;
  content: string;
  embedding: Float32Array;
  category: 'bugs' | 'architecture' | 'patterns' | 'failures' | 'general';
  agent: string | null;
  tier: 'canonical' | 'community';
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
// first; community fills only the leftovers; above-floor canonical is the last
// fallback so we never return fewer results than available.
export function selectByTier(
  canonical: SearchResult[],
  community: SearchResult[],
  topK: number,
  relevanceFloor: number
): SearchResult[] {
  const out: SearchResult[] = [];
  const relevantCanonical = canonical.filter((r) => r.distance <= relevanceFloor);
  const weakCanonical = canonical.filter((r) => r.distance > relevanceFloor);

  for (const r of relevantCanonical) {
    if (out.length >= topK) break;
    out.push(r);
  }
  for (const r of community) {
    if (out.length >= topK) break;
    out.push(r);
  }
  for (const r of weakCanonical) {
    if (out.length >= topK) break;
    out.push(r);
  }
  return out.slice(0, topK);
}

export function searchSimilar(
  db: Database.Database,
  queryEmbedding: Float32Array,
  topK: number = 3,
  agentFilter?: string
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
  return selectByTier(canonical, community, topK, RELEVANCE_FLOOR).map(
    ({ content, category, path, distance, tier }) => ({ content, category, path, distance, tier })
  );
}
