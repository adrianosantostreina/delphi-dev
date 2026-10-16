import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const MARKER = '.delphi-dev-managed';

export interface OwnedFile { path: string; sha256: string }
export interface OwnedDir { path: string; treeHash: string }
export interface OwnedKey { file: string; key: string }
export interface TargetRecord { files: OwnedFile[]; dirs: OwnedDir[]; blocks: string[]; keys: OwnedKey[] }
export interface InstallManifest {
  schema: 1;
  version: string;
  installedAt: string;
  codex: TargetRecord;
  opencode: TargetRecord;
}
export interface Report {
  written: string[];
  unchanged: number;
  skipped: { path: string; reason: string }[];
  warnings: string[];
  removed: string[];
}
export interface Ctx {
  dryRun: boolean;
  force: boolean;
  stamp: string;
  prev: TargetRecord;
  report: Report;
}

export const emptyRecord = (): TargetRecord => ({ files: [], dirs: [], blocks: [], keys: [] });
export const newReport = (): Report => ({ written: [], unchanged: 0, skipped: [], warnings: [], removed: [] });
export const emptyManifest = (): InstallManifest => ({
  schema: 1, version: '0', installedAt: '', codex: emptyRecord(), opencode: emptyRecord(),
});

export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function readTree(dir: string, ignore: string[] = [MARKER]): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const walk = (current: string, rel: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (ignore.includes(entry.name)) continue;
      const full = path.join(current, entry.name);
      const key = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(full, key);
      else if (entry.isFile()) out.set(key, fs.readFileSync(full));
    }
  };
  if (fs.existsSync(dir)) walk(dir, '');
  return out;
}

export function treeHash(files: Map<string, Buffer>): string {
  const h = createHash('sha256');
  for (const rel of [...files.keys()].sort()) {
    h.update(rel);
    h.update('\x00');
    h.update(sha256(files.get(rel) as Buffer));
    h.update('\n');
  }
  return h.digest('hex');
}

/** Writes to a sibling temp file and renames over the target: readers never see a half-written file. */
export function atomicWrite(file: string, content: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, file);
  } catch (err) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
    throw err;
  }
}

function sanitizeRecord(value: unknown): TargetRecord {
  const r = (value ?? {}) as Partial<Record<keyof TargetRecord, unknown>>;
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
  return {
    files: list(r.files).filter(
      (x): x is OwnedFile => isObj(x) && typeof x.path === 'string' && typeof x.sha256 === 'string',
    ),
    dirs: list(r.dirs).filter(
      (x): x is OwnedDir => isObj(x) && typeof x.path === 'string' && typeof x.treeHash === 'string',
    ),
    blocks: list(r.blocks).filter((x): x is string => typeof x === 'string'),
    keys: list(r.keys).filter(
      (x): x is OwnedKey => isObj(x) && typeof x.file === 'string' && typeof x.key === 'string',
    ),
  };
}

export function readManifest(file: string): InstallManifest {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    return {
      schema: 1,
      version: String(raw.version ?? '0'),
      installedAt: String(raw.installedAt ?? ''),
      codex: sanitizeRecord(raw.codex),
      opencode: sanitizeRecord(raw.opencode),
    };
  } catch {
    return emptyManifest();
  }
}

export function writeManifest(file: string, manifest: InstallManifest): void {
  atomicWrite(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

function upsert<T extends { path: string }>(list: T[], item: T): void {
  const at = list.findIndex((x) => x.path === item.path);
  if (at >= 0) list[at] = item;
  else list.push(item);
}

function lstatOrNull(p: string): fs.Stats | null {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
}

/** `<file>.bak-<stamp>`, or `...-2`, `...-3` when that name is taken: a backup is never overwritten. */
function freeBackupPath(file: string, stamp: string): string {
  const base = `${file}.bak-${stamp}`;
  let candidate = base;
  for (let n = 2; lstatOrNull(candidate) !== null; n++) candidate = `${base}-${n}`;
  return candidate;
}

function readMarkerHash(marker: string): string | undefined {
  try {
    const h = (JSON.parse(fs.readFileSync(marker, 'utf8')) as { treeHash?: unknown }).treeHash;
    return typeof h === 'string' ? h : undefined;
  } catch {
    return undefined;
  }
}

export function writeOwnedFile(ctx: Ctx, file: string, content: string, rec: TargetRecord): void {
  const hash = sha256(content);
  const st = lstatOrNull(file);
  let backup = false;
  if (st !== null) {
    if (st.isSymbolicLink() || !st.isFile()) {
      if (!ctx.force) {
        ctx.report.skipped.push({ path: file, reason: st.isSymbolicLink() ? 'symlink' : 'exists-not-owned' });
        return;
      }
      backup = true;
    } else {
      const existing = fs.readFileSync(file);
      const existingHash = sha256(existing);
      if (existingHash === hash) {
        ctx.report.unchanged++;
        upsert(rec.files, { path: file, sha256: hash });
        return;
      }
      const recorded = ctx.prev.files.find((f) => f.path === file)?.sha256;
      if (recorded === undefined || existingHash !== recorded) {
        if (!ctx.force) {
          ctx.report.skipped.push({ path: file, reason: recorded === undefined ? 'exists-not-owned' : 'modified-by-user' });
          return;
        }
        backup = true;
      }
    }
  }
  if (backup) {
    const bak = freeBackupPath(file, ctx.stamp);
    if (!ctx.dryRun) {
      if (st !== null && st.isFile()) fs.copyFileSync(file, bak);
      else fs.renameSync(file, bak);
    }
    ctx.report.warnings.push(`backup criado: ${bak}`);
  }
  if (!ctx.dryRun) atomicWrite(file, content);
  ctx.report.written.push(file);
  upsert(rec.files, { path: file, sha256: hash });
}

export function writeOwnedDir(ctx: Ctx, destDir: string, files: Map<string, Buffer>, rec: TargetRecord): void {
  const marker = path.join(destDir, MARKER);
  const next = treeHash(files);
  const st = lstatOrNull(destDir);
  let backup = false;
  if (st !== null) {
    if (st.isSymbolicLink() || !st.isDirectory()) {
      if (!ctx.force) {
        ctx.report.skipped.push({ path: destDir, reason: st.isSymbolicLink() ? 'symlink' : 'exists-not-owned' });
        return;
      }
      backup = true;
    } else if (!fs.existsSync(marker)) {
      // A folder without our marker belongs to someone else (e.g. a skill of another tool in ~/.agents/skills).
      if (!ctx.force) {
        ctx.report.skipped.push({ path: destDir, reason: 'exists-not-owned' });
        return;
      }
      backup = true;
    } else {
      const current = treeHash(readTree(destDir));
      if (current === next) {
        ctx.report.unchanged++;
        upsert(rec.dirs, { path: destDir, treeHash: next });
        return;
      }
      // What we last wrote: the manifest, or else the marker (so a lost manifest never makes us wipe user edits).
      const baseline = ctx.prev.dirs.find((d) => d.path === destDir)?.treeHash ?? readMarkerHash(marker);
      if (baseline === undefined || current !== baseline) {
        if (!ctx.force) {
          ctx.report.skipped.push({ path: destDir, reason: 'modified-by-user' });
          return;
        }
        backup = true;
      }
    }
  }
  if (!ctx.dryRun) {
    // Stage the new tree next to the destination and swap it in, so a crash never leaves a half-written folder.
    const stage = `${destDir}.new-${process.pid}`;
    fs.rmSync(stage, { recursive: true, force: true });
    try {
      for (const [rel, data] of files) atomicWrite(path.join(stage, ...rel.split('/')), data);
      atomicWrite(path.join(stage, MARKER), `${JSON.stringify({ treeHash: next })}\n`);
      if (st !== null) {
        const aside = backup ? freeBackupPath(destDir, ctx.stamp) : `${destDir}.old-${process.pid}`;
        fs.renameSync(destDir, aside);
        try {
          fs.renameSync(stage, destDir);
        } catch (err) {
          fs.renameSync(aside, destDir);
          throw err;
        }
        if (!backup) fs.rmSync(aside, { recursive: true, force: true });
        else ctx.report.warnings.push(`backup criado: ${aside}`);
      } else {
        fs.mkdirSync(path.dirname(destDir), { recursive: true });
        fs.renameSync(stage, destDir);
      }
    } finally {
      fs.rmSync(stage, { recursive: true, force: true });
    }
  } else if (backup) {
    ctx.report.warnings.push(`backup seria criado: ${freeBackupPath(destDir, ctx.stamp)}`);
  }
  ctx.report.written.push(destDir);
  upsert(rec.dirs, { path: destDir, treeHash: next });
}

export function removeOwned(ctx: Ctx, rec: TargetRecord): void {
  for (const f of rec.files) {
    try {
      const st = lstatOrNull(f.path);
      if (st === null) continue;
      if (st.isSymbolicLink() || !st.isFile()) {
        ctx.report.warnings.push(`mantido (nao e um arquivo comum): ${f.path}`);
        continue;
      }
      const unchanged = sha256(fs.readFileSync(f.path)) === f.sha256;
      if (!unchanged && !ctx.force) {
        ctx.report.warnings.push(`mantido (alterado por voce): ${f.path}`);
        continue;
      }
      if (!ctx.dryRun) {
        if (!unchanged) fs.copyFileSync(f.path, freeBackupPath(f.path, ctx.stamp));
        fs.unlinkSync(f.path);
      }
      ctx.report.removed.push(f.path);
    } catch (err) {
      ctx.report.warnings.push(`nao foi possivel remover ${f.path}: ${(err as Error).message}`);
    }
  }
  for (const d of rec.dirs) {
    try {
      const st = lstatOrNull(d.path);
      if (st === null) continue;
      if (st.isSymbolicLink() || !st.isDirectory()) {
        ctx.report.warnings.push(`mantido (nao e uma pasta comum): ${d.path}`);
        continue;
      }
      const owned = fs.existsSync(path.join(d.path, MARKER)) && treeHash(readTree(d.path)) === d.treeHash;
      if (!owned && !ctx.force) {
        ctx.report.warnings.push(`mantido (alterado por voce ou sem marcador): ${d.path}`);
        continue;
      }
      if (!ctx.dryRun) {
        if (owned) fs.rmSync(d.path, { recursive: true, force: true });
        else fs.renameSync(d.path, freeBackupPath(d.path, ctx.stamp));
      }
      ctx.report.removed.push(d.path);
    } catch (err) {
      ctx.report.warnings.push(`nao foi possivel remover ${d.path}: ${(err as Error).message}`);
    }
  }
}
