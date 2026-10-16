import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { REAL_ROOT } from './helpers';

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
