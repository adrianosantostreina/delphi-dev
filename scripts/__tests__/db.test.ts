import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { openDb, insertChunk, countChunks, clearDb, searchSimilar, selectByTier, RELEVANCE_FLOOR, type KnowledgeChunk, type SearchResult } from '../src/db';

// Unique DB path per test avoids EBUSY races on Windows, where WAL -shm/-wal
// files can linger briefly after close() and block the next test's cleanup.
let counter = 0;
let TEST_DB = '';

function cleanup() {
  for (const suffix of ['', '-shm', '-wal']) {
    const f = TEST_DB + suffix;
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch {
      // Windows may still hold the WAL handle; ignore — temp files get reaped.
    }
  }
}

beforeEach(() => {
  TEST_DB = path.join(os.tmpdir(), `test-rag-${process.pid}-${counter++}.db`);
  cleanup();
});
afterEach(cleanup);

describe('db operations', () => {
  it('opens and initializes an empty database', () => {
    const db = openDb(TEST_DB);
    expect(countChunks(db)).toBe(0);
    db.close();
  });

  it('inserts a chunk and increments count', () => {
    const db = openDb(TEST_DB);
    const chunk: KnowledgeChunk = {
      path: 'knowledge/core/test.md',
      chunkIndex: 0,
      content: 'FireDAC requires explicit driver registration',
      embedding: new Float32Array(384).fill(0.1),
      category: 'patterns',
      agent: 'delphi-writer',
      tier: 'canonical',
    };
    insertChunk(db, chunk);
    expect(countChunks(db)).toBe(1);
    db.close();
  });

  it('clearDb removes all chunks', () => {
    const db = openDb(TEST_DB);
    const chunk: KnowledgeChunk = {
      path: 'test.md', chunkIndex: 0, content: 'x',
      embedding: new Float32Array(384), category: 'general', agent: null,
      tier: 'canonical',
    };
    insertChunk(db, chunk);
    clearDb(db);
    expect(countChunks(db)).toBe(0);
    db.close();
  });

  it('searchSimilar returns the nearest chunk', () => {
    const db = openDb(TEST_DB);
    insertChunk(db, {
      path: 'a.md', chunkIndex: 0, content: 'near',
      embedding: new Float32Array(384).fill(0.5), category: 'patterns', agent: null,
      tier: 'canonical',
    });
    insertChunk(db, {
      path: 'b.md', chunkIndex: 0, content: 'far',
      embedding: new Float32Array(384).fill(-0.5), category: 'bugs', agent: null,
      tier: 'canonical',
    });
    const results = searchSimilar(db, new Float32Array(384).fill(0.5), 1);
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('near');
    db.close();
  });

  it('persists and returns the tier of a chunk', () => {
    const db = openDb(TEST_DB);
    insertChunk(db, {
      path: 'knowledge/community/x.md', chunkIndex: 0, content: 'community note',
      embedding: new Float32Array(384).fill(0.5), category: 'general', agent: null,
      tier: 'community',
    });
    const results = searchSimilar(db, new Float32Array(384).fill(0.5), 1);
    expect(results[0].tier).toBe('community');
    db.close();
  });
});

function res(tier: string, distance: number, content = tier + distance): SearchResult {
  return { content, category: 'general', path: content + '.md', distance, tier };
}

describe('selectByTier', () => {
  it('fills slots with relevant canonical first, community only on leftovers', () => {
    const canonical = [res('canonical', 0.2), res('canonical', 0.4)];
    const community = [res('community', 0.1)];
    const out = selectByTier(canonical, community, 3, RELEVANCE_FLOOR);
    expect(out.map((r) => r.tier)).toEqual(['canonical', 'canonical', 'community']);
  });

  it('drops community entirely when canonical fills every slot', () => {
    const canonical = [res('canonical', 0.1), res('canonical', 0.2), res('canonical', 0.3)];
    const community = [res('community', 0.05)];
    const out = selectByTier(canonical, community, 3, RELEVANCE_FLOOR);
    expect(out).toHaveLength(3);
    expect(out.every((r) => r.tier === 'canonical')).toBe(true);
  });

  it('lets a strong community beat a weak canonical above the floor', () => {
    const canonical = [res('canonical', 1.8)]; // > floor 1.0 => held back
    const community = [res('community', 0.1)];
    const out = selectByTier(canonical, community, 1, RELEVANCE_FLOOR);
    expect(out).toHaveLength(1);
    expect(out[0].tier).toBe('community');
  });

  it('falls back to above-floor canonical when nothing else fills the slot', () => {
    const canonical = [res('canonical', 1.8)];
    const community: SearchResult[] = [];
    const out = selectByTier(canonical, community, 1, RELEVANCE_FLOOR);
    expect(out).toHaveLength(1);
    expect(out[0].tier).toBe('canonical');
  });
});
