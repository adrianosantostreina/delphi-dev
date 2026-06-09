-- schema.sql
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS knowledge (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  path        TEXT    NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  content     TEXT    NOT NULL,
  category    TEXT    NOT NULL CHECK(category IN ('bugs','architecture','patterns','failures','general')),
  agent       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vec USING vec0(
  embedding float[384]
);

CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_agent ON knowledge(agent);
CREATE INDEX IF NOT EXISTS idx_knowledge_path ON knowledge(path);
