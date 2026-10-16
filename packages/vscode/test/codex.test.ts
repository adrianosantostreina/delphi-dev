import { describe, it, expect } from 'vitest';
import { createCodexAdapter } from '../src/agents/codex';
import { cmd, fakeDeps } from './helpers';

describe('codex adapter', () => {
  it('builds $delphi-cmd-<id> with an optional file argument', () => {
    const a = createCodexAdapter(fakeDeps());
    expect(a.invocation(cmd('audit'))).toBe('$delphi-cmd-audit');
    expect(a.invocation(cmd('new-project'))).toBe('$delphi-cmd-new-project');
    expect(a.invocation(cmd('review', true), '@U.pas')).toBe('$delphi-cmd-review @U.pas');
  });

  it('is installed when the openai.chatgpt extension exists', () => {
    expect(createCodexAdapter(fakeDeps({ hasExtension: (id) => id === 'openai.chatgpt' })).isInstalled()).toBe(true);
    expect(createCodexAdapter(fakeDeps({ hasExtension: () => false })).isInstalled()).toBe(false);
  });

  it('opens the panel, copies the command and says so (it cannot send)', async () => {
    const d = fakeDeps();
    expect(await createCodexAdapter(d).send('$delphi-cmd-audit')).toBe('copied');
    expect(d.calls).toEqual(['exec:chatgpt.openSidebar']);
    expect(d.clipboard).toEqual(['$delphi-cmd-audit']);
    expect(d.infos[0]).toContain('$delphi-cmd-audit');
  });

  it('falls back to a new panel when the sidebar command is missing', async () => {
    const tried: string[] = [];
    const d = fakeDeps({
      executeCommand: async (command) => {
        tried.push(command);
        if (command === 'chatgpt.openSidebar') throw new Error('missing');
        return undefined;
      },
    });
    expect(await createCodexAdapter(d).send('$delphi-cmd-audit')).toBe('copied');
    expect(tried).toEqual(['chatgpt.openSidebar', 'chatgpt.newCodexPanel']);
    expect(d.clipboard).toEqual(['$delphi-cmd-audit']);
  });

  it('still copies when no panel command works', async () => {
    const d = fakeDeps({
      executeCommand: async () => {
        throw new Error('nope');
      },
    });
    expect(await createCodexAdapter(d).send('$delphi-cmd-audit')).toBe('copied');
    expect(d.clipboard).toEqual(['$delphi-cmd-audit']);
  });

  it('uses the experimental prompt URI only when the setting is on', async () => {
    const off = fakeDeps();
    await createCodexAdapter(off).send('$delphi-cmd-audit');
    expect(off.calls.some((c) => c.startsWith('open:'))).toBe(false);

    const on = fakeDeps({ getSetting: <T>(key: string, fallback: T) => (key === 'codexPromptUri' ? (true as T) : fallback) });
    expect(await createCodexAdapter(on).send('$delphi-cmd-audit')).toBe('prefilled');
    expect(on.calls).toEqual([`open:vscode://openai.chatgpt/?prompt=${encodeURIComponent('$delphi-cmd-audit')}`]);
    expect(on.clipboard).toEqual([]);
  });

  it('copies anyway when the URI was not opened', async () => {
    const d = fakeDeps({
      getSetting: <T>(key: string, fallback: T) => (key === 'codexPromptUri' ? (true as T) : fallback),
      openExternal: async () => false,
    });
    expect(await createCodexAdapter(d).send('$delphi-cmd-audit')).toBe('copied');
    expect(d.clipboard).toEqual(['$delphi-cmd-audit']);
  });

  it('copies anyway when opening the URI throws', async () => {
    const d = fakeDeps({
      getSetting: <T>(key: string, fallback: T) => (key === 'codexPromptUri' ? (true as T) : fallback),
      openExternal: async () => {
        throw new Error('boom');
      },
    });
    expect(await createCodexAdapter(d).send('$delphi-cmd-audit')).toBe('copied');
    expect(d.clipboard).toEqual(['$delphi-cmd-audit']);
  });

  it('offers to install the extension and does not pretend to have sent', async () => {
    const executed: unknown[][] = [];
    const d = fakeDeps({
      hasExtension: () => false,
      showError: async () => 'Instalar Codex',
      executeCommand: async (command, ...args) => {
        executed.push([command, ...args]);
        return undefined;
      },
    });
    expect(await createCodexAdapter(d).send('$delphi-cmd-audit')).toBe('unavailable');
    expect(executed).toEqual([['workbench.extensions.installExtension', 'openai.chatgpt']]);
    expect(d.clipboard).toEqual([]);
  });

  it('does not install anything when the user dismisses the offer', async () => {
    const executed: string[] = [];
    const d = fakeDeps({
      hasExtension: () => false,
      showError: async () => undefined,
      executeCommand: async (command) => {
        executed.push(command);
        return undefined;
      },
    });
    expect(await createCodexAdapter(d).send('$delphi-cmd-audit')).toBe('unavailable');
    expect(executed).toEqual([]);
  });
});
