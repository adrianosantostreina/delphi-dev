import { describe, it, expect } from 'vitest';
import { chooseAgentFlow, type ChooseInput } from '../src/agents/choose';
import type { AgentId } from '../src/agents/types';

function input(over: Partial<ChooseInput> = {}) {
  const log: string[] = [];
  const asked: AgentId[][] = [];
  const i: ChooseInput = {
    installed: ['claude', 'codex'],
    setting: 'auto',
    labels: { claude: 'Claude Code', codex: 'Codex', opencode: 'OpenCode' },
    pt: false,
    pick: async (options) => {
      asked.push(options);
      return options[1];
    },
    remember: (a) => log.push(`remember:${a}`),
    info: (m) => log.push(`info:${m}`),
    notifyNoAgent: async () => {
      log.push('no-agent');
    },
    ...over,
  };
  return { i, log, asked };
}

describe('chooseAgentFlow', () => {
  it('lists only the installed agents and remembers the choice', async () => {
    const { i, log, asked } = input();
    expect(await chooseAgentFlow(i)).toBe('codex');
    expect(asked).toEqual([['claude', 'codex']]);
    expect(log).toEqual(['remember:codex']);
  });

  it('does not remember anything when the picker is dismissed', async () => {
    const { i, log } = input({ pick: async () => undefined });
    expect(await chooseAgentFlow(i)).toBeUndefined();
    expect(log).toEqual([]);
  });

  it('with a single installed agent says which one is in use, without asking or saving a useless last', async () => {
    const { i, log, asked } = input({ installed: ['opencode'] });
    expect(await chooseAgentFlow(i)).toBeUndefined();
    expect(asked).toEqual([]);
    expect(log).toHaveLength(1);
    expect(log[0]).toContain('OpenCode');
    expect(log.some((l) => l.startsWith('remember:'))).toBe(false);
  });

  it('with a single installed agent but an explicit setting, points at the setting', async () => {
    const { i, log } = input({ installed: ['opencode'], setting: 'claude' });
    await chooseAgentFlow(i);
    expect(log[0]).toContain('delphiDev.agent');
    expect(log[0]).toContain('Claude Code');
  });

  it('with no installed agent, reports it instead of showing an empty picker', async () => {
    const { i, log, asked } = input({ installed: [] });
    expect(await chooseAgentFlow(i)).toBeUndefined();
    expect(asked).toEqual([]);
    expect(log).toEqual(['no-agent']);
  });
});
