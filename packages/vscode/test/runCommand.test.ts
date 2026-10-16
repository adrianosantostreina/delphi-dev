import { describe, it, expect } from 'vitest';
import { runCommand, type RunServices } from '../src/commands/runCommand';
import type { AgentAdapter, AgentId } from '../src/agents/types';
import { cmd } from './helpers';

function adapter(id: AgentId, log: string[]): AgentAdapter {
  const prefix: Record<AgentId, string> = { claude: '/', codex: '$delphi-cmd-', opencode: '/delphi-' };
  return {
    id, label: id, isInstalled: () => true,
    invocation: (c, arg) => `${prefix[id]}${c.id}${arg ? ` ${arg}` : ''}`,
    async send(text) {
      log.push(`send:${id}:${text}`);
      return 'sent';
    },
  };
}

function services(over: Partial<RunServices> = {}, log: string[] = []): RunServices {
  return {
    adapters: { claude: adapter('claude', log), codex: adapter('codex', log), opencode: adapter('opencode', log) },
    resolve: async () => ({ kind: 'agent', id: 'claude' }),
    fileRef: (withRange) => (withRange ? '@src/U.pas:3-9' : '@src/U.pas'),
    pluginPresent: () => true,
    remember: (a) => log.push(`remember:${a}`),
    notifyMissingPlugin: async (a) => {
      log.push(`missing:${a}`);
    },
    notifyNoAgent: async () => {
      log.push('no-agent');
    },
    ...over,
  };
}

describe('runCommand', () => {
  it('sends the invocation of the resolved agent', async () => {
    const log: string[] = [];
    expect(await runCommand(cmd('audit'), services({ resolve: async () => ({ kind: 'agent', id: 'codex' }) }, log))).toBe('sent');
    expect(log).toEqual(['remember:codex', 'send:codex:$delphi-cmd-audit']);
  });

  it('appends the file reference only for commands that take a file', async () => {
    const log: string[] = [];
    await runCommand(cmd('review', true), services({}, log));
    await runCommand(cmd('audit', false), services({}, log));
    expect(log.filter((l) => l.startsWith('send:'))).toEqual(['send:claude:/review @src/U.pas:3-9', 'send:claude:/audit']);
  });

  it('only /review carries the selected line range (parity with the old bridge)', async () => {
    const log: string[] = [];
    await runCommand(cmd('tdd', true), services({}, log));
    expect(log.filter((l) => l.startsWith('send:'))).toEqual(['send:claude:/tdd @src/U.pas']);
  });

  it('sends without an argument when the command takes a file but none is open', async () => {
    const log: string[] = [];
    await runCommand(cmd('review', true), services({ fileRef: () => undefined }, log));
    expect(log.filter((l) => l.startsWith('send:'))).toEqual(['send:claude:/review']);
  });

  it('warns about a missing plugin but still sends', async () => {
    const log: string[] = [];
    await runCommand(cmd('audit'), services({ resolve: async () => ({ kind: 'agent', id: 'opencode' }), pluginPresent: () => false }, log));
    expect(log).toEqual(['remember:opencode', 'missing:opencode', 'send:opencode:/delphi-audit']);
  });

  it('sends even when the missing-plugin notification never resolves (nobody clicks it)', async () => {
    const log: string[] = [];
    const never = new Promise<void>(() => undefined);
    const result = await Promise.race([
      runCommand(cmd('audit'), services({ resolve: async () => ({ kind: 'agent', id: 'opencode' }), pluginPresent: () => false, notifyMissingPlugin: () => never }, log)),
      new Promise<string>((resolve) => setTimeout(() => resolve('blocked'), 200)),
    ]);
    expect(result).toBe('sent');
    expect(log).toContain('send:opencode:/delphi-audit');
  });

  it('survives a missing-plugin notification that rejects', async () => {
    const log: string[] = [];
    const result = await runCommand(
      cmd('audit'),
      services({ pluginPresent: () => false, notifyMissingPlugin: async () => { throw new Error('ui gone'); } }, log),
    );
    expect(result).toBe('sent');
  });

  it('does not warn when presence is unknown', async () => {
    const log: string[] = [];
    await runCommand(cmd('audit'), services({ pluginPresent: () => undefined }, log));
    expect(log.some((l) => l.startsWith('missing:'))).toBe(false);
  });

  it('tells the user when no agent is installed', async () => {
    const log: string[] = [];
    expect(await runCommand(cmd('audit'), services({ resolve: async () => ({ kind: 'none' }) }, log))).toBe('no-agent');
    expect(log).toEqual(['no-agent']);
  });

  it('stays silent when the user cancels the picker: no error, no send, no remember', async () => {
    const log: string[] = [];
    expect(await runCommand(cmd('audit'), services({ resolve: async () => ({ kind: 'cancelled' }) }, log))).toBe('cancelled');
    expect(log).toEqual([]);
  });
});
