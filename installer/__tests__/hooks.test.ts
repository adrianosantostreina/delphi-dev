import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';

vi.mock('fs');
vi.mock('os');

const mockFs = vi.mocked(fs);
const mockOs = vi.mocked(os);

beforeEach(() => {
  mockOs.homedir.mockReturnValue('/home/user');
  vi.clearAllMocks();
  vi.resetModules();
});

describe('registerHooks', () => {
  it('creates hooks in empty settings file', async () => {
    mockFs.existsSync.mockReturnValue(false);
    let written = '';
    mockFs.writeFileSync.mockImplementation((_p: unknown, data: unknown) => { written = String(data); });

    const { registerHooks } = await import('../src/hooks');
    registerHooks();

    const parsed = JSON.parse(written);
    expect(parsed.hooks).toHaveProperty('SubagentStop');
    expect(parsed.hooks).toHaveProperty('Stop');
    expect(parsed.hooks).toHaveProperty('UserPromptSubmit');
    expect(parsed.hooks).toHaveProperty('PostToolUse');
  });

  it('does not overwrite existing hooks', async () => {
    const existing = { hooks: { PreToolUse: [{ matcher: '*', hooks: [] }] } };
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(existing));
    let written = '';
    mockFs.writeFileSync.mockImplementation((_p: unknown, data: unknown) => { written = String(data); });

    const { registerHooks } = await import('../src/hooks');
    registerHooks();

    const parsed = JSON.parse(written);
    expect(parsed.hooks).toHaveProperty('PreToolUse');
    expect(parsed.hooks).toHaveProperty('SubagentStop');
  });

  it('removeHooks strips only delphi hooks', async () => {
    const existing = {
      hooks: {
        SubagentStop: [{ matcher: '*', hooks: [] }],
        PreToolUse: [{ matcher: '*', hooks: [] }],
      }
    };
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(existing));
    let written = '';
    mockFs.writeFileSync.mockImplementation((_p: unknown, data: unknown) => { written = String(data); });

    const { removeHooks } = await import('../src/hooks');
    removeHooks();

    const parsed = JSON.parse(written);
    expect(parsed.hooks).not.toHaveProperty('SubagentStop');
    expect(parsed.hooks).toHaveProperty('PreToolUse');
  });
});

describe('removeHooks with third-party hooks on the same events', () => {
  const ours = (script: string) => ({
    type: 'command',
    command: `node "C:\\Users\\dev\\.claude\\plugins\\delphi-dev/${script}"`,
  });
  const theirs = { type: 'command', command: 'node "C:\\tools\\my-own-hook.js"' };

  async function runRemove(existing: unknown): Promise<Record<string, unknown[]>> {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(existing));
    let written = '';
    mockFs.writeFileSync.mockImplementation((_p: unknown, data: unknown) => { written = String(data); });

    const { removeHooks } = await import('../src/hooks');
    removeHooks();

    return JSON.parse(written).hooks;
  }

  it('keeps a user hook that lives in its own matcher group', async () => {
    const hooks = await runRemove({
      hooks: {
        UserPromptSubmit: [
          { matcher: '*', hooks: [ours('scripts/search.js')] },
          { matcher: '*', hooks: [theirs] },
        ],
      },
    });

    expect(hooks.UserPromptSubmit).toEqual([{ matcher: '*', hooks: [theirs] }]);
  });

  it('keeps a user hook that shares a matcher group with ours', async () => {
    const hooks = await runRemove({
      hooks: { PostToolUse: [{ matcher: 'Write|Edit', hooks: [ours('hooks/fix-encoding.js'), theirs] }] },
    });

    expect(hooks.PostToolUse).toEqual([{ matcher: 'Write|Edit', hooks: [theirs] }]);
  });

  it('drops the event when only delphi-dev hooks were there', async () => {
    const hooks = await runRemove({
      hooks: {
        Stop: [{ matcher: '*', hooks: [ours('scripts/capture.js') ] }],
        SubagentStop: [{ matcher: '*', hooks: [{ ...ours('scripts/capture.js'), command: ours('scripts/capture.js').command + ' --mode=agent' }] }],
      },
    });

    expect(hooks).not.toHaveProperty('Stop');
    expect(hooks).not.toHaveProperty('SubagentStop');
  });

  it('leaves settings without hooks untouched', async () => {
    const hooks = await runRemove({ theme: 'dark' });

    expect(hooks).toEqual({});
  });
});
