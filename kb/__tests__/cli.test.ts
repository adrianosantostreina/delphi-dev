import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runCli, type CliIO } from '../src/cli';
import type { ContributeDeps } from '../src/contribute';
import { FIXTURE, makePluginRoot, tmpDir, writeTree } from './helpers';

function io(env: NodeJS.ProcessEnv = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const value: CliIO = { out: (l) => out.push(l), err: (l) => err.push(l), env };
  return { value, out, err };
}

// Fake deps for `contribute`: any real side effect is recorded and then throws, so a regression fails the test
// instead of acting on GitHub, the browser or the clipboard of whoever runs it.
function strictDeps(overrides: Partial<ContributeDeps> = {}) {
  const calls: string[] = [];
  const deps: ContributeDeps = {
    run: (cmd, args) => { calls.push(`run ${cmd} ${args.join(' ')}`); throw new Error('real side effect attempted in test'); },
    openUrl: (url) => { calls.push(`open ${url}`); throw new Error('real side effect attempted in test'); },
    copyToClipboard: () => { calls.push('clipboard'); throw new Error('real side effect attempted in test'); },
    now: new Date('2026-10-14T12:00:00Z'),
    ...overrides,
  };
  return { deps, calls };
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
    const { deps, calls } = strictDeps();
    run.value.contributeDeps = deps;
    expect(await runCli(['contribute', file], run.value)).toBe(2);
    expect(run.err.join('\n')).toContain('[conn-string]');
    expect(run.out).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('contribute falls back to the issue URL when gh is not authenticated', async () => {
    const file = path.join(tmpDir(), 'c.md');
    fs.writeFileSync(file, GOOD_DOC);
    const opened: string[] = [];
    const { deps, calls } = strictDeps({
      run: (cmd, args) => { calls.push(`run ${cmd} ${args.join(' ')}`); return { status: 1, stdout: '', stderr: '' }; },
      openUrl: (url) => { opened.push(url); },
      copyToClipboard: () => false,
    });
    const run = io();
    run.value.contributeDeps = deps;
    expect(await runCli(['contribute', file], run.value)).toBe(0);
    const result = JSON.parse(run.out[0]);
    expect(result.via).toBe('issue');
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatch(/^https:\/\/github\.com\/adrianosantostreina\/delphi-dev\/issues\/new\?template=kb-contribution\.yml/);
    expect(result.url).toBe(opened[0]);
    expect(calls).toEqual(['run gh auth status']);
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

  it('lints a repo and exits 1 with findings', async () => {
    const { makeRepo } = await import('./helpers');
    const clean = io();
    expect(await runCli(['lint', '--root', makeRepo()], clean.value)).toBe(0);
    expect(clean.out.at(-1)).toBe('0 achado(s) de portabilidade');

    const bad = io();
    const root = makeRepo({ 'commands/audit.md': null });
    expect(await runCli(['lint', '--root', root], bad.value)).toBe(1);
    expect(bad.out.join('\n')).toContain('[command-registry]');
  });

  it('fix-encoding adds the BOM to sources and reports what changed', async () => {
    const dir = tmpDir();
    const pas = path.join(dir, 'U.pas');
    const dfm = path.join(dir, 'F.dfm');
    fs.writeFileSync(pas, 'unit U;');
    fs.writeFileSync(dfm, "object F: TForm\n  Caption = 'Serviço'\nend");
    const run = io();
    expect(await runCli(['fix-encoding', pas, dfm], run.value)).toBe(0);
    expect(fs.readFileSync(pas)[0]).toBe(0xef);
    expect(fs.readFileSync(dfm, 'latin1')).toContain("Caption = 'Servi'#231'o'");
    expect(run.out).toEqual([`corrigido ${pas}`, `corrigido ${dfm}`, '2 arquivo(s) corrigido(s)']);

    const again = io();
    await runCli(['fix-encoding', pas], again.value);
    expect(again.out[0]).toBe(`ok ${pas}`);
  });

  it('fix-encoding reports a missing file on stderr and keeps going', async () => {
    const dir = tmpDir();
    const pas = path.join(dir, 'U.pas');
    fs.writeFileSync(pas, 'unit U;');
    const run = io();
    expect(await runCli(['fix-encoding', path.join(dir, 'nope.pas'), pas], run.value)).toBe(0);
    expect(run.err).toEqual([`nao encontrado: ${path.join(dir, 'nope.pas')}`]);
    expect(fs.readFileSync(pas)[0]).toBe(0xef);
  });

  it('fix-encoding without files is a usage error', async () => {
    const run = io();
    expect(await runCli(['fix-encoding'], run.value)).toBe(64);
  });

  describe('install / doctor / uninstall', () => {
    async function checkoutRoot(): Promise<string> {
      const { makeRepo } = await import('./helpers');
      return makeRepo();
    }
    const posix = (p: string) => p.split(path.sep).join('/');

    it('install --dry-run reports and writes nothing', async () => {
      const root = await checkoutRoot();
      const home = tmpDir();
      const run = io();
      const code = await runCli(['install', '--target', 'opencode', '--home', home, '--checkout', root, '--dry-run'], run.value);
      expect(code).toBe(0);
      expect(run.out.join('\n')).toContain('[dry-run]');
      expect(fs.readdirSync(home)).toEqual([]);
    });

    it('installs, diagnoses and uninstalls', async () => {
      const root = await checkoutRoot();
      const home = tmpDir();
      const install = io();
      expect(await runCli(['install', '--target', 'all', '--home', home, '--checkout', root], install.value)).toBe(0);
      expect(install.out.at(-1)).toMatch(/gravado\(s\)/);
      expect(fs.existsSync(path.join(home, '.config', 'opencode', 'commands', 'delphi-audit.md'))).toBe(true);

      const doc = io();
      expect(await runCli(['doctor', '--target', 'all', '--home', home], doc.value)).toBe(0);
      expect(doc.out.join('\n')).toContain('ok');
      expect(doc.out.join('\n')).not.toContain('FAIL');

      const un = io();
      expect(await runCli(['uninstall', '--target', 'all', '--home', home], un.value)).toBe(0);
      expect(fs.existsSync(path.join(home, '.config', 'opencode', 'commands', 'delphi-audit.md'))).toBe(false);
    });

    describe('exit code 2 = partial: something was refused or skipped on purpose', () => {
      const cases: [string, Record<string, string>][] = [
        ['opencode.jsonc (comments are not rewritten)', { '.config/opencode/opencode.jsonc': '{\n  // meu\n  "theme": "x"\n}\n' }],
        ['invalid opencode.json', { '.config/opencode/opencode.json': '{ nao e json' }],
        ['config.toml already owns [mcp_servers.delphi-dev-kb]', { '.codex/config.toml': '[mcp_servers.delphi-dev-kb]\ncommand = "x"\n' }],
        ['config.toml with an unterminated delphi-dev block', { '.codex/config.toml': '# >>> delphi-dev (gerenciado; nao edite entre os marcadores) >>>\nx = 1\n' }],
        ['a foreign file where one of ours goes', { '.config/opencode/agents/delphi-writer.md': 'do usuario\n' }],
        ['an invalid hooks.json', { '.codex/hooks.json': '{ quebrado' }],
      ];

      it.each(cases)('%s', async (_name, files) => {
        const home = tmpDir();
        writeTree(home, files);
        const run = io();
        const code = await runCli(['install', '--target', 'all', '--home', home, '--checkout', await checkoutRoot()], run.value);
        expect(code).toBe(2);
        expect(run.out.at(-1)).toMatch(/^\d+ item\(ns\) n\xe3o aplicado\(s\)/);
        // the rest of the install still happened
        expect(fs.existsSync(path.join(home, '.config', 'opencode', 'commands', 'delphi-audit.md'))).toBe(true);
        expect(fs.existsSync(path.join(home, '.delphi-dev', 'install-manifest.json'))).toBe(true);
      });

      it('a skip because the user edited our file is partial too; a clean run is 0 with no such line', async () => {
        const root = await checkoutRoot();
        const home = tmpDir();
        const clean = io();
        expect(await runCli(['install', '--target', 'all', '--home', home, '--checkout', root], clean.value)).toBe(0);
        expect(clean.out.join('\n')).not.toMatch(/n\xe3o aplicado/);
        fs.appendFileSync(path.join(home, '.config', 'opencode', 'agents', 'delphi-writer.md'), '\nminha nota\n');
        const again = io();
        expect(await runCli(['install', '--target', 'all', '--home', home, '--checkout', root], again.value)).toBe(2);
        expect(again.out.join('\n')).toContain('1 item(ns) n\xe3o aplicado(s)');
      });

      it('dry-run reports the same code, so CI can preview', async () => {
        const home = tmpDir();
        writeTree(home, { '.config/opencode/opencode.json': '{ nao e json' });
        expect(await runCli(['install', '--target', 'opencode', '--home', home, '--checkout', await checkoutRoot(), '--dry-run'], io().value)).toBe(2);
      });

      it('an execution error stays exit 1 (not 2)', async () => {
        expect(await runCli(['install', '--target', 'opencode', '--home', tmpDir(), '--checkout', tmpDir()], io().value)).toBe(1);
      });
    });

    it('accepts --from as an alias of --checkout', async () => {
      const home = tmpDir();
      const run = io();
      const code = await runCli(['install', '--target', 'opencode', '--home', home, '--from', await checkoutRoot()], run.value);
      expect(code).toBe(0);
      expect(fs.existsSync(path.join(home, '.config', 'opencode', 'commands', 'delphi-audit.md'))).toBe(true);
    });

    it('takes home, CODEX_HOME and XDG_CONFIG_HOME from the injected env, never from the real home', async () => {
      const root = await checkoutRoot();
      const home = tmpDir();
      const codexHome = tmpDir();
      const xdg = tmpDir();
      const env = { HOME: home, USERPROFILE: home, CODEX_HOME: codexHome, XDG_CONFIG_HOME: xdg };
      expect(await runCli(['install', '--target', 'all', '--checkout', root], io(env).value)).toBe(0);
      expect(fs.existsSync(path.join(codexHome, 'config.toml'))).toBe(true);
      expect(fs.existsSync(path.join(xdg, 'opencode', 'commands', 'delphi-audit.md'))).toBe(true);
      expect(fs.existsSync(path.join(home, '.agents', 'skills'))).toBe(true);
      expect(fs.existsSync(path.join(home, '.delphi-dev', 'install-manifest.json'))).toBe(true);
      expect(await runCli(['doctor', '--target', 'all'], io(env).value)).toBe(0);
      expect(await runCli(['uninstall', '--target', 'all'], io(env).value)).toBe(0);
      expect(fs.existsSync(path.join(home, '.delphi-dev', 'install-manifest.json'))).toBe(false);
    });

    it('uninstall --dry-run removes nothing', async () => {
      const root = await checkoutRoot();
      const home = tmpDir();
      await runCli(['install', '--target', 'opencode', '--home', home, '--checkout', root], io().value);
      const run = io();
      expect(await runCli(['uninstall', '--target', 'opencode', '--home', home, '--dry-run'], run.value)).toBe(0);
      expect(run.out.join('\n')).toContain('[dry-run]');
      expect(fs.existsSync(path.join(home, '.config', 'opencode', 'commands', 'delphi-audit.md'))).toBe(true);
    });

    it('doctor exits 1 when nothing is installed', async () => {
      const run = io();
      expect(await runCli(['doctor', '--target', 'codex', '--home', tmpDir()], run.value)).toBe(1);
      expect(run.out.join('\n')).toContain('FAIL');
    });

    it('project scope installs under the project and doctor marks the MCP check n/a', async () => {
      const root = await checkoutRoot();
      const home = tmpDir();
      const project = tmpDir();
      const args = ['--target', 'all', '--home', home];
      expect(await runCli(['install', ...args, '--scope', 'project', '--project', project, '--checkout', root], io().value)).toBe(0);
      expect(fs.existsSync(path.join(project, '.opencode', 'commands', 'delphi-audit.md'))).toBe(true);
      expect(fs.existsSync(path.join(home, '.config'))).toBe(false);
      const doc = io();
      expect(await runCli(['doctor', ...args, '--scope', 'project'], doc.value)).toBe(0);
      const text = doc.out.join('\n');
      expect(text).toContain('n/a');
      expect(text).not.toContain('FAIL');
      expect(await runCli(['doctor', ...args], io().value)).toBe(1);
    });

    it('explains that claude is not managed here and rejects unknown targets', async () => {
      const a = io();
      expect(await runCli(['install', '--target', 'claude', '--checkout', await checkoutRoot()], a.value)).toBe(64);
      expect(a.err.join('\n')).toContain('/plugin install');
      const b = io();
      expect(await runCli(['install', '--target', 'gemini'], b.value)).toBe(64);
      expect(await runCli(['uninstall', '--target', 'gemini'], io().value)).toBe(64);
      expect(await runCli(['doctor', '--target', 'gemini'], io().value)).toBe(64);
    });

    it('rejects a missing --project, a bad scope and an unknown flag', async () => {
      const run = io();
      const code = await runCli(['install', '--target', 'codex', '--scope', 'project', '--checkout', await checkoutRoot(), '--home', tmpDir()], run.value);
      expect(code).toBe(64);
      expect(run.err.join('\n')).toContain('--project');
      const scope = io();
      expect(await runCli(['install', '--target', 'codex', '--scope', 'team'], scope.value)).toBe(64);
      expect(scope.err.join('\n')).toContain('--scope');
      const flag = io();
      expect(await runCli(['install', '--bogus'], flag.value)).toBe(64);
      expect(flag.err.length).toBeGreaterThan(0);
    });

    it('an invalid checkout is a runtime failure (exit 1), not a crash', async () => {
      const run = io();
      expect(await runCli(['install', '--target', 'codex', '--home', tmpDir(), '--checkout', tmpDir()], run.value)).toBe(1);
      expect(run.err.join('\n')).toContain('checkout invalido');
    });

    it('prints the paths it wrote', async () => {
      const root = await checkoutRoot();
      const home = tmpDir();
      const run = io();
      await runCli(['install', '--target', 'opencode', '--home', home, '--checkout', root], run.value);
      expect(run.out.map(posix).join('\n')).toContain(posix(path.join(home, '.config', 'opencode', 'plugins', 'delphi-dev.js')));
    });
  });

  it('prints usage for an unknown command', async () => {
    const run = io();
    expect(await runCli(['bogus'], run.value)).toBe(64);
    expect(run.err[0]).toContain('usage');
  });
});
