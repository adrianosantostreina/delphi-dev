import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Characterization of the PUBLISHED Claude Code flow of the installer: `npx delphi-dev` with no
// arguments (and the update/uninstall/verify/sync-kb commands) must keep doing exactly this.
// Every collaborator is mocked; nothing here touches the real home, git, claude or the network.

const sys = { nodeVersion: 'v22', hasClaudeCLI: true, hasVSCode: true, hasGit: true };
const verify = { claudeOk: true, pluginOk: true, vscodeOk: true };
const calls: string[] = [];
const rec = (name: string) => (...a: unknown[]) => { calls.push([name, ...a.map(String)].join('|')); };

const state = { codexHome: false, vscodeAvailable: true, vscodeInstalled: true, vscodeInstallThrows: '' as string, installPluginThrows: false };

vi.mock('../src/detect', () => ({
  detectSystem: () => ({ ...sys }),
  commandExists: (cmd: string) => (cmd.startsWith('claude') ? sys.hasClaudeCLI : false),
}));
// Bare machine apart from the Claude Code CLI: no Codex/OpenCode, nothing installed by us.
vi.mock('../src/targets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/targets')>()),
  realProbe: () => ({
    commandExists: (cmd: string) => (cmd.startsWith('claude') ? sys.hasClaudeCLI : false),
    pathExists: (p: string) => state.codexHome && /[\\/]\.codex$/.test(p),
    home: '/nowhere',
    vscodeExtensions: [],
  }),
  readInstallManifest: () => null,
  runPortable: () => { throw new Error('runPortable must not run in the Claude-only flow'); },
}));
vi.mock('../src/plugin', () => ({
  installPlugin: () => {
    calls.push('installPlugin');
    if (state.installPluginThrows) throw new Error('boom');
  },
  isPluginInstalled: () => true,
}));
vi.mock('../src/vscode-ext', () => ({
  installVSCodeExtension: () => {
    calls.push('installVSCodeExtension');
    if (state.vscodeInstallThrows) throw new Error(state.vscodeInstallThrows);
  },
  isVSCodeAvailable: () => state.vscodeAvailable,
  isVSCodeExtensionInstalled: () => state.vscodeInstalled,
}));
vi.mock('../src/hooks', () => ({ removeHooks: () => { calls.push('removeHooks'); } }));
vi.mock('../src/verify', () => ({ verifyInstallation: () => ({ ...verify }) }));
vi.mock('../src/ui', () => ({
  header: rec('header'),
  step: rec('step'),
  success: rec('success'),
  warn: rec('warn'),
  error: rec('error'),
  summary: (rows: unknown) => { calls.push(`summary|${JSON.stringify(rows)}`); },
}));

class ExitSignal extends Error {
  constructor(public code: number) { super(`exit ${code}`); }
}

let logged: string[] = [];

async function runCli(...args: string[]): Promise<number | undefined> {
  vi.resetModules();
  process.argv = ['node', 'delphi-dev', ...args];
  // index.ts calls program.parse() at import time and its install action is async: route parse()
  // through parseAsync so that the test can await the action and observe process.exit.
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
  return code;
}

beforeEach(() => {
  calls.length = 0;
  logged = [];
  Object.assign(sys, { hasClaudeCLI: true, hasVSCode: true, hasGit: true });
  Object.assign(verify, { claudeOk: true, pluginOk: true, vscodeOk: true });
  Object.assign(state, { codexHome: false, vscodeAvailable: true, vscodeInstalled: true, vscodeInstallThrows: '', installPluginThrows: false });
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new ExitSignal(code ?? 0); }) as never);
  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { logged.push(a.join(' ')); });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('npx delphi-dev (no arguments) -> Claude Code flow', () => {
  it('happy path: exact sequence of steps and messages, no exit call', async () => {
    const code = await runCli();
    expect(code).toBeUndefined();
    expect(calls).toEqual([
      'header|Installing delphi-dev v2.2',
      'step|Installing Claude Code plugin...',
      'installPlugin',
      'success|Plugin installed',
      'step|Cleaning up legacy delphi-dev hooks in ~/.claude/settings.json...',
      'removeHooks',
      'success|Legacy hooks cleaned',
      'step|Installing VS Code extension...',
      'installVSCodeExtension',
      'success|VS Code extension installed',
      `summary|${JSON.stringify([
        { label: 'Claude Code CLI', ok: true },
        { label: 'delphi-dev plugin active', ok: true },
        { label: 'VS Code extension', ok: true },
      ])}`,
    ]);
    expect(logged).toEqual([]);
  });

  it('Claude + ~/.codex present: same Claude-only flow, NOTHING written outside Claude, only a hint is printed', async () => {
    state.codexHome = true;
    const code = await runCli();
    expect(code).toBeUndefined();
    expect(calls.filter((c) => c.startsWith('runPortable'))).toEqual([]);
    expect(calls).toContain('installPlugin');
    expect(calls.some((c) => /codex|opencode/i.test(c))).toBe(false);
    expect(logged.join('\n')).toContain('npx delphi-dev --target codex');
    expect(logged.join('\n')).not.toContain('--target opencode');
  });

  it('exits 1 with the legacy message when the Claude Code CLI is missing', async () => {
    sys.hasClaudeCLI = false;
    const code = await runCli();
    expect(code).toBe(1);
    expect(calls).toEqual([
      'header|Installing delphi-dev v2.2',
      'error|Claude Code CLI not found. Install from https://claude.ai/code',
    ]);
  });

  it('exits 1 when git is missing', async () => {
    sys.hasGit = false;
    const code = await runCli();
    expect(code).toBe(1);
    expect(calls).toEqual([
      'header|Installing delphi-dev v2.2',
      'error|git not found. Required for plugin installation.',
    ]);
  });

  it('warns and prints the tip when VS Code is not available', async () => {
    state.vscodeAvailable = false;
    state.vscodeInstalled = false;
    const code = await runCli();
    expect(code).toBeUndefined();
    expect(calls).toContain('warn|VS Code not detected — skipping extension install');
    expect(calls).not.toContain('installVSCodeExtension');
    expect(calls).toContain(`summary|${JSON.stringify([
      { label: 'Claude Code CLI', ok: true },
      { label: 'delphi-dev plugin active', ok: true },
      { label: 'VS Code extension', ok: true, note: 'not detected' },
    ])}`);
    expect(logged).toHaveLength(3);
    expect(logged[0]).toContain('Tip: Install the Delphi Dev extension for VS Code');
    expect(logged[1]).toContain('code --install-extension adrianosantos.delphi-dev-vscode');
  });

  it('warns (without failing) when the extension is not on the Marketplace yet', async () => {
    state.vscodeInstallThrows = 'extension is not yet on the Marketplace';
    const code = await runCli();
    expect(code).toBeUndefined();
    expect(calls).toContain('warn|VS Code extension not yet on the Marketplace — search "Delphi Dev" in VS Code Extensions when available');
  });

  it('warns (without failing) when the extension install fails for another reason', async () => {
    state.vscodeInstallThrows = 'kaboom';
    const code = await runCli();
    expect(code).toBeUndefined();
    expect(calls).toContain('warn|VS Code extension install failed — install manually: adrianosantos.delphi-dev-vscode');
  });

  it('exits 1 when the plugin is not active after installing', async () => {
    verify.pluginOk = false;
    const code = await runCli();
    expect(code).toBe(1);
    expect(calls[calls.length - 1]).toBe('error|Plugin not active. Try: claude plugin list');
  });

  it('is also what the explicit `install` command does', async () => {
    const implicit = await runCli();
    const implicitCalls = [...calls];
    calls.length = 0;
    const explicit = await runCli('install');
    expect(explicit).toBe(implicit);
    expect(calls).toEqual(implicitCalls);
  });
});

describe('other published commands', () => {
  it('update pulls the plugin and tells the user to restart', async () => {
    const code = await runCli('update');
    expect(code).toBeUndefined();
    expect(calls).toEqual([
      'header|Updating delphi-dev',
      'step|Pulling latest plugin...',
      'installPlugin',
      'success|Plugin updated — restart your Claude Code session',
    ]);
  });

  it('uninstall removes the hooks and says the plugin files remain', async () => {
    const code = await runCli('uninstall');
    expect(code).toBeUndefined();
    expect(calls).toEqual([
      'header|Uninstalling delphi-dev',
      'step|Removing hooks...',
      'removeHooks',
      'success|Hooks removed',
      'warn|Plugin files remain in ~/.claude/plugins/delphi-dev — remove manually if desired',
    ]);
  });

  it('sync-kb is deprecated and only warns', async () => {
    const code = await runCli('sync-kb');
    expect(code).toBeUndefined();
    expect(calls).toEqual(['warn|The knowledge base now updates itself. Inside a session, run /update to refresh it now.']);
  });

  it('verify exits 0 when all is well and 1 otherwise', async () => {
    expect(await runCli('verify')).toBe(0);
    expect(calls).toEqual([`summary|${JSON.stringify([
      { label: 'Claude Code CLI', ok: true },
      { label: 'Plugin active', ok: true },
      { label: 'VS Code extension', ok: true },
    ])}`]);
    verify.pluginOk = false;
    expect(await runCli('verify')).toBe(1);
  });
});
