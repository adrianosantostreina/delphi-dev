import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Which git ref of the delphi-dev repository the installer puts in its checkouts.
 *
 * - A stable package (no SemVer pre-release suffix) has NO ref: the historical behaviour
 *   (clone / `pull --ff-only` of the default branch) is untouched.
 * - A pre-release package (`4.0.0-beta.1`, `4.0.0-rc.1`) installs its own tag `v<version>`.
 * - `--ref <tag|branch|sha>` overrides both.
 *
 * The ref in use is recorded in `install-ref.json` so that `update` does not silently fall back
 * to master, and so that a later stable `npx delphi-dev` knows it has to leave the pinned ref.
 */

export const DEFAULT_BRANCH = 'master';

export interface GitRunner {
  (cmd: string, args: string[]): { status: number | null };
}

export interface RefState {
  ref: string;
  /** true when the user chose it with --ref; false when it came from the package version. */
  explicit: boolean;
  version?: string;
  at?: string;
}

export interface RefPlan {
  ref: string | undefined;
  explicit: boolean;
  /** No ref asked, but a pinned checkout exists: the working copy must go back to the default branch. */
  unpin: boolean;
}

export interface UpdatePlan extends RefPlan {
  /** The recorded ref was kept (instead of being recomputed): tell the user. */
  kept: boolean;
}

const PRERELEASE = /^\d+\.\d+\.\d+-[0-9A-Za-z][0-9A-Za-z.-]*$/;
const REF_CHARS = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const SHA = /^[0-9a-f]{7,40}$/i;

export function isPrerelease(version: string): boolean {
  return PRERELEASE.test(version);
}

export function defaultRefFor(version: string): string | undefined {
  return isPrerelease(version) ? `v${version}` : undefined;
}

export function looksLikeSha(ref: string): boolean {
  return SHA.test(ref);
}

/** A ref ends up as a git argument: it must never be readable as an option or a path trick. */
export function validateRef(ref: string): string {
  const bad =
    !REF_CHARS.test(ref) ||
    ref.includes('..') ||
    ref.includes('//') ||
    ref.endsWith('/') ||
    ref.endsWith('.') ||
    ref.endsWith('.lock') ||
    ref.includes('@{');
  if (bad) throw new Error(`--ref invalido: "${ref}" (use uma tag, branch ou sha, ex.: v4.0.0-beta.1)`);
  return ref;
}

export function planInstallRef(o: { flag?: string; version: string; state?: RefState | null }): RefPlan {
  if (o.flag !== undefined) return { ref: validateRef(o.flag), explicit: true, unpin: false };
  const ref = defaultRefFor(o.version);
  if (ref) return { ref, explicit: false, unpin: false };
  return { ref: undefined, explicit: false, unpin: !!o.state?.ref };
}

export function planUpdateRef(o: { flag?: string; version: string; state?: RefState | null }): UpdatePlan {
  if (o.flag !== undefined) return { ref: validateRef(o.flag), explicit: true, unpin: false, kept: false };
  const state = o.state;
  if (state?.ref && state.explicit) return { ref: state.ref, explicit: true, unpin: false, kept: true };
  const ref = defaultRefFor(o.version);
  if (ref) return { ref, explicit: false, unpin: false, kept: false };
  if (state?.ref) return { ref: state.ref, explicit: false, unpin: false, kept: true };
  return { ref: undefined, explicit: false, unpin: false, kept: false };
}

/** First clone. `--branch` takes a tag or a branch; a bare sha needs a full clone and a checkout. */
export function cloneAtRef(dest: string, ref: string, run: GitRunner, url: string): void {
  if (looksLikeSha(ref)) {
    if (run('git', ['clone', url, dest]).status !== 0) throw new Error(`git clone falhou (ref "${ref}")`);
    if (run('git', ['-C', dest, 'checkout', '--detach', '--quiet', ref]).status !== 0) {
      throw new Error(`o commit "${ref}" nao existe no repositorio`);
    }
    return;
  }
  const result = run('git', ['clone', '--depth=1', '--branch', ref, '-c', 'advice.detachedHead=false', url, dest]);
  if (result.status !== 0) throw new Error(`git clone falhou para o ref "${ref}" (essa tag/branch existe no repositorio?)`);
}

/**
 * Existing clone: fetch the ref as a tag, else as a branch (or the commit when it looks like a sha),
 * then detach on it. A failed fetch is not fatal by itself (offline): the ref is used if it is
 * already known locally; otherwise the error says which ref is missing.
 */
export function checkoutRef(dest: string, ref: string, run: GitRunner): void {
  const git = (...a: string[]): boolean => run('git', ['-C', dest, ...a]).status === 0;
  if (looksLikeSha(ref)) {
    git('fetch', '--depth=1', 'origin', ref);
    if (git('checkout', '--detach', '--quiet', ref)) return;
  } else {
    if (!git('fetch', '--depth=1', '--force', 'origin', `+refs/tags/${ref}:refs/tags/${ref}`)) {
      git('fetch', '--depth=1', '--force', 'origin', `+refs/heads/${ref}:refs/remotes/origin/${ref}`);
    }
    for (const target of [`refs/tags/${ref}`, `refs/remotes/origin/${ref}`]) {
      if (git('checkout', '--detach', '--quiet', target)) return;
    }
  }
  throw new Error(`ref "${ref}" nao encontrado (nem no repositorio remoto, nem localmente)`);
}

/** Leaves a pinned (detached) checkout and puts it back on the default branch. */
export function returnToDefaultBranch(dest: string, run: GitRunner): void {
  const git = (...a: string[]): boolean => run('git', ['-C', dest, ...a]).status === 0;
  // A clone made with --branch <tag> only tracks that tag: restore the normal refspec so a later `pull` works.
  git('config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*');
  git('fetch', '--depth=1', '--force', 'origin', `+refs/heads/${DEFAULT_BRANCH}:refs/remotes/origin/${DEFAULT_BRANCH}`);
  if (!git('checkout', '--quiet', '-B', DEFAULT_BRANCH, `refs/remotes/origin/${DEFAULT_BRANCH}`)) {
    throw new Error(`nao foi possivel voltar para a branch ${DEFAULT_BRANCH}`);
  }
}

/** Same location rule as the install manifest: $DELPHI_DEV_DATA or ~/.delphi-dev. */
export function refStateFile(home: string = os.homedir(), env: NodeJS.ProcessEnv = process.env): string {
  return path.join(env.DELPHI_DEV_DATA || path.join(home, '.delphi-dev'), 'install-ref.json');
}

export function readRefState(home: string = os.homedir(), env: NodeJS.ProcessEnv = process.env): RefState | null {
  try {
    const raw = JSON.parse(fs.readFileSync(refStateFile(home, env), 'utf-8')) as Partial<RefState>;
    if (typeof raw.ref !== 'string') return null;
    validateRef(raw.ref);
    return {
      ref: raw.ref,
      explicit: raw.explicit === true,
      version: typeof raw.version === 'string' ? raw.version : undefined,
      at: typeof raw.at === 'string' ? raw.at : undefined,
    };
  } catch {
    return null;
  }
}

export function writeRefState(state: RefState, home: string = os.homedir(), env: NodeJS.ProcessEnv = process.env): void {
  const file = refStateFile(home, env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...state, at: state.at ?? new Date().toISOString() }, null, 2) + '\n');
}

export function clearRefState(home: string = os.homedir(), env: NodeJS.ProcessEnv = process.env): void {
  try {
    fs.rmSync(refStateFile(home, env), { force: true });
  } catch {
    /* nothing to clear */
  }
}
