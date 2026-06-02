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
