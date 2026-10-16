import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { registerCommands } from '../src/commands/delphiCommands';
import { registry, vscodeCommandId } from '../src/registry';
import type { Services } from '../src/agents/services';
import type { AgentAdapter, AgentId } from '../src/agents/types';

const { registeredCommands, executedCommands } = vscode as unknown as {
  registeredCommands: Map<string, (...args: unknown[]) => unknown>;
  executedCommands: string[];
};

function adapter(id: AgentId, sent: string[]): AgentAdapter {
  return {
    id, label: id, isInstalled: () => true,
    invocation: (c, arg) => `/${c.id}${arg ? ` ${arg}` : ''}`,
    async send(text) {
      sent.push(text);
      return 'sent';
    },
  };
}

function fakeServices(sent: string[], chosen?: AgentId): Services {
  const adapters = { claude: adapter('claude', sent), codex: adapter('codex', sent), opencode: adapter('opencode', sent) };
  return {
    adapters,
    installedAgents: () => ['claude'],
    agentSetting: () => 'auto',
    current: async () => ({ kind: 'agent', id: 'claude' }),
    chooseAgent: async () => chosen,
    run: {
      adapters,
      resolve: async () => ({ kind: 'agent', id: 'claude' }),
      fileRef: () => '@src/U.pas',
      pluginPresent: () => true,
      remember: () => undefined,
      notifyMissingPlugin: async () => undefined,
      notifyNoAgent: async () => undefined,
    },
  };
}

describe('registerCommands', () => {
  beforeEach(() => {
    registeredCommands.clear();
    executedCommands.length = 0;
  });

  it('registers a handler for every registry command plus chooseAgent', () => {
    const context = { subscriptions: [] as unknown[] };
    registerCommands(context as never, fakeServices([]));
    for (const c of registry.commands) expect(registeredCommands.has(vscodeCommandId(c.id))).toBe(true);
    expect(registeredCommands.has('delphi-dev.chooseAgent')).toBe(true);
    expect(context.subscriptions).toHaveLength(registry.commands.length + 1);
  });

  it('runs the command through the resolved agent, attaching the file only where the registry says so', async () => {
    const sent: string[] = [];
    registerCommands({ subscriptions: [] } as never, fakeServices(sent));
    await registeredCommands.get('delphi-dev.audit')!();
    await registeredCommands.get('delphi-dev.review')!();
    expect(sent).toEqual(['/audit', '/review @src/U.pas']);
  });

  it('refreshes the status bar only when an agent was actually chosen', async () => {
    registerCommands({ subscriptions: [] } as never, fakeServices([], undefined));
    await registeredCommands.get('delphi-dev.chooseAgent')!();
    expect(executedCommands).toEqual([]);
    registeredCommands.clear();
    registerCommands({ subscriptions: [] } as never, fakeServices([], 'codex'));
    await registeredCommands.get('delphi-dev.chooseAgent')!();
    expect(executedCommands).toEqual(['delphi-dev.refreshStatus']);
  });
});

describe('package.json settings', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
  const props = pkg.contributes.configuration.properties;

  it('keeps the settings that reach a terminal or an external URI out of workspace scope', () => {
    expect(props['delphiDev.opencodePort'].scope).toBe('machine');
    expect(props['delphiDev.codexPromptUri'].scope).toBe('machine');
  });

  it('declares the agent selector with auto as default', () => {
    expect(props['delphiDev.agent'].enum).toEqual(['auto', 'claude', 'codex', 'opencode']);
    expect(props['delphiDev.agent'].default).toBe('auto');
  });
});

describe('package.json workspace trust', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
  const props = pkg.contributes.configuration.properties;

  it('lets the trusted user pick the agent per workspace, but never an untrusted one', () => {
    expect(props['delphiDev.agent'].scope).toBe('machine-overridable');
    expect(pkg.capabilities.untrustedWorkspaces.supported).toBe('limited');
    expect(pkg.capabilities.untrustedWorkspaces.description).toMatch(/\S/);
  });

  it('restricts every setting that steers a terminal, an agent or an external URI', () => {
    expect(pkg.capabilities.untrustedWorkspaces.restrictedConfigurations).toEqual(
      expect.arrayContaining(['delphiDev.agent', 'delphiDev.opencodePort', 'delphiDev.codexPromptUri']),
    );
    for (const key of pkg.capabilities.untrustedWorkspaces.restrictedConfigurations) expect(props[key], key).toBeDefined();
  });

  it('is not supported in virtual workspaces (needs a real folder and a terminal)', () => {
    expect(pkg.capabilities.virtualWorkspaces.supported).toBe(false);
    expect(pkg.capabilities.virtualWorkspaces.description).toMatch(/\S/);
  });
});
