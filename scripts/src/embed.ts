import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { openDb, insertChunk } from './db';
import { chunkText, normalizeChunks, type Category } from './capture';

const RAG_DB_PATH =
  process.env.RAG_DB_PATH ?? path.join(os.homedir(), '.claude', 'plugins', 'delphi-dev', 'rag', 'rag.db');

interface FeatureTensor {
  data: Float32Array;
  dims: number[];
}
type Embedder = (text: string, opts: Record<string, unknown>) => Promise<FeatureTensor>;

let embedder: Embedder | null = null;

async function getEmbedder(): Promise<Embedder> {
  if (embedder) return embedder;
  const { pipeline } = await import('@xenova/transformers');
  embedder = (await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')) as unknown as Embedder;
  return embedder;
}

export async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  const embed = await getEmbedder();
  const results: Float32Array[] = [];
  for (const text of texts) {
    // pooling:'mean' + normalize -> a single flat 384-dim vector in `data`.
    const output = await embed(text, { pooling: 'mean', normalize: true });
    results.push(Float32Array.from(output.data));
  }
  return results;
}

function parseCategoryFromContent(content: string): Category {
  const header = content.match(/^##\s+\[(\w+)\]/);
  if (header) {
    const label = header[1].toLowerCase();
    if (['bugs', 'architecture', 'patterns', 'failures'].includes(label)) {
      return label as Category;
    }
  }
  return 'general';
}

export async function embedFile(mdPath: string, dbPath: string = RAG_DB_PATH): Promise<number> {
  const content = fs.readFileSync(mdPath, 'utf-8');
  const db = openDb(dbPath);

  // Split by section separators if present, otherwise chunk the whole text.
  const sections = content.split(/\n---\n/).filter(Boolean);
  const chunks = sections.length > 1 ? sections : normalizeChunks(chunkText(content, 250, 50));

  const embeddings = await embedTexts(chunks);
  let inserted = 0;

  for (let i = 0; i < chunks.length; i++) {
    const category = parseCategoryFromContent(chunks[i]);
    const cleanContent = chunks[i].replace(/^##\s+\[\w+\]\s*/, '').trim();
    insertChunk(db, {
      path: mdPath,
      chunkIndex: i,
      content: cleanContent,
      embedding: embeddings[i],
      category,
      agent: null,
    });
    inserted++;
  }

  db.close();
  return inserted;
}

// CLI entry point.
async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: embed.js <path-to-md>');
    process.exit(1);
  }
  const count = await embedFile(path.resolve(filePath));
  console.log(`Embedded ${count} chunks from ${filePath}`);
}

if (require.main === module) {
  main().catch(console.error);
}
