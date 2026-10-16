import { describe, it, expect } from 'vitest';
import { findOnPath } from '../src/agents/which';

const files = (...list: string[]) => (f: string) => list.includes(f);

describe('findOnPath', () => {
  it('finds a binary in a PATH entry with spaces (Windows)', () => {
    const env = { Path: 'C:\\Windows;C:\\Program Files\\OpenCode\\bin', PATHEXT: '.COM;.EXE;.CMD' };
    expect(findOnPath('opencode', { env, platform: 'win32', exists: files('C:\\Program Files\\OpenCode\\bin\\opencode.CMD') })).toBe(true);
  });

  it('tries every PATHEXT extension, in any case of the variable name', () => {
    const env = { PATH: 'C:\\npm', pathext: '.EXE;.BAT;.CMD' };
    expect(findOnPath('opencode', { env, platform: 'win32', exists: files('C:\\npm\\opencode.BAT') })).toBe(true);
    expect(findOnPath('opencode', { env, platform: 'win32', exists: files('C:\\npm\\opencode.PS1') })).toBe(false);
  });

  it('falls back to the default PATHEXT and accepts a command that already carries an extension', () => {
    const env = { PATH: 'C:\\npm' };
    expect(findOnPath('opencode', { env, platform: 'win32', exists: files('C:\\npm\\opencode.EXE') })).toBe(true);
    expect(findOnPath('opencode.exe', { env, platform: 'win32', exists: files('C:\\npm\\opencode.exe') })).toBe(true);
  });

  it('strips quotes around a Windows PATH entry', () => {
    const env = { PATH: '"C:\\Program Files\\x"', PATHEXT: '.EXE' };
    expect(findOnPath('codex', { env, platform: 'win32', exists: files('C:\\Program Files\\x\\codex.EXE') })).toBe(true);
  });

  it('ignores empty entries', () => {
    const seen: string[] = [];
    const env = { PATH: '::/usr/bin:' };
    expect(findOnPath('opencode', { env, platform: 'linux', exists: (f) => (seen.push(f), false) })).toBe(false);
    expect(seen).toEqual(['/usr/bin/opencode']);
  });

  it('never searches the current directory ("." or a relative entry)', () => {
    const seen: string[] = [];
    const env = { PATH: '.:bin:/usr/bin' };
    findOnPath('opencode', { env, platform: 'linux', exists: (f) => (seen.push(f), false) });
    expect(seen).toEqual(['/usr/bin/opencode']);
    const winSeen: string[] = [];
    findOnPath('opencode', { env: { PATH: '.;;C:\\bin', PATHEXT: '.EXE' }, platform: 'win32', exists: (f) => (winSeen.push(f), false) });
    expect(winSeen).toEqual(['C:\\bin\\opencode.EXE']);
  });

  it('finds a POSIX binary and reports nothing found otherwise', () => {
    const env = { PATH: '/usr/local/bin:/usr/bin' };
    expect(findOnPath('opencode', { env, platform: 'linux', exists: files('/usr/bin/opencode') })).toBe(true);
    expect(findOnPath('opencode', { env, platform: 'linux', exists: () => false })).toBe(false);
    expect(findOnPath('opencode', { env: {}, platform: 'linux', exists: () => true })).toBe(false);
  });

  it('refuses names that carry a path', () => {
    const env = { PATH: '/usr/bin' };
    expect(findOnPath('../opencode', { env, platform: 'linux', exists: () => true })).toBe(false);
    expect(findOnPath('a\\b', { env, platform: 'linux', exists: () => true })).toBe(false);
    expect(findOnPath('', { env, platform: 'linux', exists: () => true })).toBe(false);
  });
});
