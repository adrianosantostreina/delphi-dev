import { describe, it, expect } from 'vitest';
import { resolveAgent } from '../src/agents/resolve';
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
