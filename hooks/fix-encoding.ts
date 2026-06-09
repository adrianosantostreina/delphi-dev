#!/usr/bin/env node
/**
 * PostToolUse hook — injects a UTF-8 BOM into Delphi files written without one.
 * Input (stdin): JSON with { tool_name, tool_input: { file_path } }
 */
import * as fs from 'fs';

const DELPHI_EXTENSIONS = ['.pas', '.dfm', '.dpr', '.dpk', '.inc', '.fmx'];
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function hasBom(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
}

async function main(): Promise<void> {
  let input = '';
  process.stdin.setEncoding('utf-8');
  for await (const chunk of process.stdin) input += chunk;

  let filePath: string | undefined;
  try {
    const payload = JSON.parse(input);
    filePath = payload?.tool_input?.file_path;
  } catch {
    return;
  }

  if (!filePath) return;
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (!DELPHI_EXTENSIONS.includes(ext)) return;
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath);
  if (hasBom(content)) return;

  const withBom = Buffer.concat([UTF8_BOM, content]);
  fs.writeFileSync(filePath, withBom);
}

main().catch(() => {}); // silent fail — hook must not block the user
