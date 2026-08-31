import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  openDb,
  insertChunk,
  selectByTier,
  applyDistanceCutoff,
  ragHealth,
  RELEVANCE_FLOOR,
  DEFAULT_MAX_DISTANCE,
  type SearchResult,
} from '../src/db';
import { extractTranscriptText, readHookTranscript } from '../src/capture';

function res(tier: string, distance: number, content = 'x'): SearchResult {
  return { content, category: 'general', path: 'p', distance, tier };
}

// ---------------------------------------------------------------- defect 4
describe('defeito 4 — tier local subordinado a canonical e community', () => {
  it('canonical relevante ocupa os slots antes de community e local', () => {
    const out = selectByTier([res('canonical', 0.2)], [res('community', 0.1)], [res('local', 0.05)], 2, RELEVANCE_FLOOR);
    expect(out.map((r) => r.tier)).toEqual(['canonical', 'community']);
  });

  it('local so entra depois de esgotar canonical relevante e community', () => {
    const out = selectByTier([res('canonical', 0.2)], [res('community', 0.3)], [res('local', 0.01)], 3, RELEVANCE_FLOOR);
    expect(out.map((r) => r.tier)).toEqual(['canonical', 'community', 'local']);
  });

  it('local NAO desloca canonical relevante mesmo estando muito mais proximo', () => {
    const out = selectByTier([res('canonical', 0.9)], [], [res('local', 0.01)], 1, RELEVANCE_FLOOR);
    expect(out.map((r) => r.tier)).toEqual(['canonical']);
  });

  it('canonical acima do piso continua sendo o ultimo recurso, atras de local', () => {
    const out = selectByTier([res('canonical', 1.5)], [], [res('local', 1.4)], 2, RELEVANCE_FLOOR);
    expect(out.map((r) => r.tier)).toEqual(['local', 'canonical']);
  });

  it('funciona sem nenhum local (compatibilidade)', () => {
    const out = selectByTier([res('canonical', 0.2)], [res('community', 0.3)], [], 3, RELEVANCE_FLOOR);
    expect(out.map((r) => r.tier)).toEqual(['canonical', 'community']);
  });
});

// ---------------------------------------------------------------- defect 3
describe('defeito 3 — corte absoluto por distancia', () => {
  it('descarta resultados acima do limiar', () => {
    const out = applyDistanceCutoff([res('canonical', 0.3), res('canonical', 1.9)], 1.1);
    expect(out).toHaveLength(1);
    expect(out[0].distance).toBe(0.3);
  });

  it('devolve lista VAZIA quando nada passa — o caminho "nao injetar nada"', () => {
    const out = applyDistanceCutoff([res('canonical', 1.8), res('local', 1.95)], 1.1);
    expect(out).toEqual([]);
  });

  it('mantem tudo quando todos passam', () => {
    const out = applyDistanceCutoff([res('canonical', 0.1), res('community', 0.9)], 1.1);
    expect(out).toHaveLength(2);
  });

  it('o limiar default e mais frouxo que o piso de relevancia', () => {
    expect(DEFAULT_MAX_DISTANCE).toBeGreaterThan(RELEVANCE_FLOOR);
  });
});

// ---------------------------------------------------------------- defect 1
describe('defeito 1 — capture le a conversa, nao o envelope do hook', () => {
  it('extrai apenas o texto das mensagens do transcript .jsonl', () => {
    const jsonl = [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'como faco um try finally' } }),
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Use um recurso por bloco.' },
            { type: 'tool_use', name: 'Bash', input: { command: 'ls -la' } },
          ],
        },
      }),
      JSON.stringify({ type: 'file-history-snapshot', snapshot: { trackedFileBackups: {} } }),
    ].join('\n');

    const text = extractTranscriptText(jsonl);
    expect(text).toContain('como faco um try finally');
    expect(text).toContain('Use um recurso por bloco.');
  });

  it('descarta tool_use, tool_result e metadados', () => {
    const jsonl = [
      JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: { command: 'rm -rf' } }] },
      }),
      JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'saida enorme' }] } }),
      JSON.stringify({ type: 'bridge-session', sessionId: 'abc', ownerAccountUuid: 'u' }),
    ].join('\n');

    const text = extractTranscriptText(jsonl);
    expect(text).not.toContain('rm -rf');
    expect(text).not.toContain('saida enorme');
    expect(text).not.toContain('ownerAccountUuid');
  });

  it('ignora linhas invalidas sem quebrar', () => {
    const jsonl = ['{ nao e json', JSON.stringify({ type: 'user', message: { role: 'user', content: 'ok' } }), ''].join('\n');
    expect(extractTranscriptText(jsonl)).toContain('ok');
  });

  it('readHookTranscript abre o transcript_path do payload do hook', () => {
    const tmp = path.join(os.tmpdir(), `dd-transcript-${Date.now()}.jsonl`);
    fs.writeFileSync(tmp, JSON.stringify({ type: 'user', message: { role: 'user', content: 'conteudo real da conversa' } }));
    try {
      const payload = JSON.stringify({
        session_id: 'bf1de152',
        transcript_path: tmp,
        cwd: 'C:\\BitBucket\\Phoenix',
        hook_event_name: 'Stop',
      });
      const out = readHookTranscript(payload);
      expect(out).toContain('conteudo real da conversa');
      // o envelope NAO pode vazar para o indice
      expect(out).not.toContain('transcript_path');
      expect(out).not.toContain('bf1de152');
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it('devolve string vazia quando o payload e envelope sem transcript legivel', () => {
    const payload = JSON.stringify({ session_id: 'x', transcript_path: 'C:\\nao\\existe.jsonl', hook_event_name: 'Stop' });
    expect(readHookTranscript(payload)).toBe('');
  });

  it('nao trata texto solto (nao-JSON) como envelope', () => {
    expect(readHookTranscript('apenas um texto qualquer')).toBe('apenas um texto qualquer');
  });
});

// ---------------------------------------------------------------- defect 2
describe('defeito 2 — deteccao de acervo curado ausente', () => {
  let dbPath: string;
  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `dd-health-${Date.now()}-${Math.random()}.db`);
  });
  afterEach(() => {
    for (const suffix of ['', '-wal', '-shm']) {
      const f = dbPath + suffix;
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it('acusa acervo curado ausente num banco criado do zero pelo capture', () => {
    const db = openDb(dbPath);
    insertChunk(db, {
      path: 'knowledge/local/2026-08-31-session.md',
      chunkIndex: 0,
      content: 'ruido capturado',
      embedding: new Float32Array(384).fill(0.1),
      category: 'general',
      agent: null,
      tier: 'local',
    });
    const health = ragHealth(db);
    db.close();

    expect(health.canonical).toBe(0);
    expect(health.local).toBe(1);
    expect(health.curatedMissing).toBe(true);
  });

  it('nao acusa quando ha conteudo canonical', () => {
    const db = openDb(dbPath);
    insertChunk(db, {
      path: 'knowledge/core/encoding-utf8-bom.md',
      chunkIndex: 0,
      content: 'conteudo curado',
      embedding: new Float32Array(384).fill(0.2),
      category: 'general',
      agent: null,
      tier: 'canonical',
    });
    const health = ragHealth(db);
    db.close();

    expect(health.canonical).toBe(1);
    expect(health.curatedMissing).toBe(false);
  });
});
