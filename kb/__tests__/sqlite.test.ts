import { it, expect } from 'vitest';
import { createRequire } from 'node:module';

it('vitest loads node:sqlite with FTS5 and diacritic folding', () => {
  const requireCjs = createRequire(import.meta.url);
  const { DatabaseSync } = requireCjs('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE VIRTUAL TABLE t USING fts5(body, tokenize = 'unicode61 remove_diacritics 2')");
  db.prepare('INSERT INTO t VALUES (?)').run('Conexão por requisição');
  const rows = db.prepare('SELECT body FROM t WHERE t MATCH ?').all('"conexao"');
  db.close();
  expect(rows).toHaveLength(1);
});
