import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  detectTargets, ensureCheckout, installedPortableTargets, kbCliArgs, manifestFile, resolveTargets, REPO_URL, type Probe,
} from '../src/targets';

function probe(over: Partial<Probe> & { commands?: string[]; paths?: string[] } = {}): Probe {
  const commands = over.commands ?? [];
  const paths = over.paths ?? [];
  return {
    commandExists: (cmd) => commands.some((c) => cmd.startsWith(c)),
    pathExists: (p) => paths.includes(p.replace(/\\/g, '/')),
    home: '/home/u',
    vscodeExtensions: over.vscodeExtensions ?? [],
  };
}

describe('detectTargets', () => {
  it('finds nothing on a bare machine', () => {
    expect(detectTargets(probe())).toEqual({ claude: false, codex: false, opencode: false });
  });

  it('detects by CLI, by config folder and by VS Code extension', () => {
    expect(detectTargets(probe({ commands: ['claude'] })).claude).toBe(true);
    expect(detectTargets(probe({ paths: ['/home/u/.codex'] })).codex).toBe(true);
    expect(detectTargets(probe({ vscodeExtensions: ['openai.chatgpt'] })).codex).toBe(true);
    expect(detectTargets(probe({ commands: ['opencode'] })).opencode).toBe(true);
    expect(detectTargets(probe({ paths: ['/home/u/.config/opencode'] })).opencode).toBe(true);
    expect(detectTargets(probe({ vscodeExtensions: ['sst-dev.opencode'] })).opencode).toBe(true);
  });
});

describe('resolveTargets', () => {
  const detected = { claude: true, codex: false, opencode: true };
  it('uses what was detected when there is no flag', () => {
    expect(resolveTargets(undefined, detected)).toEqual(['claude', 'opencode']);
  });
  it('all means every target, detected or not', () => {
    expect(resolveTargets('all', detected)).toEqual(['claude', 'codex', 'opencode']);
  });
  it('accepts a comma list and rejects unknown names', () => {
    expect(resolveTargets('codex, opencode', detected)).toEqual(['codex', 'opencode']);
    expect(() => resolveTargets('gemini', detected)).toThrow(/gemini/);
  });
  it('drops duplicates and keeps a stable order', () => {
    expect(resolveTargets('opencode,codex,opencode', detected)).toEqual(['codex', 'opencode']);
  });
  it('rejects an empty list', () => {
    expect(() => resolveTargets(' , ', detected)).toThrow(/--target/);
  });
});

describe('ensureCheckout', () => {
  const dest = path.join('/h', '.delphi-dev', 'plugin');

  it('clones when there is no checkout', () => {
    const calls: string[][] = [];
    const out = ensureCheckout(dest, undefined, { run: (c, a) => { calls.push([c, ...a]); return { status: 0 }; }, exists: () => false });
    expect(out).toBe(dest);
    expect(calls).toEqual([['git', 'clone', '--depth=1', REPO_URL, dest]]);
  });

  it('pulls when it exists and survives an offline pull', () => {
    const calls: string[][] = [];
    const out = ensureCheckout(dest, undefined, {
      run: (c, a) => { calls.push([c, ...a]); return { status: 1 }; },
      exists: (p) => p === path.join(dest, '.git'),
    });
    expect(out).toBe(dest);
    expect(calls).toEqual([['git', '-C', dest, 'pull', '--ff-only']]);
  });

  it('uses --from as is, after checking it is a v4 checkout', () => {
    const from = path.resolve('/src/delphi-dev');
    expect(ensureCheckout(dest, from, { run: () => ({ status: 0 }), exists: () => true })).toBe(from);
    expect(() => ensureCheckout(dest, from, { run: () => ({ status: 0 }), exists: () => false })).toThrow(/kb-cli/);
  });

  it('never runs git when --from is given', () => {
    const from = path.resolve('/src/delphi-dev');
    let ran = 0;
    ensureCheckout(dest, from, { run: () => { ran++; return { status: 0 }; }, exists: () => true });
    expect(ran).toBe(0);
  });

  it('fails loudly when the clone fails', () => {
    expect(() => ensureCheckout(dest, undefined, { run: () => ({ status: 128 }), exists: () => false })).toThrow(/clone/);
  });
});

describe('kbCliArgs', () => {
  it('maps one target and the pair to the kb-cli values', () => {
    const base = path.join('/c', 'runtime', 'kb-cli.mjs');
    expect(kbCliArgs('install', '/c', ['codex'], {})).toEqual([base, 'install', '--target', 'codex', '--checkout', '/c']);
    expect(kbCliArgs('install', '/c', ['codex', 'opencode'], { scope: 'project', project: '/p', dryRun: true, force: true }))
      .toEqual([base, 'install', '--target', 'all', '--checkout', '/c', '--scope', 'project', '--project', '/p', '--dry-run', '--force']);
  });

  it('never forwards the claude target to kb-cli', () => {
    const base = path.join('/c', 'runtime', 'kb-cli.mjs');
    expect(kbCliArgs('uninstall', '/c', ['claude', 'opencode'], {})).toEqual([base, 'uninstall', '--target', 'opencode', '--checkout', '/c']);
  });
});

describe('installedPortableTargets', () => {
  it('reads the install manifest', () => {
    const json = JSON.stringify({ codex: { files: [{ path: 'x', sha256: 'y' }], dirs: [] }, opencode: { files: [], dirs: [] } });
    expect(installedPortableTargets(json)).toEqual(['codex']);
    expect(installedPortableTargets(null)).toEqual([]);
    expect(installedPortableTargets('{corrompido')).toEqual([]);
  });
});

describe('manifestFile', () => {
  it('lives in ~/.delphi-dev unless DELPHI_DEV_DATA says otherwise (same rule as kb-cli)', () => {
    expect(manifestFile('/h', {})).toBe(path.join('/h', '.delphi-dev', 'install-manifest.json'));
    expect(manifestFile('/h', { DELPHI_DEV_DATA: '/data' })).toBe(path.join('/data', 'install-manifest.json'));
  });
});
