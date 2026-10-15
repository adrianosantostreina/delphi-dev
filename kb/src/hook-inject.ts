import { resolveActive } from './active';
import { hasExplicitDelphiSignal, isDelphiProjectDir } from './delphi-intent';
import { ensureIndex } from './index';
import { dataDir, indexPath, nodeSupportsIndex, pluginRootFromModule, readPluginVersion } from './paths';
import { logError } from './prefs';
import { formatInjection, MIN_SCORE, searchIndex, STRONG_SCORE } from './search';
import { readSnapshot } from './snapshot';

export interface InjectContext {
  root: string;
  data: string;
  env: NodeJS.ProcessEnv;
  nodeVersion: string;
  pluginVersion: string;
  minScore?: number;
  strongScore?: number;
}

export const HOOK_DEADLINE_MS = 1000;

export function buildInjection(payload: unknown, ctx: InjectContext): string {
  if (!nodeSupportsIndex(ctx.nodeVersion)) return '';
  const p = payload as { prompt?: unknown; cwd?: unknown } | null;
  const prompt = p && typeof p.prompt === 'string' ? p.prompt : '';
  if (!prompt.trim()) return '';
  const explicit = hasExplicitDelphiSignal(prompt);
  if (!explicit && !isDelphiProjectDir(typeof p?.cwd === 'string' ? p.cwd : undefined)) return '';

  const active = resolveActive(ctx.root, ctx.data, ctx.env, ctx.pluginVersion);
  const db = ensureIndex(readSnapshot(active.dir), indexPath(ctx.data));
  const minScore = explicit ? ctx.minScore ?? MIN_SCORE : ctx.strongScore ?? STRONG_SCORE;
  const text = formatInjection(searchIndex(db, prompt, { limit: 3, minScore }));
  if (!text) return '';
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text } });
}

export async function main(): Promise<void> {
  const deadline = setTimeout(() => process.exit(0), HOOK_DEADLINE_MS);
  const root = pluginRootFromModule(import.meta.url);
  const data = dataDir();
  try {
    let raw = '';
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) raw += chunk;
    const out = buildInjection(JSON.parse(raw), {
      root, data, env: process.env, nodeVersion: process.versions.node, pluginVersion: readPluginVersion(root),
    });
    if (out) process.stdout.write(out);
  } catch (err) {
    logError(data, 'hook-inject', err);
  } finally {
    clearTimeout(deadline);
  }
}
