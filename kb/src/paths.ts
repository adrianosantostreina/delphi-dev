import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = 'adrianosantostreina/delphi-dev';
export const MANIFEST_URL = `https://github.com/${REPO}/releases/download/kb-latest/kb-manifest.json`;
export const KB_DIRS = ['core', 'fmx', 'community'] as const;

const SAFE_KB_PATH = /^(core|fmx|community)\/[A-Za-z0-9._/-]+\.md$/;

/** Relative POSIX path inside knowledge/ that cannot escape it. */
export function isSafeKbPath(rel: string): boolean {
  if (!SAFE_KB_PATH.test(rel)) return false;
  return !rel.split('/').some((segment) => segment === '..' || segment === '.' || segment === '');
}

export function rawFileUrl(commit: string, rel: string): string {
  return `https://raw.githubusercontent.com/${REPO}/${commit}/knowledge/${rel}`;
}

export function dataDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.DELPHI_DEV_DATA || path.join(os.homedir(), '.delphi-dev');
}

export function cacheCurrentDir(data: string): string {
  return path.join(data, 'kb-cache', 'current');
}

export function indexPath(data: string): string {
  return path.join(data, 'kb.db');
}

/** runtime/<bundle>.mjs lives one level below the plugin root. */
export function pluginRootFromModule(moduleUrl: string): string {
  return path.resolve(path.dirname(fileURLToPath(moduleUrl)), '..');
}

export function embeddedKnowledgeDir(root: string): string {
  return path.join(root, 'knowledge');
}

export function readPluginVersion(root: string): string {
  try {
    const raw = fs.readFileSync(path.join(root, '.claude-plugin', 'plugin.json'), 'utf8');
    const version = JSON.parse(raw).version;
    return typeof version === 'string' ? version : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** node:sqlite without a flag needs 22.13+. */
export function nodeSupportsIndex(version: string = process.versions.node): boolean {
  const [major, minor] = version.split('.').map(Number);
  return major > 22 || (major === 22 && minor >= 13);
}
