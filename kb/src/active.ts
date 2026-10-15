import * as fs from 'node:fs';
import * as path from 'node:path';
import { cacheCurrentDir, embeddedKnowledgeDir } from './paths';

export interface ActiveSource {
  kind: 'embedded' | 'updated';
  dir: string;
  commit: string | null;
}

export interface CacheMeta {
  pluginVersion: string;
  commit: string;
}

export function readCacheMeta(data: string): CacheMeta | null {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(cacheCurrentDir(data), 'meta.json'), 'utf8'));
    if (typeof raw?.pluginVersion === 'string' && typeof raw?.commit === 'string') {
      return { pluginVersion: raw.pluginVersion, commit: raw.commit };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * kb-latest is rebuilt on every merge to master and releases come from master, so a
 * cache downloaded for this plugin version is never older than the embedded copy.
 * A plugin update invalidates the cache until the next check refreshes it.
 */
export function resolveActive(root: string, data: string, env: NodeJS.ProcessEnv, pluginVersion: string): ActiveSource {
  const embedded: ActiveSource = { kind: 'embedded', dir: embeddedKnowledgeDir(root), commit: null };
  if (env.DELPHI_DEV_KB_SOURCE === 'embedded') return embedded;
  const meta = readCacheMeta(data);
  if (!meta || meta.pluginVersion !== pluginVersion) return embedded;
  return { kind: 'updated', dir: cacheCurrentDir(data), commit: meta.commit };
}
