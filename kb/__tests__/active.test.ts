import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readCacheMeta, resolveActive } from '../src/active';
import { cacheCurrentDir } from '../src/paths';
import { tmpDir, writeTree } from './helpers';

function withCache(meta: unknown): string {
  const data = tmpDir();
  writeTree(cacheCurrentDir(data), {
    'core/a.md': '# A\n',
    'meta.json': typeof meta === 'string' ? meta : JSON.stringify(meta),
  });
  return data;
}

describe('resolveActive', () => {
  const root = '/plugin';

  it('uses the embedded snapshot when there is no cache', () => {
    expect(resolveActive(root, tmpDir(), {}, '4.0.0')).toEqual({
      kind: 'embedded', dir: path.join(root, 'knowledge'), commit: null,
    });
  });

  it('uses the updated snapshot when the cache matches the plugin version', () => {
    const data = withCache({ pluginVersion: '4.0.0', commit: 'abc1234' });
    expect(resolveActive(root, data, {}, '4.0.0')).toEqual({
      kind: 'updated', dir: cacheCurrentDir(data), commit: 'abc1234',
    });
  });

  it('ignores a cache downloaded by another plugin version', () => {
    const data = withCache({ pluginVersion: '3.9.0', commit: 'abc1234' });
    expect(resolveActive(root, data, {}, '4.0.0').kind).toBe('embedded');
  });

  it('honors DELPHI_DEV_KB_SOURCE=embedded', () => {
    const data = withCache({ pluginVersion: '4.0.0', commit: 'abc1234' });
    expect(resolveActive(root, data, { DELPHI_DEV_KB_SOURCE: 'embedded' }, '4.0.0').kind).toBe('embedded');
  });

  // Review Focus 3: a broken cache must fall back silently.
  it.each([['corrupt json', '{oops'], ['missing fields', { commit: 'abc1234' }]])(
    'falls back to embedded with %s in meta.json',
    (_name, meta) => {
      const data = withCache(meta);
      expect(readCacheMeta(data)).toBeNull();
      expect(resolveActive(root, data, {}, '4.0.0').kind).toBe('embedded');
    },
  );

  it('falls back to embedded when current/ has no meta.json', () => {
    const data = tmpDir();
    fs.mkdirSync(cacheCurrentDir(data), { recursive: true });
    expect(resolveActive(root, data, {}, '4.0.0').kind).toBe('embedded');
  });
});
