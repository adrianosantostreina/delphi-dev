import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { REAL_ROOT } from './helpers';
import { lintRepo } from '../src/lint';

function walkMd(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walkMd(full);
    return e.name.endsWith('.md') ? [full] : [];
  });
}
const skillFiles = () => walkMd(path.join(REAL_ROOT, 'skills'));
const read = (rel: string) => fs.readFileSync(path.join(REAL_ROOT, ...rel.split('/')), 'utf8');

describe('rules live inside delphi-standards', () => {
  it('has no root rules/ folder and keeps the six rule files in the skill', () => {
    expect(fs.existsSync(path.join(REAL_ROOT, 'rules'))).toBe(false);
    for (const n of ['naming', 'architecture', 'forbidden', 'security', 'legacy', 'testing']) {
      expect(fs.existsSync(path.join(REAL_ROOT, 'skills/delphi-standards/references/rules', `${n}.md`))).toBe(true);
    }
  });

  it('no skill points at a root rules/ path', () => {
    for (const file of skillFiles()) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/(?:^|[\s`'"(\[])rules\/[A-Za-z0-9_.\-]+/m);
    }
  });

  it('legacy and spring4d name the skill that owns the rules', () => {
    expect(read('skills/delphi-legacy/SKILL.md')).toContain('ative a skill `delphi-standards` e leia `references/rules/legacy.md`');
    expect(read('skills/delphi-spring4d/SKILL.md')).toContain('`references/rules/architecture.md`');
  });
});

const KB_NOTATION =
  '> **Notação `kb:`** — `kb:core/arquivo.md` é um arquivo da base de conhecimento. Leia com `kb_get`\n' +
  '> (MCP `delphi-dev-kb`); sem ele, leia o arquivo direto: `core/arquivo.md` em\n' +
  '> `~/.delphi-dev/kb-cache/current/` e, se não estiver lá, em `knowledge/` na raiz do plugin\n' +
  '> (a pasta ao lado de `skills/`; instalado por `npx delphi-dev`: `~/.delphi-dev/plugin/knowledge/`).';

const contentFiles = (): string[] => [
  ...skillFiles(),
  ...walkMd(path.join(REAL_ROOT, 'commands')),
  ...walkMd(path.join(REAL_ROOT, 'agents')),
];

describe('kb: notation', () => {
  it('no skill, command or agent uses a raw knowledge/<tier>/ path', () => {
    for (const file of contentFiles()) {
      expect(fs.readFileSync(file, 'utf8'), file).not.toMatch(/knowledge\/(?:core|fmx|community)\//);
    }
  });

  it('no skill, command or agent builds a broken ../kb: link', () => {
    for (const file of contentFiles()) {
      expect(fs.readFileSync(file, 'utf8'), file).not.toMatch(/\]\([^)]*kb:/);
    }
  });

  it('every file that uses kb: carries the notation line exactly once', () => {
    let using = 0;
    for (const file of contentFiles()) {
      const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      if (!/`kb:(?:core|fmx|community)\//.test(text)) continue;
      using++;
      expect(text.split(KB_NOTATION).length - 1, file).toBe(1);
    }
    expect(using).toBeGreaterThanOrEqual(6);
  });
});

describe('neutral wording', () => {
  it('delphi-spec does not name a write tool', () => {
    expect(read('skills/delphi-spec/SKILL.md')).not.toContain('ferramenta Write');
  });

  it('delphi-contribute keeps its per-agent tool list behind the allow marker', () => {
    const text = read('skills/delphi-contribute/SKILL.md');
    const line = text.split('\n').find((l) => l.includes('AskUserQuestion'))!;
    expect(line).toContain('<!-- portability:allow tool-names -->');
  });

  it('new-project says the claudeignore step is Claude Code only', () => {
    expect(read('commands/new-project.md')).toContain('(somente no Claude Code; nos demais agentes, pule este passo)');
  });
});

describe('the real repository is portable', () => {
  it('has no lint findings', () => {
    const findings = lintRepo(REAL_ROOT);
    expect(findings.map((f) => `${f.file}:${f.line ?? 0} [${f.rule}] ${f.message}`)).toEqual([]);
  });
});

describe('encoding safety net', () => {
  it('delphi-encoding tells agents without hooks to run kb-cli fix-encoding', () => {
    const text = read('skills/delphi-encoding/SKILL.md');
    expect(text).toContain('## Sem hook ativo');
    expect(text).toContain('runtime/kb-cli.mjs" fix-encoding');
    expect(text).toContain('~/.delphi-dev/plugin');
  });
});
