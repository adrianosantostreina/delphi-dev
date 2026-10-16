import * as fs from 'node:fs';
import * as path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolveActive } from './active';
import { ensureIndex } from './index';
import {
  dataDir, embeddedKnowledgeDir, indexPath, isSafeKbPath, nodeSupportsIndex, pluginRootFromModule, readPluginVersion,
} from './paths';
import { logError, readConfig, readState, writeConfig } from './prefs';
import { formatInjection, MIN_SCORE, searchIndex } from './search';
import { readSnapshot, type Tier } from './snapshot';
import { isCheckDue, runUpdate, type Fetcher } from './update';

export interface KbContext {
  root: string;
  data: string;
  env: NodeJS.ProcessEnv;
  nodeVersion: string;
  pluginVersion: string;
  fetcher?: Fetcher;
}

// A type alias (not an interface) so it stays assignable to the SDK's CallToolResult,
// which carries an index signature.
export type ToolText = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

export interface Health {
  pluginVersion: string;
  remotePluginVersion: string | null;
  node: string;
  indexSupported: boolean;
  source: 'embedded' | 'updated';
  commit: string | null;
  counts: { canonical: number; community: number };
  lastCheck: string | null;
  lastResult: string | null;
  suggestions: 'on' | 'off';
  offline: boolean;
}

export const DEGRADED =
  'Busca indisponível: o delphi-dev precisa de Node 22.13+ para o índice. ' +
  'Procure direto nos .md em ~/.delphi-dev/kb-cache/current/ ou em knowledge/ na raiz do plugin.';

function reply(text: string, isError = false): ToolText {
  return isError ? { content: [{ type: 'text', text }], isError: true } : { content: [{ type: 'text', text }] };
}

export function kbSearch(ctx: KbContext, args: { query: string; limit?: number; tier?: Tier }): ToolText {
  if (!nodeSupportsIndex(ctx.nodeVersion)) return reply(DEGRADED, true);
  const active = resolveActive(ctx.root, ctx.data, ctx.env, ctx.pluginVersion);
  const db = ensureIndex(readSnapshot(active.dir), indexPath(ctx.data));
  // An explicit request has no relevance floor (the limit bounds the output); weak hits are labeled instead.
  const hits = searchIndex(db, args.query, { limit: args.limit ?? 3, tier: args.tier, minScore: 0 });
  return reply(hits.length ? formatInjection(hits, { lowConfidenceBelow: MIN_SCORE }) : 'Nenhum resultado relevante na base delphi-dev.');
}

export function kbGet(ctx: KbContext, args: { path: string }): ToolText {
  if (!isSafeKbPath(args.path)) return reply(`Caminho inválido: ${args.path}`, true);
  const active = resolveActive(ctx.root, ctx.data, ctx.env, ctx.pluginVersion);
  const parts = args.path.split('/');
  const candidates = [path.join(active.dir, ...parts)];
  // The downloaded snapshot has no INDEX.md (it only lists knowledge files): fall back to the embedded copy.
  if (active.kind === 'updated') candidates.push(path.join(embeddedKnowledgeDir(ctx.root), ...parts));
  const file = candidates.find((f) => fs.existsSync(f));
  if (!file) return reply(`Arquivo não encontrado na base: ${args.path}`, true);
  return reply(fs.readFileSync(file, 'utf8'));
}

export function healthOf(ctx: KbContext): Health {
  const active = resolveActive(ctx.root, ctx.data, ctx.env, ctx.pluginVersion);
  const docs = readSnapshot(active.dir).docs;
  const state = readState(ctx.data);
  const config = readConfig(ctx.data);
  return {
    pluginVersion: ctx.pluginVersion,
    remotePluginVersion: state.remotePluginVersion,
    node: ctx.nodeVersion,
    indexSupported: nodeSupportsIndex(ctx.nodeVersion),
    source: active.kind,
    commit: active.commit,
    counts: {
      canonical: docs.filter((d) => d.tier === 'canonical').length,
      community: docs.filter((d) => d.tier === 'community').length,
    },
    lastCheck: state.lastCheck,
    lastResult: state.lastResult,
    suggestions: config.suggestions,
    offline: config.offline || ctx.env.DELPHI_DEV_KB_OFFLINE === '1',
  };
}

export function kbHealth(ctx: KbContext): ToolText {
  return reply(JSON.stringify(healthOf(ctx), null, 2));
}

export async function kbUpdate(ctx: KbContext, args: { force?: boolean }): Promise<ToolText> {
  const result = await runUpdate({
    root: ctx.root, data: ctx.data, env: ctx.env, pluginVersion: ctx.pluginVersion,
    fetcher: ctx.fetcher, force: args.force ?? true,
  });
  const summary = { ...result, installedPluginVersion: ctx.pluginVersion, counts: healthOf(ctx).counts };
  return reply(JSON.stringify(summary, null, 2), result.status === 'failed');
}

export function kbPrefs(
  ctx: KbContext,
  args: { action: 'get' | 'set'; suggestions?: 'on' | 'off'; offline?: boolean },
): ToolText {
  if (args.action === 'get') return reply(JSON.stringify(readConfig(ctx.data)));
  const patch: { suggestions?: 'on' | 'off'; offline?: boolean } = {};
  if (args.suggestions) patch.suggestions = args.suggestions;
  if (typeof args.offline === 'boolean') patch.offline = args.offline;
  return reply(JSON.stringify(writeConfig(ctx.data, patch)));
}

function guarded<A>(ctx: KbContext, name: string, fn: (args: A) => ToolText | Promise<ToolText>) {
  return async (args: A): Promise<ToolText> => {
    try {
      return await fn(args);
    } catch (err) {
      logError(ctx.data, `mcp:${name}`, err);
      return reply(`Erro em ${name}: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  };
}

export function createServer(ctx: KbContext): McpServer {
  const server = new McpServer({ name: 'delphi-dev-kb', version: ctx.pluginVersion });
  server.registerTool('kb_search', {
    description: 'Busca na base de conhecimento Delphi do delphi-dev (canonical prevalece sobre community).',
    inputSchema: {
      query: z.string().min(2),
      limit: z.number().int().min(1).max(5).optional(),
      tier: z.enum(['canonical', 'community']).optional(),
    },
  }, guarded(ctx, 'kb_search', (args: { query: string; limit?: number; tier?: Tier }) => kbSearch(ctx, args)));
  server.registerTool('kb_get', {
    description: 'Devolve um arquivo inteiro da base, pelo path relativo (ex.: core/encoding-utf8-bom.md).',
    inputSchema: { path: z.string() },
  }, guarded(ctx, 'kb_get', (args: { path: string }) => kbGet(ctx, args)));
  server.registerTool('kb_update', {
    description: 'Atualiza a base a partir do release kb-latest e informa se há versão nova do plugin.',
    inputSchema: { force: z.boolean().optional() },
  }, guarded(ctx, 'kb_update', (args: { force?: boolean }) => kbUpdate(ctx, args)));
  server.registerTool('kb_health', {
    description: 'Estado da base: fonte, commit, contagem por tier, última checagem, Node e versões.',
    inputSchema: {},
  }, guarded(ctx, 'kb_health', (_args: Record<string, never>) => kbHealth(ctx)));
  server.registerTool('kb_prefs', {
    description: 'Lê ou grava preferências do delphi-dev (sugestões de contribuição, modo offline).',
    inputSchema: {
      action: z.enum(['get', 'set']),
      suggestions: z.enum(['on', 'off']).optional(),
      offline: z.boolean().optional(),
    },
  }, guarded(ctx, 'kb_prefs', (args: { action: 'get' | 'set'; suggestions?: 'on' | 'off'; offline?: boolean }) =>
    kbPrefs(ctx, args)));
  return server;
}

export function contextFromRuntime(): KbContext {
  const root = pluginRootFromModule(import.meta.url);
  return { root, data: dataDir(), env: process.env, nodeVersion: process.versions.node, pluginVersion: readPluginVersion(root) };
}

export async function main(): Promise<void> {
  const ctx = contextFromRuntime();
  await createServer(ctx).connect(new StdioServerTransport());
  if (isCheckDue(ctx.data, new Date())) {
    runUpdate({ root: ctx.root, data: ctx.data, env: ctx.env, pluginVersion: ctx.pluginVersion })
      .catch((err) => logError(ctx.data, 'mcp:background-update', err));
  }
}
