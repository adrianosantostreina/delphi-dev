import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import type { CliIO } from './cli';
import { fixEncoding } from './hook-fix-encoding';
import { lintRepo } from './lint';

export function lintCommand(args: string[], io: CliIO): number {
  const { values } = parseArgs({ args, options: { root: { type: 'string' } } });
  const findings = lintRepo(values.root ?? process.cwd());
  for (const f of findings) {
    io.out(`${f.file}${f.line ? `:${f.line}` : ''} [${f.rule}] ${f.message}`);
  }
  io.out(`${findings.length} achado(s) de portabilidade`);
  return findings.length ? 1 : 0;
}

export function fixEncodingCommand(args: string[], io: CliIO): number {
  if (!args.length) {
    io.err('usage: kb-cli fix-encoding <arquivo...>');
    return 64;
  }
  let changed = 0;
  for (const file of args) {
    const abs = path.resolve(file);
    let before: Buffer;
    try {
      before = fs.readFileSync(abs);
    } catch {
      io.err(`nao encontrado: ${file}`);
      continue;
    }
    try {
      fixEncoding(abs);
    } catch (err) {
      io.err(`falhou: ${file}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    if (before.equals(fs.readFileSync(abs))) {
      io.out(`ok ${file}`);
    } else {
      changed++;
      io.out(`corrigido ${file}`);
    }
  }
  io.out(`${changed} arquivo(s) corrigido(s)`);
  return 0;
}
