import { describe, it, expect, vi, afterEach } from 'vitest';
import { detectSystem, type SystemInfo } from '../src/detect';
import { execSync } from 'child_process';

vi.mock('child_process');

const mockExecSync = vi.mocked(execSync);

afterEach(() => vi.clearAllMocks());

describe('detectSystem', () => {
  it('returns hasClaudeCLI=true when claude CLI is found', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (String(cmd).includes('claude')) return Buffer.from('1.0.0');
      throw new Error('not found');
    });
    const info: SystemInfo = detectSystem();
    expect(info.hasClaudeCLI).toBe(true);
  });

  it('returns hasClaudeCLI=false when claude CLI throws', () => {
    mockExecSync.mockImplementation(() => { throw new Error('not found'); });
    const info = detectSystem();
    expect(info.hasClaudeCLI).toBe(false);
  });

  it('returns hasVSCode=true when code CLI is found', () => {
    mockExecSync.mockImplementation((cmd: string) => {
      if (String(cmd).includes('code')) return Buffer.from('1.88.0');
      throw new Error('not found');
    });
    const info = detectSystem();
    expect(info.hasVSCode).toBe(true);
  });

  it('includes node version', () => {
    mockExecSync.mockReturnValue(Buffer.from(''));
    const info = detectSystem();
    expect(info.nodeVersion).toBe(process.version);
  });
});
