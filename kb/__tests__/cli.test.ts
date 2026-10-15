import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runCli, type CliIO } from '../src/cli';
import { FIXTURE, makePluginRoot, tmpDir, writeTree } from './helpers';

function io(env: NodeJS.ProcessEnv = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const value: CliIO = { out: (l) => out.push(l), err: (l) => err.push(l), env };
  return { value, out, err };
}

// No trailing whitespace: extractLearning() trims the issue field.
const GOOD_DOC = `---\ntitle: Dica\ncategory: bugs\ntags: a\nsource: community\n---\n# Dica\n\n${'texto '.repeat(50).trim()}`;

describe('kb-cli', () => {
  it('writes a manifest with the plugin version read next to knowledge/', async () => {
    const root = makePluginRoot(FIXTURE, '4.2.0');
    const out = path.join(tmpDir(), 'm.json');
    const code = await runCli(['manifest', path.join(root, 'knowledge'), '--commit', 'abcdef1', '--out', out], io().value);
    expect(code).toBe(0);
    const m = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(m).toMatchObject({ schema: 1, commit: 'abcdef1', pluginVersion: '4.2.0' });
    expect(m.files).toHaveLength(6);
  });

  it('validates community files and folders', async () => {
    const dir = tmpDir();
    writeTree(dir, { 'community/ok.md': GOOD_DOC, 'community/bad.md': '# sem frontmatter' });
    const okRun = io();
    expect(await runCli(['validate', path.join(dir, 'community', 'ok.md')], okRun.value)).toBe(0);
    const dirRun = io();
    expect(await runCli(['validate', path.join(dir, 'community')], dirRun.value)).toBe(1);
    expect(dirRun.err.join('\n')).toContain('bad.md');
  });

  it('contribute exits 2 on a secret without calling gh or opening a URL', async () => {
    const file = path.join(tmpDir(), 'c.md');
    fs.writeFileSync(file, GOOD_DOC + '\nPassword=Pr0d2026;\n');
    const run = io();
    expect(await runCli(['contribute', file], run.value)).toBe(2);
    expect(run.err.join('\n')).toContain('[conn-string]');
    expect(run.out).toEqual([]);
  });

  it('scans a file and exits 2 on findings', async () => {
    const file = path.join(tmpDir(), 'x.md');
    fs.writeFileSync(file, 'ok\nPwd=Segredo99;');
    const run = io();
    expect(await runCli(['scan', file], run.value)).toBe(2);
    expect(run.out[0]).toBe('line 2 [conn-string] Pwd=Segredo99;');
    fs.writeFileSync(file, 'limpo');
    expect(await runCli(['scan', file], io().value)).toBe(0);
  });

  it('lists similar documents for a contribution', async () => {
    const root = makePluginRoot(FIXTURE);
    const file = path.join(tmpDir(), 'c.md');
    fs.writeFileSync(file, '---\ntitle: class var e E2356\ntags: class var\n---\n# x');
    const run = io();
    expect(await runCli(['similar', file, '--knowledge', path.join(root, 'knowledge')], run.value)).toBe(0);
    expect(run.out.join('\n')).toContain('core/class-var.md');
  });

  it('turns an approved issue into a community file', async () => {
    const outDir = tmpDir();
    const run = io({
      ISSUE_BODY: `### Aprendizado / Learning\n\n${GOOD_DOC}\n\n### Confirmação / Consent\n\n- [X] ok`,
      ISSUE_NUMBER: '7',
      ISSUE_TITLE: 'kb: Dica ótima',
    });
    expect(await runCli(['issue-to-file', '--out-dir', outDir, '--date', '2026-10-14'], run.value)).toBe(0);
    expect(run.out[0]).toBe(path.join(outDir, '2026-10-14-issue-7-dica-otima.md').split(path.sep).join('/'));
    expect(fs.readFileSync(run.out[0], 'utf8')).toBe(GOOD_DOC);
  });

  it('fails on an issue without the learning section', async () => {
    const run = io({ ISSUE_BODY: 'nada', ISSUE_NUMBER: '8', ISSUE_TITLE: 't' });
    expect(await runCli(['issue-to-file', '--out-dir', tmpDir()], run.value)).toBe(1);
  });

  it('prints usage for an unknown command', async () => {
    const run = io();
    expect(await runCli(['bogus'], run.value)).toBe(64);
    expect(run.err[0]).toContain('usage');
  });
});
