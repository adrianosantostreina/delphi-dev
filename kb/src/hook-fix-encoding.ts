import * as fs from 'node:fs';
import * as path from 'node:path';

// Source files get a UTF-8 BOM. Forms never do: a BOM before `object` breaks ObjectTextToBinary
// ("Error creating form: Invalid stream format"), and raw UTF-8 without BOM is read as ANSI by the
// resource compiler. Forms are rewritten the way the IDE writes them: #NNN escapes, pure ASCII.
// See knowledge dfm-fmx-sem-bom.md.
const BOM_EXTENSIONS = ['.pas', '.dpr', '.dpk', '.inc'];
const FORM_EXTENSIONS = ['.dfm', '.fmx'];
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/** Escapes non-ASCII characters inside '...' literals as #NNN (one per UTF-16 code unit). */
export function escapeFormText(text: string): { text: string; nonAsciiOutsideStrings: boolean } {
  let out = '';
  let nonAsciiOutsideStrings = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch !== "'") {
      if (ch.charCodeAt(0) > 127) nonAsciiOutsideStrings = true;
      out += ch;
      i++;
      continue;
    }
    i++; // opening quote
    const parts: string[] = [];
    let plain = '';
    const flush = (): void => {
      if (plain) parts.push(`'${plain.replace(/'/g, "''")}'`);
      plain = '';
    };
    let closed = false;
    while (i < text.length) {
      const c = text[i];
      if (c === "'") {
        if (text[i + 1] === "'") {
          plain += "'";
          i += 2;
          continue;
        }
        i++; // closing quote
        closed = true;
        break;
      }
      if (c === '\n' || c === '\r') break;
      const code = c.charCodeAt(0);
      if (code > 127) {
        flush();
        parts.push(`#${code}`);
      } else {
        plain += c;
      }
      i++;
    }
    if (!closed) throw new Error('unterminated string literal');
    flush();
    out += parts.length ? parts.join('') : "''";
  }
  return { text: out, nonAsciiOutsideStrings };
}

function fixForm(filePath: string, content: Buffer): void {
  if (content.every((b) => b < 128)) return;
  // Binary DFM (TPF0 header) and anything that is not valid UTF-8 (ANSI/Latin-1 legacy forms) are left alone.
  if (content.subarray(0, 4).toString('latin1') === 'TPF0') return;
  const hadBom = content.subarray(0, 3).equals(UTF8_BOM);
  let source: string;
  let escaped: { text: string; nonAsciiOutsideStrings: boolean };
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(content.subarray(hadBom ? 3 : 0));
    escaped = escapeFormText(source);
  } catch {
    return;
  }
  const { text, nonAsciiOutsideStrings } = escaped;
  // A non-ASCII identifier only parses with the BOM: keep it (load-bearing) and leave the rename to the skills.
  const keepBom = hadBom && nonAsciiOutsideStrings;
  const next = Buffer.concat([keepBom ? UTF8_BOM : Buffer.alloc(0), Buffer.from(text, 'utf8')]);
  if (!next.equals(content)) fs.writeFileSync(filePath, next);
}

export function fixEncoding(filePath: string): void {
  const ext = path.extname(filePath).toLowerCase();
  if (!fs.existsSync(filePath)) return;
  if (FORM_EXTENSIONS.includes(ext)) {
    fixForm(filePath, fs.readFileSync(filePath));
    return;
  }
  if (!BOM_EXTENSIONS.includes(ext)) return;
  const content = fs.readFileSync(filePath);
  if (content.subarray(0, 3).equals(UTF8_BOM)) return;
  // UTF-16 (FF FE / FE FF) and anything that is not valid UTF-8 (ANSI/Latin-1) must not get a UTF-8 BOM.
  if (content.length >= 2 && ((content[0] === 0xff && content[1] === 0xfe) || (content[0] === 0xfe && content[1] === 0xff))) return;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(content);
  } catch {
    return;
  }
  fs.writeFileSync(filePath, Buffer.concat([UTF8_BOM, content]));
}

export function extractPatchPaths(patch: string): string[] {
  const out: string[] = [];
  for (const line of patch.replace(/\r\n/g, '\n').split('\n')) {
    const m = line.match(/^\*\*\* (?:Add File|Update File|Move to): (.+?)\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

function collectPatches(value: unknown, acc: string[]): void {
  if (typeof value === 'string') {
    if (value.includes('*** Begin Patch')) acc.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectPatches(item, acc);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectPatches(item, acc);
  }
}

/** Claude Code sends tool_input.file_path; Codex sends an apply_patch body. */
export function pathsFromPayload(payload: unknown): string[] {
  const p = payload as { tool_input?: unknown; cwd?: unknown } | null;
  if (!p || typeof p !== 'object') return [];
  const cwd = typeof p.cwd === 'string' ? p.cwd : process.cwd();
  const input = p.tool_input as { file_path?: unknown } | undefined;
  const raw: string[] = [];
  if (input && typeof input === 'object' && typeof input.file_path === 'string') raw.push(input.file_path);
  const patches: string[] = [];
  collectPatches(input, patches);
  for (const patch of patches) raw.push(...extractPatchPaths(patch));
  return [...new Set(raw.map((file) => path.resolve(cwd, file)))];
}

export async function main(input: NodeJS.ReadableStream = process.stdin): Promise<void> {
  let files: string[];
  try {
    // Decode once from the joined bytes: a multi-byte character split across chunks must not be corrupted.
    const chunks: Buffer[] = [];
    for await (const chunk of input) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    files = pathsFromPayload(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch {
    return; // silent: a hook must never block the user
  }
  for (const file of files) {
    try {
      fixEncoding(file);
    } catch {
      // one failing file must not skip the rest of a multi-file patch
    }
  }
}
