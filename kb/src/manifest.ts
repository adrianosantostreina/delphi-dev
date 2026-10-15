import { isSafeKbPath } from './paths';
import type { Snapshot } from './snapshot';

export interface ManifestFile {
  path: string;
  sha256: string;
  bytes: number;
}

export interface Manifest {
  schema: 1;
  commit: string;
  generatedAt: string;
  pluginVersion: string;
  files: ManifestFile[];
}

export interface FileDiff {
  added: ManifestFile[];
  changed: ManifestFile[];
  removed: string[];
}

export function buildManifest(snapshot: Snapshot, commit: string, pluginVersion: string, now = new Date()): Manifest {
  return {
    schema: 1,
    commit,
    generatedAt: now.toISOString(),
    pluginVersion,
    files: snapshot.docs.map((d) => ({ path: d.path, sha256: d.sha256, bytes: d.bytes })),
  };
}

/** The manifest comes from the network: every path must stay inside knowledge/. */
export function parseManifest(input: unknown): Manifest {
  const m = input as Partial<Manifest> | null;
  if (
    !m || m.schema !== 1 || typeof m.commit !== 'string' || !/^[0-9a-f]{7,40}$/.test(m.commit) ||
    typeof m.generatedAt !== 'string' || typeof m.pluginVersion !== 'string' || !Array.isArray(m.files)
  ) {
    throw new Error('invalid manifest');
  }
  for (const f of m.files) {
    if (
      !f || typeof f.path !== 'string' || !isSafeKbPath(f.path) ||
      typeof f.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(f.sha256) || typeof f.bytes !== 'number'
    ) {
      throw new Error(`invalid manifest entry: ${JSON.stringify(f)}`);
    }
  }
  return m as Manifest;
}

export function diffFiles(local: ManifestFile[], remote: ManifestFile[]): FileDiff {
  const localHash = new Map(local.map((f) => [f.path, f.sha256]));
  const remotePaths = new Set(remote.map((f) => f.path));
  return {
    added: remote.filter((f) => !localHash.has(f.path)),
    changed: remote.filter((f) => localHash.has(f.path) && localHash.get(f.path) !== f.sha256),
    removed: local.filter((f) => !remotePaths.has(f.path)).map((f) => f.path),
  };
}
