import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseCommand, toCodexCommandSkill, toOpencodeCommand } from '../src/targets/commands';
import { readFrontmatter } from '../src/frontmatter';
import { commandSkillName, opencodeCommandName, readRegistry } from '../src/registry';
import { REAL_ROOT } from './helpers';

const raw = '---\ndescription: Auditar o projeto: com "aspas"\n---\n\nAuditar $ARGUMENTS agora.\n';
const COMMANDS_DIR = path.join(REAL_ROOT, 'commands');

describe('command converters', () => {
  it('parses description and body', () => {
    expect(parseCommand('audit', raw)).toEqual({
      id: 'audit',
      description: 'Auditar o projeto: com "aspas"',
      body: 'Auditar $ARGUMENTS agora.',
    });
    expect(() => parseCommand('x', '---\n---\ncorpo')).toThrow();
  });

  it('builds a Codex skill that is explicit-only and yaml-safe', () => {
    const out = toCodexCommandSkill(parseCommand('audit', raw));
    expect(out.name).toBe('delphi-cmd-audit');
    const fm = readFrontmatter(out.skillMd);
    expect(fm.data.name).toBe('delphi-cmd-audit');
    expect(fm.data.description).toContain('Comando /audit do delphi-dev');
    expect(fm.data.description).toContain('Auditar o projeto: com');
    expect(fm.body).toContain('Auditar o que o usu');
    expect(fm.body).not.toContain('$ARGUMENTS');
    expect(out.openaiYaml).toBe('policy:\n  allow_implicit_invocation: false\n');
  });

  it('writes the Codex description as a JSON (YAML-compatible) double-quoted scalar', () => {
    const out = toCodexCommandSkill(parseCommand('audit', raw));
    const line = out.skillMd.split('\n')[2];
    expect(line.startsWith('description: "')).toBe(true);
    const value = JSON.parse(line.slice('description: '.length)) as string;
    expect(value).toBe('Comando /audit do delphi-dev (chamada explícita). Auditar o projeto: com "aspas"');
  });

  it('builds the OpenCode command with only description in the frontmatter', () => {
    const out = toOpencodeCommand(parseCommand('new-project', raw));
    expect(out.fileName).toBe('delphi-new-project.md');
    expect(out.text).toBe('---\ndescription: "Auditar o projeto: com \\"aspas\\""\n---\n\nAuditar $ARGUMENTS agora.\n');
  });

  it('collapses a multi-line description into one line', () => {
    const multi = '---\ndescription: |\n  Linha um\n  linha dois\n---\ncorpo\n';
    expect(parseCommand('x', multi).description).toBe('Linha um linha dois');
  });

  it('is deterministic', () => {
    const def = parseCommand('audit', raw);
    expect(toCodexCommandSkill(def)).toEqual(toCodexCommandSkill(def));
    expect(toOpencodeCommand(def)).toEqual(toOpencodeCommand(def));
  });
});

describe('real commands', () => {
  const files = fs.readdirSync(COMMANDS_DIR).filter((n) => n.endsWith('.md'));

  it('converts every real command', () => {
    expect(files.length).toBe(11);
    for (const file of files) {
      const def = parseCommand(file.slice(0, -3), fs.readFileSync(path.join(COMMANDS_DIR, file), 'utf8'));
      const skill = toCodexCommandSkill(def);
      expect(readFrontmatter(skill.skillMd).data.description.length).toBeLessThanOrEqual(1024);
      expect(toOpencodeCommand(def).text.length).toBeGreaterThan(50);
    }
  });

  it('derives skill and command names from the registry ids', () => {
    const reg = readRegistry(REAL_ROOT);
    expect(reg.commands.map((c) => c.id).sort()).toEqual(files.map((f) => f.slice(0, -3)).sort());
    for (const cmd of reg.commands) {
      const raw = fs.readFileSync(path.join(COMMANDS_DIR, `${cmd.id}.md`), 'utf8');
      const def = parseCommand(cmd.id, raw);
      const skill = toCodexCommandSkill(def);
      expect(skill.name).toBe(commandSkillName(cmd.id));
      expect(readFrontmatter(skill.skillMd).data.name).toBe(`delphi-cmd-${cmd.id}`);
      expect(toOpencodeCommand(def).fileName).toBe(`${opencodeCommandName(cmd.id)}.md`);
    }
  });

  it('keeps the original body intact in both targets (no $ARGUMENTS in the real commands)', () => {
    for (const file of files) {
      const def = parseCommand(file.slice(0, -3), fs.readFileSync(path.join(COMMANDS_DIR, file), 'utf8'));
      expect(def.body).not.toContain('$ARGUMENTS');
      expect(readFrontmatter(toCodexCommandSkill(def).skillMd).body.replace(/^\n+/, '').trimEnd()).toBe(def.body);
      expect(readFrontmatter(toOpencodeCommand(def).text).body.replace(/^\n+/, '').trimEnd()).toBe(def.body);
    }
  });

  it('emits an OpenCode frontmatter with only the description key', () => {
    for (const file of files) {
      const def = parseCommand(file.slice(0, -3), fs.readFileSync(path.join(COMMANDS_DIR, file), 'utf8'));
      const fm = readFrontmatter(toOpencodeCommand(def).text);
      expect(fm.keys).toEqual(['description']);
    }
  });

  it('does not touch the source files', () => {
    const read = () => files.map((n) => fs.readFileSync(path.join(COMMANDS_DIR, n), 'utf8'));
    const before = read();
    files.forEach((n, i) => {
      const def = parseCommand(n.slice(0, -3), before[i]);
      toCodexCommandSkill(def);
      toOpencodeCommand(def);
    });
    expect(read()).toEqual(before);
  });
});
