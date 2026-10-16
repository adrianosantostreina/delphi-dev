import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// New Codex/OpenCode paths of the installer CLI. Same isolation as cli-claude-flow.test.ts:
// every collaborator is mocked, nothing touches the real home, git, claude or the network.

const sys = { nodeVersion: 'v22', hasClaudeCLI: true, hasVSCode: false, hasGit: true };
const calls: string[] = [];
const rec = (name: string) => (...a: unknown[]) => { calls.push([name, ...a.map(String)].join('|')); };
const state = {
  detected: { codex: false, opencode: false },
  installed: [] as string[],
  portableThrows: '',
};

vi.mock('../src/detect', () => ({
  detectSystem: () => ({ ...sys }),
  commandExists: () => false,
}));
vi.mock('../src/targets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/targets')>()),
  realProbe: () => ({
    commandExists: (cmd: string) => {
      if (cmd.startsWith('claude')) return sys.hasClaudeCLI;
      if (cmd.startsWith('codex')) return state.detected.codex;
      if (cmd.startsWith('opencode')) return state.detected.opencode;
      return false;
    },
    pathExists: () => false,
    home: '/nowhere',
    vscodeExtensions: [],
  }),
  readInstallManifest: () => {
    const m: Record<string, unknown> = {};
    for (const t of state.installed) m[t] = { files: [{ path: 'x', sha256: 'y' }], dirs: [] };
    return state.installed.length ? JSON.stringify(m) : null;
  },
  runPortable: (cmd: string, targets: string[], o: unknown) => {
    calls.push(`runPortable|${cmd}|${targets.join('+')}|${JSON.stringify(o)}`);
    if (state.portableThrows) throw new Error(state.portableThrows);
  },
}));
vi.mock('../src/plugin', () => ({
  installPlugin: () => { calls.push('installPlugin'); },
  isPluginInstalled: () => true,
}));
vi.mock('../src/vscode-ext', () => ({
  installVSCodeExtension: () => { calls.push('installVSCodeExtension'); },
  isVSCodeAvailable: () => false,
  isVSCodeExtensionInstalled: () => false,
}));
vi.mock('../src/hooks', () => ({ removeHooks: () => { calls.push('removeHooks'); } }));
vi.mock('../src/verify', () => ({ verifyInstallation: () => ({ claudeOk: true, pluginOk: true, vscodeOk: true }) }));
vi.mock('../src/ui', () => ({
  header: rec('header'),
  step: rec('step'),
  success: rec('success'),
  warn: rec('warn'),
  error: rec('error'),
  summary: rec('summary'),
}));

class ExitSignal extends Error {
  constructor(public code: number) { super(`exit ${code}`); }
}

async function runCli(...args: string[]): Promise<number | undefined> {
  vi.resetModules();
  process.argv = ['node', 'delphi-dev', ...args];
  const { Command } = await import('commander');
  let pending: Promise<unknown> = Promise.resolve();
  vi.spyOn(Command.prototype, 'parse').mockImplementation(function (this: InstanceType<typeof Command>, argv?: readonly string[]) {
    pending = this.parseAsync(argv);
    return this;
  });
  let code: number | undefined;
  try {
    await import('../src/index');
    await pending;
  } catch (e) {
    if (e instanceof ExitSignal) code = e.code;
    else throw e;
  }
  return code ?? (typeof process.exitCode === 'number' ? process.exitCode : undefined);
}

beforeEach(() => {
  calls.length = 0;
  Object.assign(sys, { hasClaudeCLI: true, hasGit: true });
  Object.assign(state, { detected: { codex: false, opencode: false }, installed: [], portableThrows: '' });
  process.exitCode = undefined;
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new ExitSignal(code ?? 0); }) as never);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  process.exitCode = undefined;
  vi.restoreAllMocks();
});

describe('install --target', () => {
  it('codex only: delegates to kb-cli and does not touch Claude Code at all', async () => {
    const code = await runCli('install', '--target', 'codex', '--from', '/chk', '--dry-run');
    expect(code).toBeUndefined();
    expect(calls).toEqual([
      'header|Installing delphi-dev for codex',
      'runPortable|install|codex|{"target":"codex","from":"/chk","dryRun":true}',
      'success|Dry run for codex — nothing was written',
    ]);
  });

  it('codex + opencode works on a machine without the Claude Code CLI', async () => {
    sys.hasClaudeCLI = false;
    expect(await runCli('install', '--target', 'codex,opencode')).toBeUndefined();
    expect(calls).toContain('runPortable|install|codex+opencode|{"target":"codex,opencode"}');
    expect(calls.some((c) => c.startsWith('error'))).toBe(false);
  });

  it('all: portable first, then the unchanged Claude Code flow', async () => {
    expect(await runCli('install', '--target', 'all')).toBeUndefined();
    expect(calls.slice(0, 3)).toEqual([
      'header|Installing delphi-dev for codex + opencode',
      'runPortable|install|codex+opencode|{"target":"all"}',
      'success|delphi-dev installed for codex + opencode — restart the agent session',
    ]);
    expect(calls.slice(3, 7)).toEqual([
      'header|Installing delphi-dev v2.2',
      'step|Installing Claude Code plugin...',
      'installPlugin',
      'success|Plugin installed',
    ]);
  });

  it('a Codex/OpenCode failure does not stop the Claude Code install; the exit code is still 1', async () => {
    state.portableThrows = 'kb-cli install falhou (codigo 1)';
    const code = await runCli('install', '--target', 'all');
    expect(code).toBe(1);
    expect(calls).toContain('error|kb-cli install falhou (codigo 1)');
    expect(calls).toContain('installPlugin');
    expect(calls).toContain('removeHooks');
  });

  it('a Codex failure with no Claude target exits 1 right away', async () => {
    state.portableThrows = 'boom';
    expect(await runCli('install', '--target', 'codex')).toBe(1);
    expect(calls).not.toContain('installPlugin');
  });

  it('rejects an unknown target with exit 1 and installs nothing', async () => {
    expect(await runCli('install', '--target', 'gemini')).toBe(1);
    expect(calls.length).toBe(1);
    expect(calls[0]).toMatch(/^error\|.*gemini/);
  });

  it('detects Codex next to Claude Code when no flag is given, and says what it detected', async () => {
    state.detected.codex = true;
    expect(await runCli()).toBeUndefined();
    expect(calls.slice(0, 4)).toEqual([
      'header|Installing delphi-dev for codex',
      'step|Detected: claude, codex',
      'runPortable|install|codex|{}',
      'success|delphi-dev installed for codex — restart the agent session',
    ]);
    expect(calls).toContain('installPlugin');
  });

  it('with only Codex detected and no Claude CLI, installs for Codex and stops', async () => {
    sys.hasClaudeCLI = false;
    state.detected.codex = true;
    expect(await runCli()).toBeUndefined();
    expect(calls).not.toContain('installPlugin');
    expect(calls.some((c) => c.startsWith('error'))).toBe(false);
  });
});

describe('update and uninstall with a Codex/OpenCode install', () => {
  it('update refreshes Claude Code (as before) and then the installed targets', async () => {
    state.installed = ['codex', 'opencode'];
    expect(await runCli('update')).toBeUndefined();
    expect(calls).toEqual([
      'header|Updating delphi-dev',
      'step|Pulling latest plugin...',
      'installPlugin',
      'success|Plugin updated — restart your Claude Code session',
      'step|Updating codex + opencode...',
      'runPortable|install|codex+opencode|{}',
      'success|Updated codex + opencode — restart the agent session',
    ]);
  });

  it('update skips Claude Code when there is no Claude CLI but a Codex install exists', async () => {
    sys.hasClaudeCLI = false;
    state.installed = ['codex'];
    expect(await runCli('update')).toBeUndefined();
    expect(calls).not.toContain('installPlugin');
    expect(calls).toContain('runPortable|install|codex|{}');
  });

  it('uninstall keeps the historical output and then removes what we installed', async () => {
    state.installed = ['opencode'];
    expect(await runCli('uninstall')).toBeUndefined();
    expect(calls).toEqual([
      'header|Uninstalling delphi-dev',
      'step|Removing hooks...',
      'removeHooks',
      'success|Hooks removed',
      'warn|Plugin files remain in ~/.claude/plugins/delphi-dev — remove manually if desired',
      'step|Removing delphi-dev from opencode...',
      'runPortable|uninstall|opencode|{}',
      'success|Codex/OpenCode files removed (only what delphi-dev installed)',
    ]);
  });

  it('uninstall reports a kb-cli failure and exits non-zero', async () => {
    state.installed = ['opencode'];
    state.portableThrows = 'kb-cli uninstall falhou (codigo 1)';
    expect(await runCli('uninstall')).toBe(1);
    expect(calls).toContain('error|kb-cli uninstall falhou (codigo 1)');
  });
});
