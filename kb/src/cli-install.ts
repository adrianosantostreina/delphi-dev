import { parseArgs } from 'node:util';
import type { CliIO } from './cli';
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
