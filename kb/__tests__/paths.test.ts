import { describe, it, expect } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  dataDir, isSafeKbPath, nodeSupportsIndex, pluginRootFromModule, rawFileUrl, readPluginVersion,
  cacheCurrentDir, indexPath, MANIFEST_URL,
} from '../src/paths';
import { tmpDir, writeTree } from './helpers';

describe('paths', () => {
  it('uses DELPHI_DEV_DATA when set, ~/.delphi-dev otherwise', () => {
    expect(dataDir({ DELPHI_DEV_DATA: '/x/y' })).toBe('/x/y');
    expect(dataDir({})).toBe(path.join(os.homedir(), '.delphi-dev'));
  });

  it('derives cache and index paths from the data dir', () => {
    expect(cacheCurrentDir('/d')).toBe(path.join('/d', 'kb-cache', 'current'));
    expect(indexPath('/d')).toBe(path.join('/d', 'kb.db'));
  });

  it('accepts only knowledge paths under core, fmx or community', () => {
    expect(isSafeKbPath('core/a.md')).toBe(true);
    expect(isSafeKbPath('community/sub/2026-a.md')).toBe(true);
    expect(isSafeKbPath('local/a.md')).toBe(false);
    expect(isSafeKbPath('core/../../etc/passwd.md')).toBe(false);
    expect(isSafeKbPath('core/./a.md')).toBe(false);
    expect(isSafeKbPath('/core/a.md')).toBe(false);
    expect(isSafeKbPath('core\a.md')).toBe(false);
    expect(isSafeKbPath('core/a.txt')).toBe(false);
  });

  it('builds raw URLs pinned to a commit', () => {
    expect(rawFileUrl('abc1234', 'core/a.md')).toBe(
      'https://raw.githubusercontent.com/adrianosantostreina/delphi-dev/abc1234/knowledge/core/a.md',
    );
    expect(MANIFEST_URL).toBe(
      'https://github.com/adrianosantostreina/delphi-dev/releases/download/kb-latest/kb-manifest.json',
    );
  });

  it('resolves the plugin root from a runtime/ module URL', () => {
    const root = tmpDir();
    const url = pathToFileURL(path.join(root, 'runtime', 'kb-mcp.mjs')).href;
    expect(pluginRootFromModule(url)).toBe(path.resolve(root));
  });

  it('reads the plugin version or returns unknown', () => {
    const root = tmpDir();
    expect(readPluginVersion(root)).toBe('unknown');
    writeTree(root, { '.claude-plugin/plugin.json': JSON.stringify({ version: '4.0.0' }) });
    expect(readPluginVersion(root)).toBe('4.0.0');
  });

  it('requires Node 22.13+ for the index', () => {
    expect(nodeSupportsIndex('18.20.4')).toBe(false);
    expect(nodeSupportsIndex('22.12.0')).toBe(false);
    expect(nodeSupportsIndex('22.13.0')).toBe(true);
    expect(nodeSupportsIndex('24.18.0')).toBe(true);
  });
});
