import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseArgs } from 'node:util';
import { ensureIndex } from './index';
import { communityFileName, extractLearning, slugify } from './issue';
import { buildManifest } from './manifest';
import { contextFromRuntime, healthOf, kbPrefs, kbUpdate } from './mcp-server';
import { readPluginVersion } from './paths';
import { searchIndex } from './search';
import { scanText } from './secret-scan';
import { parseFrontmatter, readSnapshot } from './snapshot';
import { validateCommunityDoc } from './validate';

export interface CliIO {
  out(line: string): void;
  err(line: string): void;
  env: NodeJS.ProcessEnv;
}

const defaultIO: CliIO = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
  env: process.env,
};

const USAGE = [
  'usage: kb-cli <command>',
  '  manifest <knowledgeDir> --commit <sha> --out <file> [--plugin-version <v>]',
  '  validate <file|dir>...',
  '  scan <file>',
  '  similar <file> --knowledge <dir>',
  '  issue-to-file --out-dir <dir> [--date YYYY-MM-DD]   (env ISSUE_BODY, ISSUE_NUMBER, ISSUE_TITLE)',
  '  update [--force]',
  '  health',
  '  prefs get | prefs set [--suggestions on|off] [--offline true|false]',
  '  contribute <file>',
  '  sync [--apply] [--source <dir>] [--knowledge <dir>]',
].join('\n');

function mdFiles(target: string): string[] {
  if (fs.statSync(target).isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(target, e.name);
    if (e.isDirectory()) return mdFiles(full);
    return e.name.endsWith('.md') && e.name !== 'INDEX.md' ? [full] : [];
  });
}

const posix = (p: string) => p.split(path.sep).join('/');

async function manifest(args: string[], io: CliIO): Promise<number> {
  const { values, positionals } = parseArgs({
    args, allowPositionals: true,
    options: { commit: { type: 'string' }, out: { type: 'string' }, 'plugin-version': { type: 'string' } },
  });
  const dir = positionals[0];
  if (!dir || !values.commit || !values.out) { io.err(USAGE); return 64; }
  const version = values['plugin-version'] ?? readPluginVersion(path.dirname(path.resolve(dir)));
  const m = buildManifest(readSnapshot(dir), values.commit, version);
  fs.writeFileSync(values.out, JSON.stringify(m, null, 2));
  io.out(`manifest: ${m.files.length} files, commit ${m.commit}, plugin ${m.pluginVersion}`);
  return 0;
}

function validate(args: string[], io: CliIO): number {
  if (!args.length) { io.err(USAGE); return 64; }
  let failed = false;
  for (const file of args.flatMap(mdFiles)) {
    const errors = validateCommunityDoc(fs.readFileSync(file, 'utf8'));
    if (errors.length) {
      failed = true;
      io.err(`FAIL ${posix(file)}`);
      for (const e of errors) io.err(`  - ${e}`);
    } else {
      io.out(`OK ${posix(file)}`);
    }
  }
  return failed ? 1 : 0;
}

function scan(args: string[], io: CliIO): number {
  if (!args[0]) { io.err(USAGE); return 64; }
  const findings = scanText(fs.readFileSync(args[0], 'utf8'));
  for (const f of findings) io.out(`line ${f.line} [${f.kind}] ${f.excerpt}`);
  return findings.length ? 2 : 0;
}

function similar(args: string[], io: CliIO): number {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { knowledge: { type: 'string' } } });
  if (!positionals[0] || !values.knowledge) { io.err(USAGE); return 64; }
  const { frontmatter, body } = parseFrontmatter(fs.readFileSync(positionals[0], 'utf8'));
  const query = `${frontmatter.title ?? ''} ${frontmatter.tags ?? ''} ${body.match(/^#\s+(.+)$/m)?.[1] ?? ''}`;
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kb-similar-')), 'kb.db');
  const hits = searchIndex(ensureIndex(readSnapshot(values.knowledge), dbPath), query, { limit: 3, minScore: 0 });
  if (!hits.length) io.out('Nenhum arquivo parecido na base.');
  for (const h of hits) io.out(`- \`${h.path}\` — ${h.title} (score ${h.score.toFixed(2)})`);
  return 0;
}

function issueToFile(args: string[], io: CliIO): number {
  const { values } = parseArgs({ args, options: { 'out-dir': { type: 'string' }, date: { type: 'string' } } });
  const learning = extractLearning(io.env.ISSUE_BODY ?? '');
  const issue = Number(io.env.ISSUE_NUMBER);
  if (!values['out-dir'] || !learning || !Number.isInteger(issue) || issue <= 0) {
    io.err('issue-to-file: missing --out-dir, ISSUE_NUMBER or the "Aprendizado / Learning" section');
    return 1;
  }
  const title = (io.env.ISSUE_TITLE ?? '').replace(/^kb:\s*/i, '');
  const date = values.date ? new Date(`${values.date}T12:00:00Z`) : new Date();
  const file = path.join(values['out-dir'], communityFileName(date, slugify(title), issue));
  fs.mkdirSync(values['out-dir'], { recursive: true });
  fs.writeFileSync(file, learning);
  io.out(posix(file));
  return 0;
}

async function update(args: string[], io: CliIO): Promise<number> {
  const { values } = parseArgs({ args, options: { force: { type: 'boolean' } } });
  const result = await kbUpdate(contextFromRuntime(), { force: values.force ?? true });
  io.out(result.content[0].text);
  return result.isError ? 1 : 0;
}

function prefs(args: string[], io: CliIO): number {
  const { values, positionals } = parseArgs({
    args, allowPositionals: true,
    options: { suggestions: { type: 'string' }, offline: { type: 'string' } },
  });
  const action = positionals[0] === 'set' ? 'set' : 'get';
  const suggestions = values.suggestions === 'on' || values.suggestions === 'off' ? values.suggestions : undefined;
  const offline = values.offline === undefined ? undefined : values.offline === 'true';
  io.out(kbPrefs(contextFromRuntime(), { action, suggestions, offline }).content[0].text);
  return 0;
}

export async function runCli(argv: string[], io: CliIO = defaultIO): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case 'manifest': return manifest(rest, io);
    case 'validate': return validate(rest, io);
    case 'scan': return scan(rest, io);
    case 'similar': return similar(rest, io);
    case 'issue-to-file': return issueToFile(rest, io);
    case 'update': return update(rest, io);
    case 'health': io.out(JSON.stringify(healthOf(contextFromRuntime()), null, 2)); return 0;
    case 'prefs': return prefs(rest, io);
    default: io.err(USAGE); return 64;
  }
}
