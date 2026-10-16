import { describe, it, expect } from 'vitest';
import { createClaudeAdapter } from '../src/agents/claude';
import { cmd, fakeDeps } from './helpers';

describe('claude adapter', () => {
  it('builds /<id> with an optional file argument', () => {
    const a = createClaudeAdapter(fakeDeps());
    expect(a.invocation(cmd('audit'))).toBe('/audit');
    expect(a.invocation(cmd('review', true), '@src/U.pas:10-20')).toBe('/review @src/U.pas:10-20');
    expect(a.id).toBe('claude');
  });

  it('reports installed from the extension id', () => {
    expect(createClaudeAdapter(fakeDeps({ hasExtension: (id) => id === 'anthropic.claude-code' })).isInstalled()).toBe(true);
    expect(createClaudeAdapter(fakeDeps({ hasExtension: () => false })).isInstalled()).toBe(false);
  });

  it('sends through the same command claudeCodeBridge used', async () => {
    const d = fakeDeps();
    expect(await createClaudeAdapter(d).send('/audit')).toBe('sent');
    expect(d.calls).toEqual(['exec:claude-vscode.primaryEditor.open:[null,"/audit"]']);
  });

  it('falls back to the URI handler when the command throws', async () => {
    const d = fakeDeps({
      executeCommand: async () => {
        throw new Error('no such command');
      },
    });
    expect(await createClaudeAdapter(d).send('/review @a b.pas')).toBe('sent');
    expect(d.calls).toEqual([`open:vscode://anthropic.claude-code/open?prompt=${encodeURIComponent('/review @a b.pas')}`]);
  });

  it('offers to install the extension when nothing opens, and never says it sent', async () => {
    const executed: unknown[][] = [];
    const d = fakeDeps({
      executeCommand: async (command, ...args) => {
        if (command === 'claude-vscode.primaryEditor.open') throw new Error('missing');
        executed.push([command, ...args]);
        return undefined;
      },
      openExternal: async () => false,
      showError: async () => 'Instalar Claude Code',
    });
    expect(await createClaudeAdapter(d).send('/audit')).toBe('unavailable');
    expect(executed).toEqual([['workbench.extensions.installExtension', 'anthropic.claude-code']]);
  });
});
