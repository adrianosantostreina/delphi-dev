import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The BETA line of the installer: a pre-release package installs its own tag, --ref chooses another
// one, and update keeps what was recorded. Same isolation as the other CLI tests: nothing touches
// the real home, git, claude or the network.

const sys = { nodeVersion: 'v22', hasClaudeCLI: true, hasVSCode: false, hasGit: true };
const calls: string[] = [];
const rec = (name: string) => (...a: unknown[]) => { calls.push([name, ...a.map(String)].join('|')); };
const state = {
  version: '4.0.0-beta.1',
  recorded: null as null | { ref: string; explicit: boolean },
  installed: [] as string[],
  pluginThrows: '',
};

vi.mock('../src/detect', () => ({
  detectSystem: () => ({ ...sys }),
  commandExists: () => false,
}));
vi.mock('../src/targets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/targets')>()),
  realProbe: () => ({ commandExists: () => false, pathExists: () => false, home: '/nowhere', vscodeExtensions: [] }),
  readInstallManifest: () => {
    const m: Record<string, unknown> = {};
    for (const t of state.installed) m[t] = { files: [{ path: 'x', sha256: 'y' }], dirs: [] };
    return state.installed.length ? JSON.stringify(m) : null;
  },
  runPortable: (cmd: string, targets: string[], o: unknown) => {
    calls.push(`runPortable|${cmd}|${targets.join('+')}|${JSON.stringify(o)}`);
    return 'ok';
  },
}));
vi.mock('../src/plugin', () => ({
  installPlugin: (o: unknown) => {
    calls.push(`installPlugin|${JSON.stringify(o)}`);
    if (state.pluginThrows) throw new Error(state.pluginThrows);
  },
  isPluginInstalled: () => true,
}));
vi.mock('../src/vscode-ext', () => ({
  installVSCodeExtension: () => { calls.push('installVSCodeExtension'); },
  isVSCodeAvailable: () => false,
  isVSCodeExtensionInstalled: () => false,
}));
vi.mock('../src/hooks', () => ({ removeHooks: () => { calls.push('removeHooks'); } }));
vi.mock('../src/verify', () => ({ verifyInstallation: () => ({ claudeOk: true, pluginOk: true, vscodeOk: true }) }));
vi.mock('../src/version', () => ({ packageVersion: () => state.version }));
vi.mock('../src/ref', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/ref')>()),
  readRefState: () => (state.recorded ? { ...state.recorded } : null),
  writeRefState: (s: { ref: string; explicit: boolean; version?: string }) => {
    calls.push(`writeRefState|${s.ref}|${s.explicit}|${s.version}`);
  },
  clearRefState: () => { calls.push('clearRefState'); },
}));
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
  Object.assign(state, { version: '4.0.0-beta.1', recorded: null, installed: [], pluginThrows: '' });
  process.exitCode = undefined;
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new ExitSignal(code ?? 0); }) as never);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  process.exitCode = undefined;
  vi.restoreAllMocks();
});

describe('install with a pre-release package', () => {
  it('defaults to v<version>, says which ref it installs and records it', async () => {
    expect(await runCli()).toBeUndefined();
    expect(calls).toEqual([
      'header|Installing delphi-dev v2.2',
      'step|Ref: v4.0.0-beta.1 (pre-release version of this package)',
      'step|Installing Claude Code plugin...',
      'installPlugin|{"ref":"v4.0.0-beta.1","unpin":false}',
      'writeRefState|v4.0.0-beta.1|false|4.0.0-beta.1',
      'success|Plugin installed',
      'step|Cleaning up legacy delphi-dev hooks in ~/.claude/settings.json...',
      'removeHooks',
      'success|Legacy hooks cleaned',
      'warn|VS Code not detected — skipping extension install',
      expect.stringMatching(/^summary\|/),
    ]);
  });

  it('--ref overrides the default and is recorded as explicit', async () => {
    expect(await runCli('install', '--ref', 'feature/x')).toBeUndefined();
    expect(calls).toContain('step|Ref: feature/x (chosen with --ref)');
    expect(calls).toContain('installPlugin|{"ref":"feature/x","unpin":false}');
    expect(calls).toContain('writeRefState|feature/x|true|4.0.0-beta.1');
  });

  it('--target codex passes the ref to the portable checkout and announces it once', async () => {
    expect(await runCli('install', '--target', 'codex')).toBeUndefined();
    expect(calls).toEqual([
      'header|Installing delphi-dev for codex',
      'step|Ref: v4.0.0-beta.1 (pre-release version of this package)',
      'runPortable|install|codex|{"target":"codex","ref":"v4.0.0-beta.1"}',
      'writeRefState|v4.0.0-beta.1|false|4.0.0-beta.1',
      'success|delphi-dev installed for codex — restart the agent session',
    ]);
  });

  it('--target all: announces the ref once and uses it for both parts', async () => {
    expect(await runCli('install', '--target', 'all')).toBeUndefined();
    expect(calls.filter((c) => c.startsWith('step|Ref:'))).toHaveLength(1);
    expect(calls).toContain('runPortable|install|codex+opencode|{"target":"all","ref":"v4.0.0-beta.1"}');
    expect(calls).toContain('installPlugin|{"ref":"v4.0.0-beta.1","unpin":false}');
  });

  it('--dry-run writes nothing and does not record the ref', async () => {
    expect(await runCli('install', '--dry-run')).toBeUndefined();
    expect(calls.some((c) => c.startsWith('installPlugin'))).toBe(false);
    expect(calls.some((c) => c.startsWith('writeRefState'))).toBe(false);
    expect(calls).toContain('step|[dry-run] would leave the plugin checkout on v4.0.0-beta.1');
  });

  it('an invalid --ref exits 1 before anything is installed', async () => {
    expect(await runCli('install', '--ref', '--upload-pack=x')).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatch(/^error\|.*--ref/);
  });

  it('a failed plugin install does not record the ref', async () => {
    state.pluginThrows = 'boom';
    await expect(runCli()).rejects.toThrow('boom');
    expect(calls.some((c) => c.startsWith('writeRefState'))).toBe(false);
  });
});

describe('install with a stable package', () => {
  beforeEach(() => { state.version = '4.0.0'; });

  it('--ref still works on a stable package', async () => {
    expect(await runCli('install', '--ref', 'v4.0.0-beta.1')).toBeUndefined();
    expect(calls).toContain('installPlugin|{"ref":"v4.0.0-beta.1","unpin":false}');
  });

  it('over a beta checkout it goes back to the stable line and clears the record', async () => {
    state.recorded = { ref: 'v4.0.0-beta.1', explicit: false };
    expect(await runCli()).toBeUndefined();
    expect(calls).toContain('step|Returning to the stable line (master): leaving the ref installed earlier');
    expect(calls).toContain('installPlugin|{"unpin":true}');
    expect(calls).toContain('clearRefState');
  });
});

describe('update', () => {
  it('a newer beta package moves the recorded beta ref forward', async () => {
    state.version = '4.0.0-beta.2';
    state.recorded = { ref: 'v4.0.0-beta.1', explicit: false };
    state.installed = ['codex'];
    expect(await runCli('update')).toBeUndefined();
    expect(calls).toEqual([
      'header|Updating delphi-dev',
      'step|Ref: v4.0.0-beta.2 (pre-release version of this package)',
      'step|Pulling latest plugin...',
      'installPlugin|{"ref":"v4.0.0-beta.2"}',
      'writeRefState|v4.0.0-beta.2|false|4.0.0-beta.2',
      'success|Plugin updated — restart your Claude Code session',
      'step|Updating codex...',
      'runPortable|install|codex|{"ref":"v4.0.0-beta.2"}',
      'writeRefState|v4.0.0-beta.2|false|4.0.0-beta.2',
      'success|Updated codex — restart the agent session',
    ]);
  });

  it('a stable package keeps the recorded ref instead of silently going back to master, and warns', async () => {
    state.version = '2.2.2';
    state.recorded = { ref: 'v4.0.0-beta.1', explicit: false };
    expect(await runCli('update')).toBeUndefined();
    expect(calls).toContain('installPlugin|{"ref":"v4.0.0-beta.1"}');
    expect(calls.find((c) => c.startsWith('warn|'))).toMatch(/keeps the ref recorded.*v4\.0\.0-beta\.1.*npx delphi-dev/);
  });

  it('update --ref overrides the record', async () => {
    state.recorded = { ref: 'v4.0.0-beta.1', explicit: false };
    expect(await runCli('update', '--ref', 'v4.0.0-beta.3')).toBeUndefined();
    expect(calls).toContain('installPlugin|{"ref":"v4.0.0-beta.3"}');
    expect(calls).toContain('writeRefState|v4.0.0-beta.3|true|4.0.0-beta.1');
  });

  it('an invalid --ref exits 1', async () => {
    expect(await runCli('update', '--ref', 'a b')).toBe(1);
    expect(calls.some((c) => c.startsWith('installPlugin'))).toBe(false);
  });
});
