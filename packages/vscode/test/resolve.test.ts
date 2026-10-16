import { describe, it, expect } from 'vitest';
import { parseAgentSetting, resolveAgent } from '../src/agents/resolve';
import type { AgentId } from '../src/agents/types';

const never = async (): Promise<AgentId | undefined> => {
  throw new Error('should not ask');
};

describe('resolveAgent', () => {
  it('honors an explicit setting without asking', async () => {
    expect(await resolveAgent({ setting: 'codex', installed: ['claude'], last: undefined, pick: never })).toBe('codex');
  });

  it('uses the only installed agent', async () => {
    expect(await resolveAgent({ setting: 'auto', installed: ['opencode'], last: undefined, pick: never })).toBe('opencode');
  });

  it('returns undefined when nothing is installed', async () => {
    expect(await resolveAgent({ setting: 'auto', installed: [], last: 'claude', pick: never })).toBeUndefined();
  });

  it('reuses the last agent when it is still installed (no question)', async () => {
    expect(await resolveAgent({ setting: 'auto', installed: ['claude', 'codex'], last: 'codex', pick: never })).toBe('codex');
  });

  it('asks once when several are installed and there is no usable last', async () => {
    const asked: AgentId[][] = [];
    const out = await resolveAgent({
      setting: 'auto', installed: ['claude', 'codex'], last: 'opencode',
      pick: async (options) => {
        asked.push(options);
        return 'claude';
      },
    });
    expect(out).toBe('claude');
    expect(asked).toEqual([['claude', 'codex']]);
  });

  it('returns undefined when the user dismisses the question', async () => {
    expect(await resolveAgent({ setting: 'auto', installed: ['claude', 'codex'], last: undefined, pick: async () => undefined })).toBeUndefined();
  });
});

describe('parseAgentSetting', () => {
  it('accepts the known agents and auto', () => {
    for (const v of ['auto', 'claude', 'codex', 'opencode'] as const) expect(parseAgentSetting(v)).toBe(v);
  });

  it('falls back to auto for anything else, never throwing (a hand-edited settings.json)', () => {
    for (const v of ['Claude', 'CLAUDE', ' codex', '', 'gemini', 7, null, undefined, {}, [], ['claude'], true]) {
      expect(parseAgentSetting(v)).toBe('auto');
    }
  });
});
