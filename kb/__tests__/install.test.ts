import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { doctor, installTargets, manifestPath, uninstallTargets, type InstallOptions } from '../src/install/install';
import { MARKER } from '../src/install/fsops';
import { BLOCK_END, BLOCK_START } from '../src/targets/toml';
import { makeRepo, REAL_ROOT, tmpDir, writeTree } from './helpers';

const cmd = (id: string) => ({
  id, title: { 'pt-BR': id, 'en-US': id }, description: { 'pt-BR': id, 'en-US': id }, takesFile: false, icon: 'info',
});

function checkout(prefix?: string, extra: Record<string, string | null> = {}): string {
  return makeRepo({
    'portable.json': JSON.stringify({
      schema: 1, skills: { 'delphi-claudeignore': { targets: ['claude'] } }, commands: [cmd('audit'), cmd('about')],
    }),
    'skills/delphi-claudeignore/SKILL.md': '---\nname: delphi-claudeignore\ndescription: So Claude.\n---\n# C\n',
    'skills/delphi-demo/references/x.md': '# x\n',
    ...extra,
  }, prefix);
}

function opts(over: Partial<InstallOptions> = {}): InstallOptions {
  return {
    targets: ['codex', 'opencode'], scope: 'user', home: tmpDir('kb-home-'), checkout: checkout(),
    dryRun: false, force: false, env: {}, now: new Date('2026-10-15T10:00:00Z'), ...over,
  };
}

const read = (...p: string[]) => fs.readFileSync(path.join(...p), 'utf8');
const un = (o: InstallOptions, over: Partial<Parameters<typeof uninstallTargets>[0]> = {}) =>
  uninstallTargets({ targets: o.targets, home: o.home, dryRun: false, force: false, env: o.env, ...over });

/** Every file under `dir`, relative, with its content: a cheap "nothing changed" fingerprint. */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (current: string, rel: string): void => {
    for (const e of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, e.name);
      const key = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(full, key);
      else out[key] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(dir, '');
  return out;
}

describe('installTargets (user scope)', () => {
  it('writes the Codex artifacts', () => {
    const o = opts({ targets: ['codex'] });
    const report = installTargets(o);
    const skills = path.join(o.home, '.agents', 'skills');
    expect(fs.existsSync(path.join(skills, 'delphi-demo', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(skills, 'delphi-claudeignore'))).toBe(false);
    expect(read(skills, 'delphi-cmd-audit', 'SKILL.md')).toContain('name: delphi-cmd-audit');
    expect(read(skills, 'delphi-cmd-audit', 'agents', 'openai.yaml')).toContain('allow_implicit_invocation: false');
    expect(read(o.home, '.codex', 'agents', 'delphi-writer.toml')).toContain('name = "delphi-writer"');
    const toml = read(o.home, '.codex', 'config.toml');
    expect(toml).toContain(BLOCK_START);
    expect(toml).toContain('[mcp_servers.delphi-dev-kb]');
    const hooks = JSON.parse(read(o.home, '.codex', 'hooks.json'));
    expect(hooks.hooks.PostToolUse[0].matcher).toBe('apply_patch|Write|Edit');
    expect(hooks.hooks.UserPromptSubmit).toHaveLength(1);
    expect(report.skipped).toEqual([]);
  });

  it('writes the OpenCode artifacts', () => {
    const o = opts({ targets: ['opencode'] });
    installTargets(o);
    const cfg = path.join(o.home, '.config', 'opencode');
    expect(read(cfg, 'commands', 'delphi-audit.md')).toContain('description: ');
    expect(read(cfg, 'agents', 'delphi-writer.md')).toContain('mode: subagent');
    const json = JSON.parse(read(cfg, 'opencode.json'));
    expect(json.mcp['delphi-dev-kb'].command[0]).toBe('node');
    expect(json.mcp['delphi-dev-kb'].command[1].endsWith('/runtime/kb-mcp.mjs')).toBe(true);
    expect(read(cfg, 'plugins', 'delphi-dev.js')).toContain('tool.execute.after');
    expect(fs.existsSync(path.join(o.home, '.agents', 'skills', 'delphi-demo', MARKER))).toBe(true);
  });

  it('is idempotent', () => {
    const o = opts();
    installTargets(o);
    const before = snapshot(o.home);
    const again = installTargets(o);
    expect(again.written).toEqual([]);
    expect(again.skipped).toEqual([]);
    expect(again.warnings).toEqual([]);
    expect(again.unchanged).toBeGreaterThan(10);
    expect(snapshot(o.home)).toEqual(before);
  });

  it('puts forward-slash paths with spaces in every generated config', () => {
    const o = opts({ checkout: checkout('kb dir com espaco-') });
    installTargets(o);
    const normalized = o.checkout.replace(/\\/g, '/');
    expect(normalized).toContain(' ');
    expect(read(o.home, '.codex', 'config.toml')).toContain(`${normalized}/runtime/kb-mcp.mjs`);
    expect(read(o.home, '.config', 'opencode', 'opencode.json')).toContain(`${normalized}/runtime/kb-mcp.mjs`);
    expect(read(o.home, '.config', 'opencode', 'plugins', 'delphi-dev.js')).toContain(normalized);
    const hooks = JSON.parse(read(o.home, '.codex', 'hooks.json'));
    expect(hooks.hooks.UserPromptSubmit[0].hooks[0].command).toContain(`${normalized}/runtime/hook-inject.mjs`);
  });

  it('honors CODEX_HOME and XDG_CONFIG_HOME', () => {
    const codexHome = tmpDir('kb-codexhome-');
    const xdg = tmpDir('kb-xdg-');
    const o = opts({ env: { CODEX_HOME: codexHome, XDG_CONFIG_HOME: xdg } });
    installTargets(o);
    expect(fs.existsSync(path.join(codexHome, 'config.toml'))).toBe(true);
    expect(fs.existsSync(path.join(xdg, 'opencode', 'opencode.json'))).toBe(true);
    expect(fs.existsSync(path.join(o.home, '.codex'))).toBe(false);
  });

  it('dry-run writes nothing, not even the manifest', () => {
    const o = opts({ dryRun: true });
    const report = installTargets(o);
    expect(report.written.length).toBeGreaterThan(5);
    expect(fs.readdirSync(o.home)).toEqual([]);
  });

  it('dry-run on top of an existing install changes no byte', () => {
    const o = opts();
    installTargets(o);
    const target = path.join(o.home, '.config', 'opencode', 'agents', 'delphi-writer.md');
    fs.writeFileSync(target, 'minha versao');
    const before = snapshot(o.home);
    installTargets({ ...o, dryRun: true, force: true });
    expect(snapshot(o.home)).toEqual(before);
  });
});

describe('claude target', () => {
  it('only informs: nothing is written under the home', () => {
    const o = opts({ targets: ['claude'] });
    const report = installTargets(o);
    expect(fs.readdirSync(o.home)).toEqual([]);
    expect(report.written).toEqual([]);
    expect(report.notes.join('\n')).toContain('marketplace');
    expect(fs.existsSync(path.join(o.home, '.claude'))).toBe(false);
  });

  it('does not write ~/.claude even next to the other targets', () => {
    const o = opts({ targets: ['claude', 'codex', 'opencode'] });
    installTargets(o);
    expect(fs.existsSync(path.join(o.home, '.claude'))).toBe(false);
    expect(fs.existsSync(path.join(o.home, '.agents', 'skills', 'delphi-demo'))).toBe(true);
  });

  it('uninstall only informs and doctor validates the checkout', () => {
    const o = opts({ targets: ['claude'], checkout: REAL_ROOT });
    const report = un(o);
    expect(report.removed).toEqual([]);
    expect(report.notes.join('\n')).toContain('/plugin');
    const checks = doctor({ targets: ['claude'], home: o.home, env: {}, checkout: REAL_ROOT });
    expect(checks.every((c) => c.ok)).toBe(true);
    expect(fs.readdirSync(o.home)).toEqual([]);
    const broken = doctor({ targets: ['claude'], home: o.home, env: {}, checkout: tmpDir('kb-nada-') });
    expect(broken.some((c) => !c.ok)).toBe(true);
  });
});

describe('installTargets keeps what is not ours', () => {
  function userHome(): string {
    const home = tmpDir('kb-home-');
    writeTree(home, {
      '.codex/config.toml': 'model = "gpt-5"\n\n[mcp_servers.aws]\ncommand = "uvx"\n',
      '.codex/hooks.json': JSON.stringify({ hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo meu' }] }] } }),
      '.config/opencode/opencode.json': JSON.stringify({ provider: { x: {} }, mcp: { 'aws-mcp': { type: 'remote', url: 'https://a' } } }, null, 2),
      '.config/opencode/agents/delphi-reviewer.md': '---\ndescription: meu\nmode: subagent\n---\nmeu agente\n',
      '.agents/skills/aws-cdk/SKILL.md': '---\nname: aws-cdk\ndescription: x\n---\nde terceiros\n',
    });
    return home;
  }

  it('preserves user config, hooks, agents and foreign skills', () => {
    const home = userHome();
    installTargets(opts({ home }));
    expect(read(home, '.codex', 'config.toml').startsWith('model = "gpt-5"\n\n[mcp_servers.aws]\ncommand = "uvx"\n')).toBe(true);
    const hooks = JSON.parse(read(home, '.codex', 'hooks.json'));
    expect(hooks.hooks.PostToolUse[0].hooks[0].command).toBe('echo meu');
    expect(hooks.hooks.PostToolUse).toHaveLength(2);
    const oc = JSON.parse(read(home, '.config', 'opencode', 'opencode.json'));
    expect(oc.provider).toEqual({ x: {} });
    expect(Object.keys(oc.mcp)).toEqual(['aws-mcp', 'delphi-dev-kb']);
    expect(read(home, '.config', 'opencode', 'agents', 'delphi-reviewer.md')).toContain('meu agente');
    expect(read(home, '.agents', 'skills', 'aws-cdk', 'SKILL.md')).toContain('de terceiros');
    expect(fs.existsSync(path.join(home, '.agents', 'skills', 'aws-cdk', MARKER))).toBe(false);
  });

  it('does not duplicate a pre-existing mcp_servers.delphi-dev-kb table', () => {
    const home = tmpDir('kb-home-');
    const original = '[mcp_servers.delphi-dev-kb]\ncommand = "node"\nargs = ["/meu/caminho.mjs"]\n';
    writeTree(home, { '.codex/config.toml': original });
    const report = installTargets(opts({ home, targets: ['codex'] }));
    expect(read(home, '.codex', 'config.toml')).toBe(original);
    expect(report.warnings.join('\n')).toContain('mcp_servers.delphi-dev-kb');
  });

  it('refuses a config.toml with unbalanced markers, shows the spot and still installs the rest', () => {
    const home = tmpDir('kb-home-');
    const broken = `model = "gpt-5"\n\n${BLOCK_START}\n[mcp_servers.delphi-dev-kb]\ncommand = "node"\n`;
    writeTree(home, { '.codex/config.toml': broken });
    const report = installTargets(opts({ home, targets: ['codex'] }));
    expect(read(home, '.codex', 'config.toml')).toBe(broken);
    expect(report.warnings.join('\n')).toContain(BLOCK_START);
    expect(report.warnings.join('\n')).toContain('config.toml');
    expect(fs.existsSync(path.join(home, '.codex', 'agents', 'delphi-writer.toml'))).toBe(true);
    expect(fs.existsSync(path.join(home, '.codex', 'hooks.json'))).toBe(true);
    // an end marker without a start is just as unbalanced
    const orphan = tmpDir('kb-home-');
    writeTree(orphan, { '.codex/config.toml': `a = 1\n${BLOCK_START}\nx = 1\n${BLOCK_START}\ny = 2\n${BLOCK_END}\n` });
    const r2 = installTargets(opts({ home: orphan, targets: ['codex'] }));
    expect(r2.warnings.join('\n')).toContain('config.toml');
    expect(read(orphan, '.codex', 'config.toml')).toContain('y = 2');
  });

  it('refuses a JSONC opencode.json and prints what to add', () => {
    const home = tmpDir('kb-home-');
    const jsonc = '{\n  // meu\n  "provider": {}\n}\n';
    writeTree(home, { '.config/opencode/opencode.json': jsonc });
    const report = installTargets(opts({ home, targets: ['opencode'] }));
    expect(read(home, '.config', 'opencode', 'opencode.json')).toBe(jsonc);
    expect(report.warnings.join('\n')).toContain('delphi-dev-kb');
    expect(report.warnings.join('\n')).toContain('invalid-json');
    expect(fs.existsSync(path.join(home, '.config', 'opencode', 'plugins', 'delphi-dev.js'))).toBe(true);
  });

  it('refuses to replace a foreign mcp server with the same name', () => {
    const home = tmpDir('kb-home-');
    const original = JSON.stringify({ mcp: { 'delphi-dev-kb': { type: 'remote', url: 'https://x' } } });
    writeTree(home, { '.config/opencode/opencode.json': original });
    const report = installTargets(opts({ home, targets: ['opencode'] }));
    expect(read(home, '.config', 'opencode', 'opencode.json')).toBe(original);
    expect(report.warnings.join('\n')).toContain('conflict');
  });

  it('writes a backup of config files the first time it changes them', () => {
    const home = userHome();
    installTargets(opts({ home }));
    expect(read(home, '.codex', 'config.toml.delphi-dev.bak')).toBe('model = "gpt-5"\n\n[mcp_servers.aws]\ncommand = "uvx"\n');
  });

  it('reports a conflict and keeps installing every other item', () => {
    const home = tmpDir('kb-home-');
    const foreign = '---\ndescription: de outra pessoa\n---\nnao mexa\n';
    writeTree(home, {
      '.config/opencode/agents/delphi-writer.md': foreign,
      '.agents/skills/delphi-demo/SKILL.md': 'skill alheia\n',
    });
    const report = installTargets(opts({ home, targets: ['opencode'] }));
    expect(report.skipped.map((s) => s.reason).sort()).toEqual(['exists-not-owned', 'exists-not-owned']);
    expect(read(home, '.config', 'opencode', 'agents', 'delphi-writer.md')).toBe(foreign);
    expect(read(home, '.agents', 'skills', 'delphi-demo', 'SKILL.md')).toBe('skill alheia\n');
    expect(fs.existsSync(path.join(home, '.config', 'opencode', 'commands', 'delphi-audit.md'))).toBe(true);
    expect(fs.existsSync(path.join(home, '.config', 'opencode', 'plugins', 'delphi-dev.js'))).toBe(true);
    expect(fs.existsSync(path.join(home, '.agents', 'skills', 'delphi-claudeignore'))).toBe(false);
    // what was skipped is not ours: uninstall leaves it alone
    un(opts({ home, targets: ['opencode'] }));
    expect(read(home, '.config', 'opencode', 'agents', 'delphi-writer.md')).toBe(foreign);
    expect(read(home, '.agents', 'skills', 'delphi-demo', 'SKILL.md')).toBe('skill alheia\n');
  });

  it('--force replaces a foreign file after keeping a backup', () => {
    const home = tmpDir('kb-home-');
    const foreign = 'texto do usuario\n';
    const agent = path.join(home, '.config', 'opencode', 'agents', 'delphi-writer.md');
    writeTree(home, { '.config/opencode/agents/delphi-writer.md': foreign });
    const o = opts({ home, targets: ['opencode'], force: true });
    const report = installTargets(o);
    expect(report.skipped).toEqual([]);
    expect(read(agent)).toContain('mode: subagent');
    const backups = fs.readdirSync(path.dirname(agent)).filter((n) => n.startsWith('delphi-writer.md.bak-'));
    expect(backups).toHaveLength(1);
    expect(read(path.dirname(agent), backups[0])).toBe(foreign);
    expect(report.warnings.join('\n')).toContain('backup');
  });

  it('does not overwrite a file the user edited after install unless forced', () => {
    const o = opts({ targets: ['opencode'] });
    installTargets(o);
    const agent = path.join(o.home, '.config', 'opencode', 'agents', 'delphi-writer.md');
    fs.appendFileSync(agent, '\nminha nota\n');
    const again = installTargets(o);
    expect(again.skipped).toEqual([{ path: agent, reason: 'modified-by-user' }]);
    expect(read(agent)).toContain('minha nota');
    const forced = installTargets({ ...o, force: true });
    expect(forced.skipped).toEqual([]);
    expect(read(agent)).not.toContain('minha nota');
  });
});

describe('manifest', () => {
  it('treats a corrupt manifest as "owns nothing": keeps it aside, never deletes orphans', () => {
    const o = opts({ targets: ['opencode'] });
    installTargets(o);
    const file = manifestPath(o);
    fs.writeFileSync(file, '{ isto nao e json');
    // 1) uninstall with a corrupt manifest removes nothing
    const before = snapshot(o.home);
    const report = un(o);
    expect(report.removed).toEqual([]);
    expect(snapshot(o.home)).toEqual(before);
    // 2) a new install adopts identical files, keeps the corrupt manifest as a backup and writes a good one
    const again = installTargets(o);
    expect(again.skipped).toEqual([]);
    expect(again.warnings.join('\n')).toContain('manifesto');
    const aside = fs.readdirSync(path.dirname(file)).filter((n) => n.startsWith('install-manifest.json.bak-'));
    expect(aside).toHaveLength(1);
    expect(read(path.dirname(file), aside[0])).toBe('{ isto nao e json');
    expect(JSON.parse(read(file)).opencode.files.length).toBeGreaterThan(0);
  });

  it('keeps a lost manifest from wiping a skill the user edited', () => {
    const o = opts({ targets: ['codex'] });
    installTargets(o);
    const skill = path.join(o.home, '.agents', 'skills', 'delphi-demo', 'SKILL.md');
    fs.appendFileSync(skill, '\nminha nota\n');
    fs.rmSync(manifestPath(o));
    const report = installTargets(o);
    expect(report.skipped.map((s) => s.reason)).toContain('modified-by-user');
    expect(read(skill)).toContain('minha nota');
  });
});

describe('uninstallTargets', () => {
  it('restores the user files and removes only what it installed', () => {
    const home = tmpDir('kb-home-');
    const toml = 'model = "gpt-5"\n\n[mcp_servers.aws]\ncommand = "uvx"\n';
    const hooks = { hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo meu' }] }] } };
    const oc = { provider: { x: {} }, mcp: { 'aws-mcp': { type: 'remote', url: 'https://a' } } };
    writeTree(home, {
      '.codex/config.toml': toml,
      '.codex/hooks.json': JSON.stringify(hooks),
      '.config/opencode/opencode.json': JSON.stringify(oc),
      '.agents/skills/aws-cdk/SKILL.md': 'de terceiros',
    });
    const o = opts({ home });
    installTargets(o);
    const report = uninstallTargets({ targets: ['codex', 'opencode'], home, dryRun: false, force: false, env: {} });

    expect(read(home, '.codex', 'config.toml')).toBe(toml);
    expect(JSON.parse(read(home, '.codex', 'hooks.json'))).toEqual(hooks);
    expect(JSON.parse(read(home, '.config', 'opencode', 'opencode.json'))).toEqual(oc);
    expect(fs.existsSync(path.join(home, '.agents', 'skills', 'delphi-demo'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.agents', 'skills', 'delphi-cmd-audit'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.codex', 'agents', 'delphi-writer.toml'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.config', 'opencode', 'plugins', 'delphi-dev.js'))).toBe(false);
    expect(read(home, '.agents', 'skills', 'aws-cdk', 'SKILL.md')).toBe('de terceiros');
    expect(report.removed.length).toBeGreaterThan(5);
    expect(fs.existsSync(manifestPath({ home, env: {} }))).toBe(false);
  });

  it('dry-run removes nothing and keeps the manifest', () => {
    const o = opts();
    installTargets(o);
    const before = snapshot(o.home);
    const report = un(o, { dryRun: true });
    expect(report.removed.length).toBeGreaterThan(5);
    expect(snapshot(o.home)).toEqual(before);
  });

  it('keeps a file the user edited and warns', () => {
    const o = opts({ targets: ['opencode'] });
    installTargets(o);
    const file = path.join(o.home, '.config', 'opencode', 'agents', 'delphi-writer.md');
    fs.appendFileSync(file, '\nminha nota\n');
    const report = uninstallTargets({ targets: ['opencode'], home: o.home, dryRun: false, force: false, env: {} });
    expect(fs.existsSync(file)).toBe(true);
    expect(report.warnings.join('\n')).toContain(file);
  });

  it('keeps shared skills while the other target is still installed', () => {
    const o = opts();
    installTargets(o);
    uninstallTargets({ targets: ['codex'], home: o.home, dryRun: false, force: false, env: {} });
    expect(fs.existsSync(path.join(o.home, '.agents', 'skills', 'delphi-demo', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(o.home, '.agents', 'skills', 'delphi-cmd-audit'))).toBe(false);
    expect(fs.existsSync(path.join(o.home, '.config', 'opencode', 'commands', 'delphi-audit.md'))).toBe(true);
    // ... and goes away with the last target
    uninstallTargets({ targets: ['opencode'], home: o.home, dryRun: false, force: false, env: {} });
    expect(fs.existsSync(path.join(o.home, '.agents', 'skills', 'delphi-demo'))).toBe(false);
  });

  it('warns instead of guessing when the managed block markers are unbalanced', () => {
    const o = opts({ targets: ['codex'] });
    installTargets(o);
    const file = path.join(o.home, '.codex', 'config.toml');
    const broken = read(file).replace(BLOCK_END, '');
    fs.writeFileSync(file, broken);
    const report = un(o);
    expect(read(file)).toBe(broken);
    expect(report.warnings.join('\n')).toContain(file);
  });

  it('removes a config.toml that only held our block (the file was created by the install)', () => {
    const o = opts({ targets: ['codex'] });
    installTargets(o);
    un(o);
    expect(fs.existsSync(path.join(o.home, '.codex', 'config.toml'))).toBe(false);
  });
});

describe('project scope', () => {
  it('writes skills, agents and commands inside the project and nothing in the home', () => {
    const project = tmpDir('kb-proj-');
    const o = opts({ scope: 'project', project });
    installTargets(o);
    expect(fs.existsSync(path.join(project, '.agents', 'skills', 'delphi-demo', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(project, '.agents', 'skills', 'delphi-cmd-audit', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(project, '.codex', 'agents', 'delphi-writer.toml'))).toBe(true);
    expect(fs.existsSync(path.join(project, '.opencode', 'commands', 'delphi-audit.md'))).toBe(true);
    expect(fs.existsSync(path.join(project, '.opencode', 'agents', 'delphi-writer.md'))).toBe(true);
    expect(fs.existsSync(path.join(o.home, '.codex'))).toBe(false);
    expect(fs.existsSync(path.join(o.home, '.config'))).toBe(false);
  });

  it('requires --project', () => {
    expect(() => installTargets(opts({ scope: 'project' }))).toThrow(/--project/);
  });

  it('a later user-scope install does not forget the project files', () => {
    const project = tmpDir('kb-proj-');
    const home = tmpDir('kb-home-');
    const base = opts({ home, targets: ['opencode'] });
    installTargets({ ...base, scope: 'project', project });
    installTargets({ ...base, scope: 'user' });
    un(base);
    expect(fs.existsSync(path.join(project, '.opencode', 'agents', 'delphi-writer.md'))).toBe(false);
    expect(fs.existsSync(path.join(home, '.config', 'opencode', 'agents', 'delphi-writer.md'))).toBe(false);
  });
});

describe('doctor', () => {
  it('reports ok after an install and flags a manual edit', () => {
    const o = opts();
    installTargets(o);
    const env = {};
    expect(doctor({ targets: ['codex', 'opencode'], home: o.home, env }).every((c) => c.ok)).toBe(true);
    fs.appendFileSync(path.join(o.home, '.config', 'opencode', 'agents', 'delphi-writer.md'), 'x');
    const checks = doctor({ targets: ['opencode'], home: o.home, env });
    expect(checks.find((c) => c.name === 'sem alteracao manual')!.ok).toBe(false);
  });

  it('says nothing is installed on a clean home', () => {
    const checks = doctor({ targets: ['codex'], home: tmpDir('kb-home-'), env: {} });
    expect(checks).toEqual([{ target: 'codex', name: 'instalado', ok: false, detail: 'nada registrado no manifesto' }]);
  });
});

describe('Codex hook command (runs from the trusted checkout, keeps the project cwd of the payload)', () => {
  const winCmd = process.platform === 'win32';

  function fakeCheckout(): string {
    return checkout('kb check out-', {
      'runtime/hook-inject.mjs':
        "import fs from 'node:fs'; import path from 'node:path';\n"
        + "const p = JSON.parse(fs.readFileSync(0, 'utf8'));\n"
        + "fs.writeFileSync(path.join(p.cwd, 'seen.txt'), process.cwd());\n",
      'runtime/hook-fix-encoding.mjs': '',
    });
  }

  /** Node itself sets NoDefaultCurrentDirectoryInExePath=1; Codex (not Node) does not, so the test must undo it. */
  function shellEnv(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (key.toLowerCase() === 'nodefaultcurrentdirectoryinexepath') delete env[key];
    return env;
  }

  function installedCommand(o: InstallOptions): string {
    const hooks = JSON.parse(read(o.home, '.codex', 'hooks.json'));
    const hook = hooks.hooks.UserPromptSubmit[0].hooks[0];
    return winCmd ? hook.commandWindows : hook.command;
  }

  it('starts with a change to the checkout in both variants', () => {
    const o = opts({ targets: ['codex'], checkout: fakeCheckout() });
    installTargets(o);
    const hook = JSON.parse(read(o.home, '.codex', 'hooks.json')).hooks.PostToolUse[0].hooks[0];
    expect(hook.command).toMatch(/^cd '.*kb check out-[^']*' && /);
    expect(hook.commandWindows).toMatch(/^pushd ".*kb check out-[^"]*" && /);
    expect(hook.command.endsWith('exit 0')).toBe(true);
    expect(hook.commandWindows.endsWith('exit /b 0')).toBe(true);
  });

  it('executes: node runs inside the checkout while the payload cwd stays the project', () => {
    const o = opts({ targets: ['codex'], checkout: fakeCheckout() });
    installTargets(o);
    const project = tmpDir('kb proj hook-');
    execSync(installedCommand(o), { cwd: project, env: shellEnv(), input: JSON.stringify({ cwd: project, prompt: 'x' }), stdio: ['pipe', 'pipe', 'pipe'] });
    expect(fs.existsSync(path.join(project, 'seen.txt'))).toBe(true);
    expect(fs.realpathSync(read(project, 'seen.txt'))).toBe(fs.realpathSync(o.checkout));
  });

  it.runIf(winCmd)('does not run a node.cmd planted in the project directory (Windows searches the cwd first)', () => {
    const o = opts({ targets: ['codex'], checkout: fakeCheckout() });
    installTargets(o);
    const project = tmpDir('kb-proj-planted-');
    writeTree(project, { 'node.cmd': `@echo off\r\necho pwned> "${path.join(project, 'pwned.txt')}"\r\n` });
    // control: the same chain WITHOUT the change of directory does run the planted file
    execSync('where node >nul 2>nul && node -e "1" & exit /b 0', { cwd: project, env: shellEnv(), input: '{}', stdio: ['pipe', 'pipe', 'pipe'] });
    expect(fs.existsSync(path.join(project, 'pwned.txt'))).toBe(true);
    fs.rmSync(path.join(project, 'pwned.txt'));
    execSync(installedCommand(o), { cwd: project, env: shellEnv(), input: JSON.stringify({ cwd: project }), stdio: ['pipe', 'pipe', 'pipe'] });
    expect(fs.existsSync(path.join(project, 'pwned.txt'))).toBe(false);
    expect(fs.existsSync(path.join(project, 'seen.txt'))).toBe(true);
  });

  it('refuses to build a cmd line from a checkout path that cmd would expand', () => {
    const bad = checkout('kb%PATH%dir-');
    expect(path.basename(bad)).toContain('%');
    const o = opts({ targets: ['codex'], checkout: bad });
    const report = installTargets(o);
    expect(report.warnings.join('\n')).toContain('hooks.json');
    expect(fs.existsSync(path.join(o.home, '.codex', 'hooks.json'))).toBe(false);
  });
});

describe('the real repository', () => {
  it('installs every skill (but claudeignore), 11 command skills, 4 agents and 11 opencode commands', () => {
    const home = tmpDir('kb-home-');
    const report = installTargets({
      targets: ['codex', 'opencode'], scope: 'user', home, checkout: REAL_ROOT, dryRun: false, force: false, env: {},
    });
    expect(report.skipped).toEqual([]);
    expect(report.warnings).toEqual([]);

    const skillNames = fs.readdirSync(path.join(REAL_ROOT, 'skills'), { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name).filter((n) => n !== 'delphi-claudeignore');
    const skillsDir = path.join(home, '.agents', 'skills');
    for (const n of skillNames) expect(fs.existsSync(path.join(skillsDir, n, 'SKILL.md')), n).toBe(true);
    expect(fs.readdirSync(skillsDir).filter((n) => n.startsWith('delphi-cmd-'))).toHaveLength(11);
    expect(fs.readdirSync(path.join(home, '.codex', 'agents'))).toHaveLength(4);
    expect(fs.readdirSync(path.join(home, '.config', 'opencode', 'commands'))).toHaveLength(11);
    expect(fs.readdirSync(path.join(home, '.config', 'opencode', 'agents'))).toHaveLength(4);
    expect(doctor({ targets: ['codex', 'opencode'], home, env: {} }).every((c) => c.ok)).toBe(true);
  });
});
