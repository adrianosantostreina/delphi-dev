import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { installCommandFor, pluginPresent } from '../src/agents/presence';

const present = (...paths: string[]) => (p: string) => paths.map((x) => path.normalize(x)).includes(path.normalize(p));
const home = path.join('/h', 'u');

describe('pluginPresent', () => {
  it('cannot tell for Claude Code (marketplace install)', () => {
    expect(pluginPresent('claude', home, {}, () => false)).toBeUndefined();
  });

  it('finds the Codex command skill in the user folder or in the project', () => {
    const user = path.join(home, '.agents', 'skills', 'delphi-cmd-audit', 'SKILL.md');
    expect(pluginPresent('codex', home, {}, present(user))).toBe(true);
    expect(pluginPresent('codex', home, {}, present())).toBe(false);
    const proj = path.join('/p', '.agents', 'skills', 'delphi-cmd-audit', 'SKILL.md');
    expect(pluginPresent('codex', home, {}, present(proj), '/p')).toBe(true);
  });

  it('finds the OpenCode command in the config folder, honoring XDG_CONFIG_HOME', () => {
    const def = path.join(home, '.config', 'opencode', 'commands', 'delphi-audit.md');
    expect(pluginPresent('opencode', home, {}, present(def))).toBe(true);
    const xdg = path.join('/x', 'opencode', 'commands', 'delphi-audit.md');
    expect(pluginPresent('opencode', home, { XDG_CONFIG_HOME: '/x' }, present(xdg))).toBe(true);
    expect(pluginPresent('opencode', home, {}, present())).toBe(false);
  });

  it('finds the OpenCode command in the project folder', () => {
    const proj = path.join('/p', '.opencode', 'commands', 'delphi-audit.md');
    expect(pluginPresent('opencode', home, {}, present(proj), '/p')).toBe(true);
  });

  it('suggests the installer command', () => {
    expect(installCommandFor('codex')).toBe('npx delphi-dev --target codex');
    expect(installCommandFor('opencode')).toBe('npx delphi-dev --target opencode');
  });
});
