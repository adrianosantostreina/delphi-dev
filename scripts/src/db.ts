import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as sqliteVec from 'sqlite-vec';

export interface KnowledgeChunk {
  path: string;
  chunkIndex: number;
  content: string;
  embedding: Float32Array;
  category: 'bugs' | 'architecture' | 'patterns' | 'failures' | 'general';
  agent: string | null;
}

export interface SearchResult {
  content: string;
  category: string;
  path: string;
  distance: number;
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
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vec USING vec0(embedding float[384]);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);
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
    `INSERT INTO knowledge (path, chunk_index, content, category, agent) VALUES (?, ?, ?, ?, ?)`
  );
  const insertVec = db.prepare(`INSERT INTO knowledge_vec (rowid, embedding) VALUES (?, ?)`);
  const transaction = db.transaction((c: KnowledgeChunk) => {
    const result = insertKnowledge.run(c.path, c.chunkIndex, c.content, c.category, c.agent);
    // sqlite-vec requires the rowid bound as a strict integer (BigInt). A plain
    // number is rejected with "Only integers are allowed for primary key values".
    insertVec.run(BigInt(result.lastInsertRowid), Buffer.from(c.embedding.buffer));
  });
  transaction(chunk);
}

export function countChunks(db: Database.Database): number {
  return (db.prepare('SELECT COUNT(*) as n FROM knowledge').get() as { n: number }).n;
}

export function clearDb(db: Database.Database): void {
  db.exec('DELETE FROM knowledge; DELETE FROM knowledge_vec;');
}

export function searchSimilar(
  db: Database.Database,
  queryEmbedding: Float32Array,
  topK: number = 3,
  agentFilter?: string
): SearchResult[] {
  const vecBytes = Buffer.from(queryEmbedding.buffer);
  // The LIMIT must sit on the vec0 KNN scan itself, so the nearest-neighbour
  // search runs inside a CTE; the metadata join happens afterwards.
  const base = db.prepare(`
    WITH matches AS (
      SELECT rowid, distance
      FROM knowledge_vec
      WHERE embedding MATCH ?
      ORDER BY distance
      LIMIT ?
    )
    SELECT k.content, k.category, k.path, m.distance
    FROM matches m
    JOIN knowledge k ON k.id = m.rowid
    ORDER BY m.distance
  `);
  // Agent-scoped search: pull a wider candidate pool from the vec0 scan, then
  // filter by agent in the outer query (agent lives on the metadata table).
  const withAgent = db.prepare(`
    WITH matches AS (
      SELECT rowid, distance
      FROM knowledge_vec
      WHERE embedding MATCH ?
      ORDER BY distance
      LIMIT ?
    )
    SELECT k.content, k.category, k.path, m.distance
    FROM matches m
    JOIN knowledge k ON k.id = m.rowid
    WHERE k.agent = ?
    ORDER BY m.distance
    LIMIT ?
  `);
  if (agentFilter) {
    const pool = Math.max(topK * 4, 12);
    const agentResults = withAgent.all(vecBytes, pool, agentFilter, Math.ceil(topK / 2)) as SearchResult[];
    const globalResults = base.all(vecBytes, topK) as SearchResult[];
    const seen = new Set(agentResults.map((r) => r.path + r.content));
    const merged = [...agentResults, ...globalResults.filter((r) => !seen.has(r.path + r.content))];
    return merged.slice(0, topK);
  }
  return base.all(vecBytes, topK) as SearchResult[];
}
