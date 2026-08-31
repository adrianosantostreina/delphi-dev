import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type Category = 'bugs' | 'architecture' | 'patterns' | 'failures' | 'general';

export interface CapturedChunk {
  content: string;
  category: Category;
  agent: string | null;
  sourcePath: string;
  chunkIndex: number;
}

const CATEGORY_LABELS = ['bugs', 'architecture', 'patterns', 'failures', 'general'] as const;

const KNOWLEDGE_LOCAL_DIR = path.join(
  os.homedir(), '.claude', 'plugins', 'delphi-dev', 'knowledge', 'local'
);

export function chunkText(text: string, maxTokens: number, overlap: number): string[] {
  // Approximate tokenization: 1 token ≈ 1 word for chunking purposes.
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxTokens) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + maxTokens, words.length);
    chunks.push(words.slice(start, end).join(' '));
    if (end === words.length) break;
    start += maxTokens - overlap;
  }
  return chunks;
}

export function normalizeChunks(chunks: string[]): string[] {
  return chunks.map((c) => c.trim()).filter((c) => c.length > 0);
}

async function classifyChunk(content: string): Promise<Category> {
  try {
    const { pipeline } = await import('@xenova/transformers');
    const classifier = await pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-small');
    const result = await classifier(content, CATEGORY_LABELS as unknown as string[]);
    return (result as { labels: string[] }).labels[0] as Category;
  } catch {
    return 'general'; // fallback if model not available offline
  }
}

// The Stop / SubagentStop hooks deliver a JSON *event envelope* on stdin, not the
// conversation. The envelope carries `transcript_path`, pointing at the session
// .jsonl. Indexing the envelope itself poisons the corpus with session_id /
// transcript_path noise — that was the v3.0.0 bug.
export function readHookTranscript(raw: string): string {
  let payload: { transcript_path?: string } | null = null;
  try {
    payload = JSON.parse(raw) as { transcript_path?: string };
  } catch {
    return raw; // not JSON — plain text, use as-is
  }
  if (!payload || typeof payload.transcript_path !== 'string') return raw;
  if (!fs.existsSync(payload.transcript_path)) return '';
  try {
    return extractTranscriptText(fs.readFileSync(payload.transcript_path, 'utf-8'));
  } catch {
    return '';
  }
}

// Keep only what a human actually said or was told. Indexing the whole .jsonl
// would trade envelope noise for tool_use / tool_result / metadata noise.
export function extractTranscriptText(jsonl: string): string {
  const parts: string[] = [];
  for (const line of jsonl.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event: { type?: string; message?: { content?: unknown } };
    try {
      event = JSON.parse(line) as { type?: string; message?: { content?: unknown } };
    } catch {
      continue; // malformed line, skip
    }
    if (event.type !== 'user' && event.type !== 'assistant') continue;
    const content = event.message?.content;
    if (typeof content === 'string') {
      parts.push(content);
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if (block && typeof block === 'object' && (block as { type?: string }).type === 'text') {
          const text = (block as { text?: string }).text;
          if (text) parts.push(text);
        }
      }
    }
  }
  return parts.join('\n\n');
}

export async function captureFromTranscript(
  transcriptText: string,
  mode: 'agent' | 'session',
  agentName: string | null
): Promise<CapturedChunk[]> {
  const rawChunks = chunkText(transcriptText, 250, 50);
  const normalized = normalizeChunks(rawChunks);
  const stamp = new Date().toISOString().slice(0, 10);
  const outputFile = path.join(
    KNOWLEDGE_LOCAL_DIR,
    `${stamp}-${mode}-${agentName ?? 'session'}.md`
  );

  const chunks: CapturedChunk[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const category = await classifyChunk(normalized[i]);
    chunks.push({
      content: normalized[i],
      category,
      agent: agentName,
      sourcePath: outputFile,
      chunkIndex: i,
    });
  }

  if (!fs.existsSync(KNOWLEDGE_LOCAL_DIR)) {
    fs.mkdirSync(KNOWLEDGE_LOCAL_DIR, { recursive: true });
  }
  const md = chunks
    .map((c) => `## [${c.category}]\n\n${c.content}`)
    .join('\n\n---\n\n');
  fs.writeFileSync(outputFile, md);

  return chunks;
}

// CLI entry point called by the SubagentStop / Stop hook.
async function main(): Promise<void> {
  const mode = (process.argv.find((a) => a.startsWith('--mode='))?.split('=')[1] ?? 'session') as
    | 'agent'
    | 'session';
  const agentName = process.env.CLAUDE_AGENT_NAME ?? null;

  let raw = '';
  process.stdin.setEncoding('utf-8');
  for await (const chunk of process.stdin) {
    raw += chunk;
  }
  if (!raw.trim()) return;

  const transcriptText = readHookTranscript(raw);
  if (!transcriptText.trim()) return;

  const chunks = await captureFromTranscript(transcriptText, mode, agentName);
  if (chunks.length > 0) {
    // Dynamic import avoids load-time coupling with the embedding model.
    const { embedFile } = await import('./embed');
    const { RAG_DB_PATH } = await import('./paths');
    // 'local' — captured from this machine's own sessions, reviewed by nobody.
    // It must never outrank curated knowledge. See db.ts Tier.
    await embedFile(chunks[0].sourcePath, RAG_DB_PATH, 'local');
  }
}

if (require.main === module) {
  main().catch(console.error);
}
