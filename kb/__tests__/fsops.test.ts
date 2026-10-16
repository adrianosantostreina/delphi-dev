import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  emptyRecord, MARKER, newReport, readManifest, removeOwned, sha256, writeManifest, writeOwnedDir, writeOwnedFile,
  type Ctx, type TargetRecord,
} from '../src/install/fsops';
import { tmpDir } from './helpers';

function ctx(over: Partial<Ctx> = {}): Ctx {
  return { dryRun: false, force: false, stamp: 'T', prev: emptyRecord(), report: newReport(), ...over };
}

const files = (obj: Record<string, string>) => new Map(Object.entries(obj).map(([k, v]) => [k, Buffer.from(v)]));

/** Symlinks need a privilege on Windows: returns false when they cannot be created. */
function trySymlink(target: string, link: string, type: 'file' | 'dir'): boolean {
  try {
    fs.symlinkSync(target, link, type === 'dir' ? 'junction' : type);
    return true;
  } catch {
    return false;
  }
}

describe('writeOwnedFile', () => {
  it('creates a file and records its hash', () => {
    const file = path.join(tmpDir(), 'sub', 'a.md');
    const rec = emptyRecord();
    const c = ctx();
    writeOwnedFile(c, file, 'conteudo', rec);
    expect(fs.readFileSync(file, 'utf8')).toBe('conteudo');
    expect(c.report.written).toEqual([file]);
    expect(rec.files).toEqual([{ path: file, sha256: sha256('conteudo') }]);
  });

  it('reports unchanged on the second run', () => {
    const file = path.join(tmpDir(), 'a.md');
    const first = emptyRecord();
    writeOwnedFile(ctx(), file, 'v1', first);
    const c = ctx({ prev: first });
    const rec = emptyRecord();
    writeOwnedFile(c, file, 'v1', rec);
    expect(c.report.written).toEqual([]);
    expect(c.report.unchanged).toBe(1);
    expect(rec.files).toHaveLength(1);
  });

  it('overwrites a file it owns when the content changes', () => {
    const file = path.join(tmpDir(), 'a.md');
    const first = emptyRecord();
    writeOwnedFile(ctx(), file, 'v1', first);
    const c = ctx({ prev: first });
    writeOwnedFile(c, file, 'v2', emptyRecord());
    expect(fs.readFileSync(file, 'utf8')).toBe('v2');
    expect(c.report.written).toEqual([file]);
  });

  it('skips a pre-existing file it does not own', () => {
    const file = path.join(tmpDir(), 'a.md');
    fs.writeFileSync(file, 'do usuario');
    const c = ctx();
    const rec = emptyRecord();
    writeOwnedFile(c, file, 'nosso', rec);
    expect(fs.readFileSync(file, 'utf8')).toBe('do usuario');
    expect(c.report.skipped).toEqual([{ path: file, reason: 'exists-not-owned' }]);
    expect(rec.files).toEqual([]);
  });

  it('skips a file the user modified after the install', () => {
    const file = path.join(tmpDir(), 'a.md');
    const first = emptyRecord();
    writeOwnedFile(ctx(), file, 'v1', first);
    fs.writeFileSync(file, 'v1 editado');
    const c = ctx({ prev: first });
    writeOwnedFile(c, file, 'v2', emptyRecord());
    expect(fs.readFileSync(file, 'utf8')).toBe('v1 editado');
    expect(c.report.skipped[0].reason).toBe('modified-by-user');
  });

  it('with force, backs up and overwrites', () => {
    const file = path.join(tmpDir(), 'a.md');
    fs.writeFileSync(file, 'do usuario');
    writeOwnedFile(ctx({ force: true }), file, 'nosso', emptyRecord());
    expect(fs.readFileSync(file, 'utf8')).toBe('nosso');
    expect(fs.readFileSync(`${file}.bak-T`, 'utf8')).toBe('do usuario');
  });

  it('dry-run writes nothing but reports', () => {
    const file = path.join(tmpDir(), 'a.md');
    const c = ctx({ dryRun: true });
    writeOwnedFile(c, file, 'x', emptyRecord());
    expect(fs.existsSync(file)).toBe(false);
    expect(c.report.written).toEqual([file]);
  });

  it('dry-run with force leaves the user file and creates no backup', () => {
    const file = path.join(tmpDir(), 'a.md');
    fs.writeFileSync(file, 'do usuario');
    writeOwnedFile(ctx({ dryRun: true, force: true }), file, 'nosso', emptyRecord());
    expect(fs.readFileSync(file, 'utf8')).toBe('do usuario');
    expect(fs.existsSync(`${file}.bak-T`)).toBe(false);
  });

  it('never overwrites an earlier backup, even with the same stamp', () => {
    const file = path.join(tmpDir(), 'a.md');
    fs.writeFileSync(file, 'original do usuario');
    const rec = emptyRecord();
    writeOwnedFile(ctx({ force: true }), file, 'v1', rec);
    fs.writeFileSync(file, 'segunda edicao do usuario');
    writeOwnedFile(ctx({ force: true, prev: rec }), file, 'v2', emptyRecord());
    expect(fs.readFileSync(`${file}.bak-T`, 'utf8')).toBe('original do usuario');
    expect(fs.readFileSync(`${file}.bak-T-2`, 'utf8')).toBe('segunda edicao do usuario');
    expect(fs.readFileSync(file, 'utf8')).toBe('v2');
  });

  it('does not create a backup on a plain re-run (idempotent)', () => {
    const file = path.join(tmpDir(), 'a.md');
    fs.writeFileSync(file, 'do usuario');
    const rec = emptyRecord();
    writeOwnedFile(ctx({ force: true }), file, 'nosso', rec);
    const c = ctx({ force: true, stamp: 'U', prev: rec });
    writeOwnedFile(c, file, 'nosso', emptyRecord());
    expect(c.report.unchanged).toBe(1);
    expect(fs.existsSync(`${file}.bak-U`)).toBe(false);
    expect(fs.readdirSync(path.dirname(file)).filter((n) => n.includes('.bak-'))).toEqual(['a.md.bak-T']);
  });

  it('leaves no temp file behind', () => {
    const dir = tmpDir();
    writeOwnedFile(ctx(), path.join(dir, 'a.md'), 'x', emptyRecord());
    expect(fs.readdirSync(dir)).toEqual(['a.md']);
  });

  it('does not follow a symlink (the user may manage it with a dotfiles tool)', () => {
    const dir = tmpDir();
    const real = path.join(dir, 'real.md');
    fs.writeFileSync(real, 'conteudo do usuario');
    const link = path.join(dir, 'link.md');
    if (!trySymlink(real, link, 'file')) return;
    const c = ctx();
    writeOwnedFile(c, link, 'nosso', emptyRecord());
    expect(c.report.skipped).toEqual([{ path: link, reason: 'symlink' }]);
    expect(fs.readFileSync(real, 'utf8')).toBe('conteudo do usuario');
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true);
  });

  it('skips when a directory sits where the file should go', () => {
    const dir = tmpDir();
    const target = path.join(dir, 'a.md');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'x'), 'y');
    const c = ctx();
    writeOwnedFile(c, target, 'nosso', emptyRecord());
    expect(c.report.skipped[0].reason).toBe('exists-not-owned');
    expect(fs.readFileSync(path.join(target, 'x'), 'utf8')).toBe('y');
  });
});

describe('writeOwnedDir', () => {
  it('copies the tree, writes the marker and is unchanged the second time', () => {
    const dest = path.join(tmpDir(), 'skill');
    const first = emptyRecord();
    writeOwnedDir(ctx(), dest, files({ 'SKILL.md': '# a', 'references/x.md': '# x' }), first);
    expect(fs.readFileSync(path.join(dest, 'references', 'x.md'), 'utf8')).toBe('# x');
    expect(fs.existsSync(path.join(dest, MARKER))).toBe(true);

    const c = ctx({ prev: first });
    writeOwnedDir(c, dest, files({ 'SKILL.md': '# a', 'references/x.md': '# x' }), emptyRecord());
    expect(c.report.unchanged).toBe(1);
    expect(c.report.written).toEqual([]);
  });

  it('never touches a folder without our marker (a skill of someone else)', () => {
    const dest = path.join(tmpDir(), 'aws-cdk');
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, 'SKILL.md'), 'de terceiros');
    const c = ctx();
    const rec = emptyRecord();
    writeOwnedDir(c, dest, files({ 'SKILL.md': '# nosso' }), rec);
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('de terceiros');
    expect(c.report.skipped).toEqual([{ path: dest, reason: 'exists-not-owned' }]);
    expect(rec.dirs).toEqual([]);
  });

  it('replaces an owned folder when the source changed', () => {
    const dest = path.join(tmpDir(), 'skill');
    const first = emptyRecord();
    writeOwnedDir(ctx(), dest, files({ 'SKILL.md': '# v1', 'velho.md': 'x' }), first);
    writeOwnedDir(ctx({ prev: first }), dest, files({ 'SKILL.md': '# v2' }), emptyRecord());
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# v2');
    expect(fs.existsSync(path.join(dest, 'velho.md'))).toBe(false);
  });

  it('skips an owned folder the user edited', () => {
    const dest = path.join(tmpDir(), 'skill');
    const first = emptyRecord();
    writeOwnedDir(ctx(), dest, files({ 'SKILL.md': '# v1' }), first);
    fs.writeFileSync(path.join(dest, 'SKILL.md'), '# editado');
    const c = ctx({ prev: first });
    writeOwnedDir(c, dest, files({ 'SKILL.md': '# v2' }), emptyRecord());
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# editado');
    expect(c.report.skipped[0].reason).toBe('modified-by-user');
  });

  it('skips an owned folder where the user only ADDED a file', () => {
    const dest = path.join(tmpDir(), 'skill');
    const first = emptyRecord();
    writeOwnedDir(ctx(), dest, files({ 'SKILL.md': '# v1' }), first);
    fs.writeFileSync(path.join(dest, 'minhas-notas.md'), 'notas');
    const c = ctx({ prev: first });
    writeOwnedDir(c, dest, files({ 'SKILL.md': '# v2' }), emptyRecord());
    expect(fs.readFileSync(path.join(dest, 'minhas-notas.md'), 'utf8')).toBe('notas');
    expect(c.report.skipped[0].reason).toBe('modified-by-user');
  });

  it('does not wipe user edits when the manifest was lost (marker is the baseline)', () => {
    const dest = path.join(tmpDir(), 'skill');
    writeOwnedDir(ctx(), dest, files({ 'SKILL.md': '# v1' }), emptyRecord());
    fs.writeFileSync(path.join(dest, 'SKILL.md'), '# editado');
    const c = ctx({ prev: emptyRecord() });
    writeOwnedDir(c, dest, files({ 'SKILL.md': '# v2' }), emptyRecord());
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# editado');
    expect(c.report.skipped[0].reason).toBe('modified-by-user');
  });

  it('upgrades an untouched owned folder even when the manifest was lost', () => {
    const dest = path.join(tmpDir(), 'skill');
    writeOwnedDir(ctx(), dest, files({ 'SKILL.md': '# v1' }), emptyRecord());
    writeOwnedDir(ctx({ prev: emptyRecord() }), dest, files({ 'SKILL.md': '# v2' }), emptyRecord());
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# v2');
  });

  it('with force, an edited owned folder is moved to a backup, not deleted', () => {
    const dest = path.join(tmpDir(), 'skill');
    const first = emptyRecord();
    writeOwnedDir(ctx(), dest, files({ 'SKILL.md': '# v1' }), first);
    fs.writeFileSync(path.join(dest, 'SKILL.md'), '# editado');
    writeOwnedDir(ctx({ force: true, prev: first }), dest, files({ 'SKILL.md': '# v2' }), emptyRecord());
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# v2');
    expect(fs.readFileSync(path.join(`${dest}.bak-T`, 'SKILL.md'), 'utf8')).toBe('# editado');
  });

  it('with force, a folder without marker is moved to a backup', () => {
    const dest = path.join(tmpDir(), 'terceiro');
    fs.mkdirSync(dest);
    fs.writeFileSync(path.join(dest, 'SKILL.md'), 'de terceiros');
    writeOwnedDir(ctx({ force: true }), dest, files({ 'SKILL.md': '# nosso' }), emptyRecord());
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe('# nosso');
    expect(fs.readFileSync(path.join(`${dest}.bak-T`, 'SKILL.md'), 'utf8')).toBe('de terceiros');
  });

  it('keeps every backup when forced twice with the same stamp', () => {
    const dest = path.join(tmpDir(), 'terceiro');
    fs.mkdirSync(dest);
    fs.writeFileSync(path.join(dest, 'SKILL.md'), 'primeiro');
    const rec = emptyRecord();
    writeOwnedDir(ctx({ force: true }), dest, files({ 'SKILL.md': '# v1' }), rec);
    fs.writeFileSync(path.join(dest, 'SKILL.md'), 'segundo');
    writeOwnedDir(ctx({ force: true, prev: rec }), dest, files({ 'SKILL.md': '# v2' }), emptyRecord());
    expect(fs.readFileSync(path.join(`${dest}.bak-T`, 'SKILL.md'), 'utf8')).toBe('primeiro');
    expect(fs.readFileSync(path.join(`${dest}.bak-T-2`, 'SKILL.md'), 'utf8')).toBe('segundo');
  });

  it('dry-run touches nothing, with or without force', () => {
    const base = tmpDir();
    const foreign = path.join(base, 'terceiro');
    fs.mkdirSync(foreign);
    fs.writeFileSync(path.join(foreign, 'SKILL.md'), 'de terceiros');
    writeOwnedDir(ctx({ dryRun: true, force: true }), foreign, files({ 'SKILL.md': '# nosso' }), emptyRecord());
    writeOwnedDir(ctx({ dryRun: true }), path.join(base, 'novo'), files({ 'SKILL.md': '# n' }), emptyRecord());
    expect(fs.readdirSync(base).sort()).toEqual(['terceiro']);
    expect(fs.readFileSync(path.join(foreign, 'SKILL.md'), 'utf8')).toBe('de terceiros');
  });

  it('leaves no staging folder and does not disturb sibling folders', () => {
    const base = tmpDir();
    const other = path.join(base, 'outra-skill');
    fs.mkdirSync(other);
    fs.writeFileSync(path.join(other, 'SKILL.md'), 'de terceiros');
    const dest = path.join(base, 'skill');
    const first = emptyRecord();
    writeOwnedDir(ctx(), dest, files({ 'SKILL.md': '# v1' }), first);
    writeOwnedDir(ctx({ prev: first }), dest, files({ 'SKILL.md': '# v2' }), emptyRecord());
    expect(fs.readdirSync(base).sort()).toEqual(['outra-skill', 'skill']);
    expect(fs.readFileSync(path.join(other, 'SKILL.md'), 'utf8')).toBe('de terceiros');
  });

  it('does not follow a symlinked folder', () => {
    const base = tmpDir();
    const real = path.join(base, 'real');
    fs.mkdirSync(real);
    fs.writeFileSync(path.join(real, 'SKILL.md'), 'do usuario');
    fs.writeFileSync(path.join(real, MARKER), '{}');
    const link = path.join(base, 'link');
    if (!trySymlink(real, link, 'dir')) return;
    const c = ctx();
    writeOwnedDir(c, link, files({ 'SKILL.md': '# nosso' }), emptyRecord());
    expect(c.report.skipped).toEqual([{ path: link, reason: 'symlink' }]);
    expect(fs.readFileSync(path.join(real, 'SKILL.md'), 'utf8')).toBe('do usuario');
  });

  it('is idempotent across install, reinstall, remove and install again', () => {
    const dest = path.join(tmpDir(), 'skill');
    const tree = files({ 'SKILL.md': '# a', 'references/x.md': '# x' });
    const r1 = emptyRecord();
    writeOwnedDir(ctx(), dest, tree, r1);
    const c2 = ctx({ prev: r1 });
    const r2 = emptyRecord();
    writeOwnedDir(c2, dest, tree, r2);
    expect(c2.report.written).toEqual([]);
    expect(r2).toEqual(r1);
    removeOwned(ctx({ prev: r2 }), r2);
    expect(fs.existsSync(dest)).toBe(false);
    const c3 = ctx();
    writeOwnedDir(c3, dest, tree, emptyRecord());
    expect(c3.report.written).toEqual([dest]);
  });
});

describe('removeOwned', () => {
  function installed(): { rec: TargetRecord; file: string; dir: string } {
    const base = tmpDir();
    const file = path.join(base, 'a.md');
    const dir = path.join(base, 'skill');
    const rec = emptyRecord();
    writeOwnedFile(ctx(), file, 'v1', rec);
    writeOwnedDir(ctx(), dir, files({ 'SKILL.md': '# s' }), rec);
    return { rec, file, dir };
  }

  it('removes what is ours and unchanged', () => {
    const { rec, file, dir } = installed();
    const c = ctx({ prev: rec });
    removeOwned(c, rec);
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.existsSync(dir)).toBe(false);
    expect(c.report.removed).toHaveLength(2);
  });

  it('keeps what the user changed and warns', () => {
    const { rec, file, dir } = installed();
    fs.writeFileSync(file, 'editado');
    fs.writeFileSync(path.join(dir, 'SKILL.md'), '# editado');
    const c = ctx({ prev: rec });
    removeOwned(c, rec);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.existsSync(dir)).toBe(true);
    expect(c.report.warnings).toHaveLength(2);
  });

  it('with force removes even changed files', () => {
    const { rec, file } = installed();
    fs.writeFileSync(file, 'editado');
    removeOwned(ctx({ prev: rec, force: true }), rec);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('with force, user changes survive in a backup', () => {
    const { rec, file, dir } = installed();
    fs.writeFileSync(file, 'editado');
    fs.writeFileSync(path.join(dir, 'SKILL.md'), '# editado');
    removeOwned(ctx({ prev: rec, force: true }), rec);
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.existsSync(dir)).toBe(false);
    expect(fs.readFileSync(`${file}.bak-T`, 'utf8')).toBe('editado');
    expect(fs.readFileSync(path.join(`${dir}.bak-T`, 'SKILL.md'), 'utf8')).toBe('# editado');
  });

  it('keeps a folder where the user added a file', () => {
    const { rec, dir } = installed();
    fs.writeFileSync(path.join(dir, 'minhas-notas.md'), 'notas');
    removeOwned(ctx({ prev: rec }), rec);
    expect(fs.readFileSync(path.join(dir, 'minhas-notas.md'), 'utf8')).toBe('notas');
  });

  it('never removes a folder that lost our marker (the user put their own there)', () => {
    const { rec, dir } = installed();
    fs.rmSync(dir, { recursive: true });
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'SKILL.md'), '# s');
    removeOwned(ctx({ prev: rec }), rec);
    expect(fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8')).toBe('# s');
  });

  it('dry-run removes nothing but reports', () => {
    const { rec, file, dir } = installed();
    const c = ctx({ prev: rec, dryRun: true });
    removeOwned(c, rec);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.existsSync(dir)).toBe(true);
    expect(c.report.removed).toHaveLength(2);
  });

  it('tolerates entries that no longer exist and is repeatable', () => {
    const { rec } = installed();
    removeOwned(ctx({ prev: rec }), rec);
    const c = ctx({ prev: rec });
    removeOwned(c, rec);
    expect(c.report.removed).toEqual([]);
    expect(c.report.warnings).toEqual([]);
  });

  it('does not touch a symlink left where our file used to be', () => {
    const { rec, file } = installed();
    const real = path.join(path.dirname(file), 'real.md');
    fs.writeFileSync(real, 'v1');
    fs.unlinkSync(file);
    if (!trySymlink(real, file, 'file')) return;
    const c = ctx({ prev: rec });
    removeOwned(c, rec);
    expect(fs.lstatSync(file).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(real, 'utf8')).toBe('v1');
    expect(c.report.warnings.join('\n')).toContain(file);
  });
});

describe('manifest', () => {
  it('round-trips and tolerates a missing or corrupt file', () => {
    const file = path.join(tmpDir(), 'm', 'install-manifest.json');
    expect(readManifest(file).codex).toEqual(emptyRecord());
    const m = readManifest(file);
    m.codex.files.push({ path: 'x', sha256: 'y' });
    writeManifest(file, m);
    expect(readManifest(file).codex.files).toEqual([{ path: 'x', sha256: 'y' }]);
    fs.writeFileSync(file, '{corrompido');
    expect(readManifest(file).opencode).toEqual(emptyRecord());
  });

  it('drops malformed entries instead of crashing later', () => {
    const file = path.join(tmpDir(), 'install-manifest.json');
    fs.writeFileSync(file, JSON.stringify({
      codex: {
        files: [null, 1, { path: 5 }, { path: 'ok', sha256: 'h' }],
        dirs: ['x', { path: 'd', treeHash: 't' }, { path: 'e' }],
        blocks: [1, 'b'],
        keys: [{ file: 'f' }, { file: 'f', key: 'k' }],
      },
      opencode: 'lixo',
    }));
    const m = readManifest(file);
    expect(m.codex).toEqual({
      files: [{ path: 'ok', sha256: 'h' }],
      dirs: [{ path: 'd', treeHash: 't' }],
      blocks: ['b'],
      keys: [{ file: 'f', key: 'k' }],
    });
    expect(m.opencode).toEqual(emptyRecord());
    expect(() => removeOwned(ctx(), m.codex)).not.toThrow();
  });
});
