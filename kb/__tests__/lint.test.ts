import { describe, it, expect } from 'vitest';
import { lintRepo } from '../src/lint';
import { makeRepo } from './helpers';

const rules = (root: string) => lintRepo(root).map((f) => f.rule);
const skill = (name: string, desc: string | null, body = '# T\n', extra = '') =>
  `---\nname: ${name}\n${desc === null ? '' : `description: ${desc}\n`}${extra}---\n${body}`;

describe('lintRepo', () => {
  it('passes a clean repo', () => {
    expect(lintRepo(makeRepo())).toEqual([]);
  });

  it('flags a skill whose folder and name differ', () => {
    const root = makeRepo({ 'skills/delphi-demo/SKILL.md': skill('outro-nome', 'Descricao.') });
    expect(rules(root)).toContain('skill-name');
  });

  it('flags an invalid skill name', () => {
    const root = makeRepo({ 'skills/Bad_Name/SKILL.md': skill('Bad_Name', 'Descricao.') });
    expect(rules(root)).toContain('skill-name');
  });

  it('flags a missing or oversized description', () => {
    expect(rules(makeRepo({ 'skills/delphi-demo/SKILL.md': skill('delphi-demo', null) }))).toContain('skill-description');
    const long = 'x'.repeat(1025);
    expect(rules(makeRepo({ 'skills/delphi-demo/SKILL.md': skill('delphi-demo', long) }))).toContain('skill-description');
  });

  it('flags claude-only frontmatter keys', () => {
    const root = makeRepo({ 'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'Descricao.', '# T\n', 'allowed-tools: Bash\n') });
    expect(rules(root)).toContain('skill-frontmatter');
  });

  it('flags agent-specific tool names with the line number', () => {
    const root = makeRepo({
      'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'Descricao.', '# T\n\nUse a ferramenta Write para gravar.\n'),
    });
    const f = lintRepo(root).find((x) => x.rule === 'tool-names')!;
    expect(f.file).toBe('skills/delphi-demo/SKILL.md');
    expect(f.line).toBe(7);
  });

  it('flags AskUserQuestion and honors the allow marker', () => {
    const body = '# T\n\nPergunte com AskUserQuestion.\n';
    expect(rules(makeRepo({ 'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'D.', body) }))).toContain('tool-names');
    const allowed = '# T\n\nPergunte com AskUserQuestion. <!-- portability:allow tool-names -->\n';
    expect(rules(makeRepo({ 'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'D.', allowed) }))).not.toContain('tool-names');
  });

  it('flags rules/ and knowledge/ references but not kb: or references/rules/', () => {
    const bad = '# T\n\nLeia `rules/naming.md`.\nLeia `knowledge/core/a.md`.\n';
    const r = lintRepo(makeRepo({ 'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'D.', bad) }));
    expect(r.filter((f) => f.rule === 'path-ref')).toHaveLength(2);
    const ok = '# T\n\nLeia `references/rules/naming.md` e `kb:core/a.md`.\n';
    expect(rules(makeRepo({
      'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'D.', ok),
      'skills/delphi-demo/references/rules/naming.md': '# n\n',
    }))).not.toContain('path-ref');
  });

  it('flags ../ only in SKILL.md', () => {
    const body = '# T\n\nVeja ../outra/SKILL.md.\n';
    expect(rules(makeRepo({ 'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'D.', body) }))).toContain('path-ref');
  });

  it('flags a references/ file that does not exist, unless another named skill has it', () => {
    const body = '# T\n\nLeia `references/faltando.md`.\n';
    expect(rules(makeRepo({ 'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'D.', body) }))).toContain('references-exist');

    const cross = '# T\n\nAtive a skill `delphi-outra` e leia `references/doc.md`.\n';
    expect(rules(makeRepo({
      'skills/delphi-demo/SKILL.md': skill('delphi-demo', 'D.', cross),
      'skills/delphi-outra/SKILL.md': skill('delphi-outra', 'D.'),
      'skills/delphi-outra/references/doc.md': '# d\n',
    }))).not.toContain('references-exist');
  });

  it('checks commands against the registry in both directions', () => {
    expect(rules(makeRepo({ 'commands/extra.md': '---\ndescription: x\n---\ny\n' }))).toContain('command-registry');
    expect(rules(makeRepo({ 'commands/audit.md': null }))).toContain('command-registry');
  });

  it('flags a registry entry with an empty title', () => {
    const reg = JSON.parse(JSON.stringify({
      schema: 1, skills: {},
      commands: [{ id: 'audit', title: { 'pt-BR': '', 'en-US': 'x' }, description: { 'pt-BR': 'a', 'en-US': 'b' }, takesFile: false, icon: 'i' },
        { id: 'about', title: { 'pt-BR': 'a', 'en-US': 'b' }, description: { 'pt-BR': 'a', 'en-US': 'b' }, takesFile: false, icon: 'i' }],
    }));
    expect(rules(makeRepo({ 'portable.json': JSON.stringify(reg) }))).toContain('command-registry');
  });

  it('flags an agent without a description', () => {
    expect(rules(makeRepo({ 'agents/delphi-writer.md': '---\nname: delphi-writer\n---\ncorpo\n' }))).toContain('agent-frontmatter');
  });

  it('flags versions that are out of sync', () => {
    const root = makeRepo({
      '.claude-plugin/marketplace.json': JSON.stringify({ plugins: [{ name: 'delphi-dev', version: '9.9.9' }] }),
    });
    expect(rules(root)).toContain('version-sync');
  });
});
