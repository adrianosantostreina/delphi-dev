import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { cleanDescription, parseAgent, toCodexToml, toOpencodeAgent, tomlString } from '../src/targets/agents';
import { readFrontmatter } from '../src/frontmatter';
import { REAL_ROOT } from './helpers';

const AGENTS_DIR = path.join(REAL_ROOT, 'agents');
const real = (name: string) => parseAgent(fs.readFileSync(path.join(AGENTS_DIR, `${name}.md`), 'utf8'));

/** Strict reader for the exact shape toCodexToml emits (3 keys; basic string or literal multiline). */
function readCodexToml(text: string): Record<string, string> {
  const m = text.match(/^name = (".*")\ndescription = (".*")\ndeveloper_instructions = ('''\n[\s\S]*\n'''|".*")\n$/);
  if (!m) throw new Error('unexpected TOML shape');
  const instr = m[3].startsWith("'''") ? m[3].slice(4, -4) : JSON.parse(m[3]);
  return { name: JSON.parse(m[1]), description: JSON.parse(m[2]), developer_instructions: instr };
}

describe('cleanDescription', () => {
  it('cuts at the first <example> or Exemplos: and collapses whitespace', () => {
    const raw = 'Subagente  especializado\n  em Delphi. Exemplos: <example>Context: x</example>';
    expect(cleanDescription(raw)).toBe('Subagente especializado em Delphi.');
    expect(cleanDescription('Faz X. <example>y</example>')).toBe('Faz X.');
  });

  it('caps at the limit on a word boundary', () => {
    const out = cleanDescription('palavra '.repeat(200), 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith('...')).toBe(true);
    expect(out).not.toMatch(/palav\.\.\.$/);
  });
});

describe('parseAgent name safety (the name becomes a file name in the user config)', () => {
  const agent = (name: string) => `---\nname: ${name}\ndescription: x\n---\ncorpo\n`;

  it.each(['../../../pwned', '..', 'a/b', 'a\\b', '/abs', 'C:evil', 'Upper', '-lead', 'sp ace'])('rejects %j', (name) => {
    expect(() => parseAgent(agent(name))).toThrow(/name/);
  });

  it('accepts lowercase kebab-case names', () => {
    expect(parseAgent(agent('delphi-writer')).name).toBe('delphi-writer');
    expect(parseAgent(agent('a1-b2')).name).toBe('a1-b2');
  });
});

describe('tomlString', () => {
  it('uses a literal multiline string when it is safe', () => {
    expect(tomlString('a\\b "c"')).toBe("'''\na\\b \"c\"\n'''");
  });

  it("falls back to an escaped basic string when the body contains '''", () => {
    expect(tomlString("tem ''' aqui\nlinha")).toBe(JSON.stringify("tem ''' aqui\nlinha"));
  });

  it('escapes DEL and control characters through the basic string', () => {
    expect(tomlString(`a${String.fromCharCode(1)}b`)).toBe('"a\\u0001b"');
    expect(tomlString(`a${String.fromCharCode(127)}b`)).toBe('"a\\u007fb"');
  });

  it('never leaves a lone carriage return in a literal multiline string', () => {
    expect(tomlString('a\rb')).toBe('"a\\rb"');
  });
});

describe('hostile agent content', () => {
  const hostile = {
    name: 'delphi-x',
    description: 'Usa "aspas", C:\\dir\\sub e \'\'\' aqui. Exemplos: <example>nao entra</example>',
    body: 'Corpo com \'\'\' e \\n literal, "aspas" e C:\\Users\\x\n\n  indentado\n',
  };

  it('produces TOML whose values round-trip', () => {
    const parsed = readCodexToml(toCodexToml(hostile));
    expect(parsed.name).toBe('delphi-x');
    expect(parsed.description).toBe('Usa "aspas", C:\\dir\\sub e \'\'\' aqui.');
    expect(parsed.developer_instructions).toBe(hostile.body);
  });

  it('produces an OpenCode frontmatter that stays a single quoted line', () => {
    const md = toOpencodeAgent(hostile);
    const fm = readFrontmatter(md);
    expect(fm.keys).toEqual(['description', 'mode']);
    expect(fm.data.mode).toBe('subagent');
    expect(md.split('\n')[1]).toMatch(/^description: ".*"$/);
  });

  it('is deterministic and does not mutate its input', () => {
    const copy = JSON.stringify(hostile);
    expect(toCodexToml(hostile)).toBe(toCodexToml(hostile));
    expect(toOpencodeAgent(hostile)).toBe(toOpencodeAgent(hostile));
    expect(JSON.stringify(hostile)).toBe(copy);
  });
});

describe('real agents', () => {
  it.each(['delphi-auditor', 'delphi-spec-writer', 'delphi-tester', 'delphi-writer'])('converts %s', (name) => {
    const agent = real(name);
    expect(agent.name).toBe(name);
    const toml = toCodexToml(agent);
    expect(toml).toContain(`name = "${name}"`);
    expect(toml).toContain("developer_instructions = '''");
    expect(toml).not.toContain('<example>');
    const description = toml.split('\n').find((l) => l.startsWith('description = '))!;
    expect(description.length).toBeLessThan(700);

    const md = toOpencodeAgent(agent);
    expect(md.startsWith('---\ndescription: "')).toBe(true);
    expect(md).toContain('\nmode: subagent\n---\n');
    expect(md).not.toContain('model: inherit');
    expect(md).toContain(agent.body.split('\n')[0]);
  });

  it('round-trips the whole instruction body of every real agent through the TOML', () => {
    const files = fs.readdirSync(AGENTS_DIR).filter((n) => n.endsWith('.md'));
    expect(files.length).toBe(4);
    for (const file of files) {
      const agent = parseAgent(fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8'));
      expect(agent.name).toBe(file.slice(0, -3));
      const parsed = readCodexToml(toCodexToml(agent));
      expect(parsed.name).toBe(agent.name);
      expect(parsed.developer_instructions).toBe(agent.body);
      expect(parsed.description.length).toBeGreaterThan(20);
      expect(parsed.description).not.toMatch(/Exemplos?:|<example>/);
    }
  });

  it('keeps the writer -> tester delegation text', () => {
    expect(real('delphi-writer').body).toContain('delphi-tester');
  });

  it('does not touch the source files', () => {
    const read = () => fs.readdirSync(AGENTS_DIR).map((n) => fs.readFileSync(path.join(AGENTS_DIR, n), 'utf8'));
    const before = read();
    for (const raw of before) {
      const a = parseAgent(raw);
      toCodexToml(a);
      toOpencodeAgent(a);
    }
    expect(read()).toEqual(before);
  });
});
