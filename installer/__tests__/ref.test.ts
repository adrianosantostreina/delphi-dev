import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  checkoutRef, cloneAtRef, clearRefState, defaultRefFor, isPrerelease, planInstallRef, planUpdateRef, readRefState,
  refStateFile, returnToDefaultBranch, validateRef, writeRefState,
} from '../src/ref';

const URL = 'https://example.invalid/repo.git';

function recorder(failing: (args: string[]) => boolean = () => false) {
  const calls: string[][] = [];
  const run = (cmd: string, args: string[]) => {
    calls.push([cmd, ...args]);
    return { status: failing(args) ? 1 : 0 };
  };
  return { calls, run };
}

describe('isPrerelease / defaultRefFor', () => {
  it('only a SemVer pre-release suffix counts', () => {
    expect(isPrerelease('4.0.0-beta.1')).toBe(true);
    expect(isPrerelease('4.0.0-rc.2')).toBe(true);
    expect(isPrerelease('4.0.0')).toBe(false);
    expect(isPrerelease('2.2.2')).toBe(false);
    expect(isPrerelease('0.0.0')).toBe(false);
    expect(isPrerelease('garbage')).toBe(false);
  });
  it('the default ref is v<version> for a pre-release and nothing for a stable version', () => {
    expect(defaultRefFor('4.0.0-beta.1')).toBe('v4.0.0-beta.1');
    expect(defaultRefFor('4.0.0-rc.1')).toBe('v4.0.0-rc.1');
    expect(defaultRefFor('4.0.0')).toBeUndefined();
    expect(defaultRefFor('2.2.2')).toBeUndefined();
  });
});

describe('validateRef', () => {
  it('accepts tags, branches and shas', () => {
    for (const ok of ['v4.0.0-beta.1', 'beta', 'feature/v4.0-multi-agente', 'a1b2c3d', 'release_1']) {
      expect(validateRef(ok)).toBe(ok);
    }
  });
  it('rejects anything that could be read as an option, a shell fragment or a path trick', () => {
    for (const bad of ['', ' ', '-x', '--upload-pack=evil', 'a b', 'a;b', 'a&b', '$(x)', 'a..b', 'a/', '/a', 'a@{1}', 'x.lock', 'a\\b', '^v1', 'a:b']) {
      expect(() => validateRef(bad), bad).toThrow(/--ref/);
    }
  });
});

describe('planInstallRef', () => {
  it('stable version without flag: no ref, exactly the historical behaviour', () => {
    expect(planInstallRef({ version: '2.2.2' })).toEqual({ ref: undefined, explicit: false, unpin: false });
  });
  it('stable version over a recorded pin: go back to the default branch', () => {
    expect(planInstallRef({ version: '4.0.0', state: { ref: 'v4.0.0-beta.1', explicit: false } }))
      .toEqual({ ref: undefined, explicit: false, unpin: true });
  });
  it('pre-release version defaults to its own tag', () => {
    expect(planInstallRef({ version: '4.0.0-beta.1' })).toEqual({ ref: 'v4.0.0-beta.1', explicit: false, unpin: false });
  });
  it('--ref always wins and is marked explicit', () => {
    expect(planInstallRef({ flag: 'beta', version: '4.0.0-beta.1' })).toEqual({ ref: 'beta', explicit: true, unpin: false });
    expect(planInstallRef({ flag: 'master', version: '2.2.2' })).toEqual({ ref: 'master', explicit: true, unpin: false });
  });
  it('an invalid --ref throws', () => {
    expect(() => planInstallRef({ flag: '--evil', version: '2.2.2' })).toThrow(/--ref/);
  });
});

describe('planUpdateRef', () => {
  it('nothing recorded + stable package: historical update (no ref)', () => {
    expect(planUpdateRef({ version: '2.2.2' })).toEqual({ ref: undefined, explicit: false, unpin: false, kept: false });
  });
  it('an explicit recorded ref is respected, whatever the package version', () => {
    const state = { ref: 'feature/x', explicit: true };
    expect(planUpdateRef({ version: '2.2.2', state })).toEqual({ ref: 'feature/x', explicit: true, unpin: false, kept: true });
    expect(planUpdateRef({ version: '4.0.0-beta.2', state })).toEqual({ ref: 'feature/x', explicit: true, unpin: false, kept: true });
  });
  it('a newer beta package moves a recorded (non-explicit) beta ref forward', () => {
    expect(planUpdateRef({ version: '4.0.0-beta.2', state: { ref: 'v4.0.0-beta.1', explicit: false } }))
      .toEqual({ ref: 'v4.0.0-beta.2', explicit: false, unpin: false, kept: false });
  });
  it('a stable package does NOT silently jump back to master: it keeps the recorded ref and says so', () => {
    expect(planUpdateRef({ version: '2.2.2', state: { ref: 'v4.0.0-beta.1', explicit: false } }))
      .toEqual({ ref: 'v4.0.0-beta.1', explicit: false, unpin: false, kept: true });
  });
  it('--ref overrides the recorded one', () => {
    expect(planUpdateRef({ flag: 'v4.0.0-beta.3', version: '4.0.0-beta.2', state: { ref: 'x', explicit: true } }))
      .toEqual({ ref: 'v4.0.0-beta.3', explicit: true, unpin: false, kept: false });
  });
});

describe('cloneAtRef', () => {
  const dest = path.join('/h', '.delphi-dev', 'plugin');
  it('tag or branch: a shallow clone of exactly that ref, no shell', () => {
    const { calls, run } = recorder();
    cloneAtRef(dest, 'v4.0.0-beta.1', run, URL);
    expect(calls).toEqual([['git', 'clone', '--depth=1', '--branch', 'v4.0.0-beta.1', '-c', 'advice.detachedHead=false', URL, dest]]);
  });
  it('a sha needs a full clone and then a checkout', () => {
    const { calls, run } = recorder();
    cloneAtRef(dest, 'a1b2c3d4', run, URL);
    expect(calls).toEqual([
      ['git', 'clone', URL, dest],
      ['git', '-C', dest, 'checkout', '--detach', '--quiet', 'a1b2c3d4'],
    ]);
  });
  it('fails loudly naming the ref', () => {
    expect(() => cloneAtRef(dest, 'nope', () => ({ status: 128 }), URL)).toThrow(/"nope"/);
  });
});

describe('checkoutRef (existing clone)', () => {
  const dest = path.join('/h', '.delphi-dev', 'plugin');
  it('tag: fetches the tag and detaches on it', () => {
    const { calls, run } = recorder();
    checkoutRef(dest, 'v4.0.0-beta.1', run);
    expect(calls).toEqual([
      ['git', '-C', dest, 'fetch', '--depth=1', '--force', 'origin', '+refs/tags/v4.0.0-beta.1:refs/tags/v4.0.0-beta.1'],
      ['git', '-C', dest, 'checkout', '--detach', '--quiet', 'refs/tags/v4.0.0-beta.1'],
    ]);
  });
  it('branch: the tag fetch fails, so it fetches the branch and detaches on origin/<branch>', () => {
    const { calls, run } = recorder((a) => a.includes('+refs/tags/beta:refs/tags/beta') || a.includes('refs/tags/beta'));
    checkoutRef(dest, 'beta', run);
    expect(calls.map((c) => c.slice(3).join(' '))).toEqual([
      'fetch --depth=1 --force origin +refs/tags/beta:refs/tags/beta',
      'fetch --depth=1 --force origin +refs/heads/beta:refs/remotes/origin/beta',
      'checkout --detach --quiet refs/tags/beta',
      'checkout --detach --quiet refs/remotes/origin/beta',
    ]);
  });
  it('sha: fetches that commit and checks it out', () => {
    const { calls, run } = recorder();
    checkoutRef(dest, 'a1b2c3d4', run);
    expect(calls.map((c) => c.slice(3).join(' '))).toEqual(['fetch --depth=1 origin a1b2c3d4', 'checkout --detach --quiet a1b2c3d4']);
  });
  it('offline: a ref that already exists locally is still checked out', () => {
    const { calls, run } = recorder((a) => a.includes('fetch'));
    checkoutRef(dest, 'v4.0.0-beta.1', run);
    expect(calls[calls.length - 1].slice(3).join(' ')).toBe('checkout --detach --quiet refs/tags/v4.0.0-beta.1');
  });
  it('throws a clear error when the ref exists nowhere', () => {
    expect(() => checkoutRef(dest, 'ghost', () => ({ status: 1 }))).toThrow(/"ghost"/);
  });
});

describe('returnToDefaultBranch', () => {
  const dest = path.join('/h', '.delphi-dev', 'plugin');
  it('fetches master and puts the working copy back on it', () => {
    const { calls, run } = recorder();
    returnToDefaultBranch(dest, run);
    expect(calls.map((c) => c.slice(3).join(' '))).toEqual([
      'config remote.origin.fetch +refs/heads/*:refs/remotes/origin/*',
      'fetch --depth=1 --force origin +refs/heads/master:refs/remotes/origin/master',
      'checkout --quiet -B master refs/remotes/origin/master',
    ]);
  });
  it('throws when master cannot be checked out', () => {
    expect(() => returnToDefaultBranch(dest, () => ({ status: 1 }))).toThrow(/master/);
  });
});

describe('ref state file', () => {
  it('lives next to the install manifest (DELPHI_DEV_DATA or ~/.delphi-dev)', () => {
    expect(refStateFile('/h', {})).toBe(path.join('/h', '.delphi-dev', 'install-ref.json'));
    expect(refStateFile('/h', { DELPHI_DEV_DATA: '/data' })).toBe(path.join('/data', 'install-ref.json'));
  });
  it('round-trips, tolerates garbage and clears', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-ref-'));
    try {
      const env = { DELPHI_DEV_DATA: path.join(dir, 'data') };
      expect(readRefState('/nowhere', env)).toBeNull();
      writeRefState({ ref: 'v4.0.0-beta.1', explicit: false, version: '4.0.0-beta.1' }, '/nowhere', env);
      expect(readRefState('/nowhere', env)).toMatchObject({ ref: 'v4.0.0-beta.1', explicit: false, version: '4.0.0-beta.1' });
      fs.writeFileSync(refStateFile('/nowhere', env), '{corrompido');
      expect(readRefState('/nowhere', env)).toBeNull();
      fs.writeFileSync(refStateFile('/nowhere', env), JSON.stringify({ ref: '--evil', explicit: true }));
      expect(readRefState('/nowhere', env)).toBeNull();
      writeRefState({ ref: 'beta', explicit: true }, '/nowhere', env);
      clearRefState('/nowhere', env);
      expect(readRefState('/nowhere', env)).toBeNull();
      clearRefState('/nowhere', env); // already gone: no error
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
