import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  commandSkillName, invocationFor, opencodeCommandName, parseRegistry, readRegistry, skillTargets,
  validateRegistry, type Registry,
} from '../src/registry';
import { REAL_ROOT } from './helpers';

const good: Registry = {
  schema: 1,
  skills: { 'delphi-claudeignore': { targets: ['claude'] } },
  commands: [{
    id: 'new-project',
    title: { 'pt-BR': 'Novo projeto', 'en-US': 'New project' },
    description: { 'pt-BR': 'Estrutura padrao', 'en-US': 'Standard scaffold' },
    takesFile: false,
    icon: 'folder-opened',
  }],
};

describe('registry', () => {
  it('accepts a valid registry', () => {
    expect(validateRegistry(good)).toEqual([]);
    expect(parseRegistry(JSON.stringify(good))).toEqual(good);
  });

  it.each([
    ['schema', { ...good, schema: 2 }, 'schema'],
    ['target', { ...good, skills: { x: { targets: ['gemini'] } } }, 'targets'],
    ['id', { ...good, commands: [{ ...good.commands[0], id: 'Bad Id' }] }, 'id'],
    ['title', { ...good, commands: [{ ...good.commands[0], title: { 'pt-BR': '', 'en-US': 'x' } }] }, 'title'],
    ['duplicate', { ...good, commands: [good.commands[0], good.commands[0]] }, 'duplicate'],
    ['icon', { ...good, commands: [{ ...good.commands[0], icon: '' }] }, 'icon'],
  ])('rejects a registry with bad %s', (_n, input, fragment) => {
    const errors = validateRegistry(input);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('\n')).toContain(fragment);
    expect(() => parseRegistry(JSON.stringify(input))).toThrow();
  });

  it('derives the invocation of each target', () => {
    expect(invocationFor('claude', 'audit')).toBe('/audit');
    expect(invocationFor('codex', 'audit')).toBe('$delphi-cmd-audit');
    expect(invocationFor('opencode', 'audit')).toBe('/delphi-audit');
    expect(commandSkillName('new-project')).toBe('delphi-cmd-new-project');
    expect(opencodeCommandName('new-project')).toBe('delphi-new-project');
  });

  it('defaults a skill to every target and honors exclusions', () => {
    expect(skillTargets(good, 'delphi-write')).toEqual(['claude', 'codex', 'opencode']);
    expect(skillTargets(good, 'delphi-claudeignore')).toEqual(['claude']);
  });

  it('reads the real portable.json with the 11 plugin commands', () => {
    const reg = readRegistry(REAL_ROOT);
    expect(reg.commands.map((c) => c.id).sort()).toEqual([
      'about', 'audit', 'contribute-kb', 'dashboard', 'e2e', 'new-project', 'review', 'spec', 'tdd', 'update', 'write',
    ]);
    expect(reg.skills['delphi-claudeignore']?.targets).toEqual(['claude']);
    expect(fs.existsSync(path.join(REAL_ROOT, 'portable.json'))).toBe(true);
  });
});
