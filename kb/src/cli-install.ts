import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import type { CliIO } from './cli';
import { fixEncoding } from './hook-fix-encoding';
import { doctor, installTargets, uninstallTargets, type InstallReport, type InstallTarget } from './install/install';
import { lintRepo } from './lint';
import { pluginRootFromModule } from './paths';

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

// ---- install / uninstall / doctor ------------------------------------------

type Verb = 'install' | 'uninstall' | 'doctor';

function parseTargets(value: string, verb: Verb): InstallTarget[] | string {
  if (value === 'all') return ['codex', 'opencode'];
  if (value === 'codex' || value === 'opencode') return [value];
  if (value === 'claude') {
    const how = verb === 'install'
      ? 'instale com /plugin install delphi-dev@delphi-dev (ou npx delphi-dev)'
      : verb === 'uninstall'
        ? 'remova com /plugin uninstall delphi-dev dentro do Claude Code'
        : 'confira com /plugin dentro do Claude Code';
    return `O alvo claude usa o marketplace e nao e gerenciado por kb-cli: ${how}.`;
  }
  return `alvo desconhecido: ${value} (use codex, opencode ou all)`;
}

/** --home wins; else the HOME the process was given (so tests and wrappers can isolate it); else the OS home. */
function homeOf(flag: string | undefined, io: CliIO): string {
  if (flag) return path.resolve(flag);
  const fromEnv = process.platform === 'win32' ? io.env.USERPROFILE : io.env.HOME;
  return fromEnv || os.homedir();
}

/** Usage errors from parseArgs (unknown flag, stray argument) are exit 64; anything else that throws is exit 1. */
function guarded(io: CliIO, run: () => number): number {
  try {
    return run();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? '';
    io.err(err instanceof Error ? err.message : String(err));
    return code.startsWith('ERR_PARSE_ARGS') ? 64 : 1;
  }
}

function printReport(io: CliIO, report: InstallReport, dryRun: boolean): void {
  const prefix = dryRun ? '[dry-run] ' : '';
  for (const p of report.written) io.out(`${prefix}+ ${p}`);
  for (const p of report.removed) io.out(`${prefix}- ${p}`);
  for (const s of report.skipped) io.out(`${prefix}! ignorado ${s.path} (${s.reason})`);
  for (const w of report.warnings) io.out(`${prefix}? ${w}`);
  for (const n of report.notes) io.out(`${prefix}i ${n}`);
  io.out(
    `${prefix}${report.written.length} gravado(s), ${report.removed.length} removido(s), `
    + `${report.unchanged} sem mudanca, ${report.skipped.length} ignorado(s), ${report.warnings.length} aviso(s)`,
  );
}

function scopeOf(value: string | undefined, io: CliIO): 'user' | 'project' | null {
  if (value === undefined || value === 'user') return 'user';
  if (value === 'project') return 'project';
  io.err(`--scope invalido: ${value} (use user ou project)`);
  return null;
}

export function installCommand(args: string[], io: CliIO): number {
  return guarded(io, () => {
    const { values } = parseArgs({
      args,
      options: {
        target: { type: 'string' }, scope: { type: 'string' }, project: { type: 'string' },
        home: { type: 'string' }, checkout: { type: 'string' }, from: { type: 'string' },
        'dry-run': { type: 'boolean' }, force: { type: 'boolean' },
      },
    });
    const targets = parseTargets(values.target ?? 'all', 'install');
    if (typeof targets === 'string') {
      io.err(targets);
      return 64;
    }
    const scope = scopeOf(values.scope, io);
    if (!scope) return 64;
    if (scope === 'project' && !values.project) {
      io.err('--scope project exige --project <pasta>');
      return 64;
    }
    const dryRun = !!values['dry-run'];
    const report = installTargets({
      targets, scope, project: values.project ? path.resolve(values.project) : undefined,
      home: homeOf(values.home, io),
      checkout: path.resolve(values.checkout ?? values.from ?? pluginRootFromModule(import.meta.url)),
      dryRun, force: !!values.force, env: io.env,
    });
    printReport(io, report, dryRun);
    return 0;
  });
}

export function uninstallCommand(args: string[], io: CliIO): number {
  return guarded(io, () => {
    const { values } = parseArgs({
      args,
      options: { target: { type: 'string' }, home: { type: 'string' }, 'dry-run': { type: 'boolean' }, force: { type: 'boolean' } },
    });
    const targets = parseTargets(values.target ?? 'all', 'uninstall');
    if (typeof targets === 'string') {
      io.err(targets);
      return 64;
    }
    const dryRun = !!values['dry-run'];
    const report = uninstallTargets({
      targets, home: homeOf(values.home, io), dryRun, force: !!values.force, env: io.env,
    });
    printReport(io, report, dryRun);
    return 0;
  });
}

export function doctorCommand(args: string[], io: CliIO): number {
  return guarded(io, () => {
    const { values } = parseArgs({
      args,
      options: { target: { type: 'string' }, home: { type: 'string' }, scope: { type: 'string' } },
    });
    const targets = parseTargets(values.target ?? 'all', 'doctor');
    if (typeof targets === 'string') {
      io.err(targets);
      return 64;
    }
    const scope = scopeOf(values.scope, io);
    if (!scope) return 64;
    const checks = doctor({ targets, home: homeOf(values.home, io), env: io.env, scope });
    for (const c of checks) io.out(`${c.na ? 'n/a ' : c.ok ? 'ok  ' : 'FAIL'} ${c.target} ${c.name}: ${c.detail}`);
    return checks.every((c) => c.ok) ? 0 : 1;
  });
}
