import * as os from 'os';
import * as path from 'path';

/**
 * Single source of truth for the RAG database location.
 *
 * It used to be declared separately in embed.ts and search.ts; keeping one copy
 * avoids the two halves of the pipeline ever disagreeing about which file they
 * are reading and writing.
 */
export const RAG_DB_PATH =
  process.env.RAG_DB_PATH ??
  path.join(os.homedir(), '.claude', 'plugins', 'delphi-dev', 'rag', 'rag.db');
