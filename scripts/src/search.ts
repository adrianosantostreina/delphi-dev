import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { openDb, searchSimilar, type SearchResult } from './db';
import { embedTexts } from './embed';

const RAG_DB_PATH =
  process.env.RAG_DB_PATH ?? path.join(os.homedir(), '.claude', 'plugins', 'delphi-dev', 'rag', 'rag.db');

const PRECEDENCE_DIRECTIVE =
  'Canonical é autoritativo; community é complementar e nunca sobrepõe o canonical.';

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return '';
  const lines = results
    .map((r) => `[${r.tier}/${r.category}] ${r.content.trim()}`)
    .join('\n\n');
  return `\n[RELEVANT KNOWLEDGE FROM DELPHI-DEV RAG]\n(${PRECEDENCE_DIRECTIVE})\n\n${lines}\n[/RELEVANT KNOWLEDGE]\n`;
}

async function main(): Promise<void> {
  let prompt = '';
  process.stdin.setEncoding('utf-8');
  for await (const chunk of process.stdin) {
    prompt += chunk;
  }
  if (!prompt.trim()) return;

  // The UserPromptSubmit hook delivers a JSON payload; extract the prompt text.
  let queryText = prompt;
  try {
    const payload = JSON.parse(prompt);
    queryText = payload.prompt ?? payload.message ?? prompt;
  } catch {
    // not JSON, use as-is
  }

  const agentName = process.env.CLAUDE_AGENT_NAME ?? undefined;

  // RAG unavailable (no db yet, missing model offline) must never break the
  // user's prompt — fail silently with no output.
  if (!fs.existsSync(RAG_DB_PATH)) return;

  try {
    const db = openDb(RAG_DB_PATH);
    const [queryEmbedding] = await embedTexts([queryText]);
    const results = searchSimilar(db, queryEmbedding, 3, agentName);
    db.close();
    const output = formatSearchResults(results);
    if (output) process.stdout.write(output);
  } catch {
    // silent fail — the hook must not interrupt the user's workflow
  }
}

if (require.main === module) {
  main().catch(() => {}); // silent fail
}
