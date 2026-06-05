import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { openDb, clearDb, countChunks } from './db';
import { embedFile } from './embed';

const DEFAULT_KNOWLEDGE_DIR = path.join(
  os.homedir(), '.claude', 'plugins', 'delphi-dev', 'knowledge'
);
const DEFAULT_DB_PATH = path.join(
  os.homedir(), '.claude', 'plugins', 'delphi-dev', 'rag', 'rag.db'
);

function findMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'local') {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'INDEX.md') {
      files.push(fullPath);
    }
  }
  return files;
}

async function main(): Promise<void> {
  const knowledgeDir = process.argv[2] ?? DEFAULT_KNOWLEDGE_DIR;
  const dbPath = process.argv[3] ?? DEFAULT_DB_PATH;

  console.log(`Building RAG from: ${knowledgeDir}`);
  console.log(`Output database: ${dbPath}`);

  const db = openDb(dbPath);
  clearDb(db);
  db.close();

  const files = findMarkdownFiles(knowledgeDir);
  console.log(`Found ${files.length} markdown files`);

  let totalChunks = 0;
  for (const file of files) {
    const relative = path.relative(knowledgeDir, file);
    process.stdout.write(`  Embedding: ${relative}... `);
    const count = await embedFile(file, dbPath);
    console.log(`${count} chunks`);
    totalChunks += count;
  }

  const finalDb = openDb(dbPath);
  const final = countChunks(finalDb);
  finalDb.close();
  console.log(`\nRAG build complete: ${final} chunks from ${files.length} files (${totalChunks} embedded)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
