import * as fs from 'node:fs';
import * as path from 'node:path';
import { readPluginVersion } from '../paths';
import { readRegistry, skillTargets, type Registry } from '../registry';
import { parseAgent, toCodexToml, toOpencodeAgent, type AgentDef } from '../targets/agents';
import { parseCommand, toCodexCommandSkill, toOpencodeCommand, type CommandDef } from '../targets/commands';
import {
  mergeCodexHooks, mergeOpencodeMcp, removeCodexHooks, removeOpencodeMcp, type HookEntry,
} from '../targets/jsonMerge';
import { renderOpencodePlugin } from '../targets/opencodePlugin';
import {
  BLOCK_START, codexMcpBlockBody, hasManagedBlockProblem, hasTableOutsideBlock, removeManagedBlock, upsertManagedBlock,
} from '../targets/toml';
import {
  atomicWrite, emptyRecord, MARKER, newReport, readManifest, readTree, removeOwned, sha256, treeHash,
  writeManifest, writeOwnedDir, writeOwnedFile, type Ctx, type InstallManifest, type Report, type TargetRecord,
} from './fsops';

/** Targets that have files to write. `claude` is accepted too, but only to inform: it installs via the marketplace. */
export type InstallTarget = 'codex' | 'opencode';
export type AnyTarget = InstallTarget | 'claude';
export const MCP_SERVER = 'delphi-dev-kb';

export interface InstallOptions {
  targets: AnyTarget[];
  scope: 'user' | 'project';
  home: string;
  project?: string;
  checkout: string;
  dryRun: boolean;
  force: boolean;
  env: NodeJS.ProcessEnv;
  now?: Date;
}
export type UninstallOptions = Pick<InstallOptions, 'targets' | 'home' | 'dryRun' | 'force' | 'env' | 'now'>;

/** `Report` plus informational lines that are not problems (e.g. "Claude Code installs via the marketplace"). */
export interface InstallReport extends Report {
  notes: string[];
}

const posix = (p: string): string => p.replace(/\\/g, '/');
const stampOf = (now: Date): string => now.toISOString().replace(/[:.]/g, '-');
const newInstallReport = (): InstallReport => ({ ...newReport(), notes: [] });
const isDiskTarget = (t: AnyTarget): t is InstallTarget => t !== 'claude';

function dataDir(o: { home: string; env: NodeJS.ProcessEnv }): string {
  return o.env.DELPHI_DEV_DATA || path.join(o.home, '.delphi-dev');
}

export function manifestPath(o: { home: string; env: NodeJS.ProcessEnv }): string {
  return path.join(dataDir(o), 'install-manifest.json');
}

/** Replaced skill folders go here, outside every skills dir (see Ctx.backupDir). */
function backupDirOf(o: { home: string; env: NodeJS.ProcessEnv }, stamp: string): string {
  return path.join(dataDir(o), 'backups', stamp);
}

/** True when the manifest file exists but is not readable JSON (readManifest then answers "owns nothing"). */
function manifestIsCorrupt(file: string): boolean {
  if (!fs.existsSync(file)) return false;
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
    return false;
  } catch {
    return true;
  }
}

function freeAside(file: string, stamp: string): string {
  const base = `${file}.bak-${stamp}`;
  let candidate = base;
  for (let n = 2; fs.existsSync(candidate); n++) candidate = `${base}-${n}`;
  return candidate;
}

// ---- inputs ---------------------------------------------------------------

interface Inputs {
  registry: Registry;
  skills: { name: string; files: Map<string, Buffer> }[];
  commands: CommandDef[];
  agents: AgentDef[];
}

function readSkills(checkout: string): Inputs['skills'] {
  const dir = path.join(checkout, 'skills');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'SKILL.md')))
    .map((e) => ({ name: e.name, files: readTree(path.join(dir, e.name)) }));
}

/** A broken command or agent file is reported and left out: it must not stop the rest of the install. */
function loadInputs(checkout: string, report: InstallReport): Inputs {
  let registry: Registry;
  try {
    registry = readRegistry(checkout);
  } catch (err) {
    throw new Error(`checkout invalido (${checkout}): ${err instanceof Error ? err.message : String(err)}`);
  }
  const commands: CommandDef[] = [];
  for (const c of registry.commands) {
    try {
      commands.push(parseCommand(c.id, fs.readFileSync(path.join(checkout, 'commands', `${c.id}.md`), 'utf8')));
    } catch (err) {
      report.warnings.push(`comando ${c.id} ignorado: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const agents: AgentDef[] = [];
  const agentsDir = path.join(checkout, 'agents');
  const names = fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir).filter((n) => n.endsWith('.md')).sort() : [];
  for (const n of names) {
    try {
      agents.push(parseAgent(fs.readFileSync(path.join(agentsDir, n), 'utf8')));
    } catch (err) {
      report.warnings.push(`agente ${n} ignorado: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { registry, skills: readSkills(checkout), commands, agents };
}

// ---- helpers --------------------------------------------------------------

function writeConfigText(ctx: Ctx, file: string, text: string): void {
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (before === text) {
    ctx.report.unchanged++;
    return;
  }
  if (!ctx.dryRun) {
    if (before !== null) {
      const backup = `${file}.delphi-dev.bak`;
      if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
    }
    atomicWrite(file, text);
  }
  ctx.report.written.push(file);
}

/** The line with `needle` and one line on each side, for messages that point at the user's own file. */
function spot(text: string, needle: string): string {
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((l) => l.includes(needle));
  if (at < 0) return '';
  return lines.slice(Math.max(0, at - 1), at + 3).map((l, i) => `    ${Math.max(0, at - 1) + i + 1}: ${l}`).join('\n');
}

/**
 * Codex runs a hook through the shell with the PROJECT as working directory. On Windows cmd looks for
 * executables in the current directory first, so the command moves into the trusted checkout before it
 * runs anything; the script still gets the project's own cwd from the payload on stdin.
 * Returns null when the checkout path holds characters the shell would interpret inside a quoted path.
 */
function hookCommands(root: string, script: string): { command: string; commandWindows: string } | null {
  if (/["%\r\n]/.test(root)) return null;
  const sh = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`;
  return {
    command: `cd ${sh(root)} && command -v node >/dev/null 2>&1 && node ${sh(`${root}/${script}`)}; exit 0`,
    commandWindows: `pushd "${root}" && where node >nul 2>nul && node "${root}/${script}" & exit /b 0`,
  };
}

function codexHookEntries(checkout: string): HookEntry[] | null {
  const root = posix(checkout).replace(/\/+$/, '');
  const fix = hookCommands(root, 'runtime/hook-fix-encoding.mjs');
  const inject = hookCommands(root, 'runtime/hook-inject.mjs');
  if (!fix || !inject) return null;
  return [
    { event: 'PostToolUse', matcher: 'apply_patch|Write|Edit', ...fix },
    { event: 'UserPromptSubmit', ...inject },
  ];
}

type Base = Omit<Ctx, 'prev' | 'report'> & { report: InstallReport };

/**
 * Runs one install item. An exception (permissions, a file where a folder should be, a full disk...)
 * becomes a warning plus a skipped item instead of aborting the run: whatever was written before is
 * still recorded in the manifest, so `uninstall` can always find it.
 */
function guard(report: InstallReport, label: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    report.skipped.push({ path: label, reason: 'error' });
    report.warnings.push(`${label}: erro ao gravar (${err instanceof Error ? err.message : String(err)}); item ignorado`);
  }
}

function installCodex(o: InstallOptions, inputs: Inputs, base: Base, prev: TargetRecord): TargetRecord {
  const rec = emptyRecord();
  const ctx: Ctx = { ...base, prev };
  const user = o.scope === 'user';
  const codexHome = o.env.CODEX_HOME || path.join(o.home, '.codex');
  const skillsDir = user ? path.join(o.home, '.agents', 'skills') : path.join(o.project as string, '.agents', 'skills');
  const agentsDir = user ? path.join(codexHome, 'agents') : path.join(o.project as string, '.codex', 'agents');

  for (const skill of inputs.skills) {
    if (!skillTargets(inputs.registry, skill.name).includes('codex')) continue;
    const dest = path.join(skillsDir, skill.name);
    guard(base.report, dest, () => writeOwnedDir(ctx, dest, skill.files, rec));
  }
  for (const command of inputs.commands) {
    const generated = toCodexCommandSkill(command);
    const files = new Map<string, Buffer>([
      ['SKILL.md', Buffer.from(generated.skillMd, 'utf8')],
      ['agents/openai.yaml', Buffer.from(generated.openaiYaml, 'utf8')],
    ]);
    const dest = path.join(skillsDir, generated.name);
    guard(base.report, dest, () => writeOwnedDir(ctx, dest, files, rec));
  }
  for (const agent of inputs.agents) {
    const file = path.join(agentsDir, `${agent.name}.toml`);
    guard(base.report, file, () => writeOwnedFile(ctx, file, toCodexToml(agent), rec));
  }
  if (!user) {
    base.report.notes.push('codex: escopo de projeto grava skills e agentes; o MCP e os hooks sao do usuario (rode sem --scope project)');
    return rec;
  }

  const configToml = path.join(codexHome, 'config.toml');
  guard(base.report, configToml, () => codexMcpConfig(o, base, ctx, rec, configToml));

  const hooksJson = path.join(codexHome, 'hooks.json');
  guard(base.report, hooksJson, () => codexHooksConfig(o, base, ctx, rec, hooksJson));
  return rec;
}

function codexMcpConfig(o: InstallOptions, base: Base, ctx: Ctx, rec: TargetRecord, configToml: string): void {
  const toml = fs.existsSync(configToml) ? fs.readFileSync(configToml, 'utf8') : '';
  if (hasManagedBlockProblem(toml)) {
    base.report.warnings.push(
      `${configToml}: marcadores do delphi-dev desbalanceados; arquivo nao foi alterado e o MCP nao foi configurado. `
      + `Conserte ou apague o trecho a mao e rode de novo:\n${spot(toml, BLOCK_START)}`,
    );
  } else if (hasTableOutsideBlock(toml, `mcp_servers.${MCP_SERVER}`)) {
    base.report.warnings.push(
      `${configToml}: ja existe [mcp_servers.${MCP_SERVER}] fora do bloco do delphi-dev; MCP nao configurado`,
    );
  } else {
    const next = upsertManagedBlock(toml, codexMcpBlockBody(`${posix(o.checkout)}/runtime/kb-mcp.mjs`));
    writeConfigText(ctx, configToml, next);
    rec.blocks.push(configToml);
  }
}

function codexHooksConfig(o: InstallOptions, base: Base, ctx: Ctx, rec: TargetRecord, hooksJson: string): void {
  const entries = codexHookEntries(o.checkout);
  if (!entries) {
    base.report.warnings.push(
      `${hooksJson}: nao foi alterado (o caminho do checkout tem aspas, % ou quebra de linha: ${o.checkout}); mova o checkout`,
    );
    return;
  }
  const before = fs.existsSync(hooksJson) ? fs.readFileSync(hooksJson, 'utf8') : null;
  const merged = mergeCodexHooks(before, entries);
  if (!merged.ok) {
    base.report.warnings.push(`${hooksJson}: nao foi alterado (${merged.reason}); adicione os hooks do delphi-dev a mao`);
  } else {
    if (merged.changed) writeConfigText(ctx, hooksJson, merged.text);
    else base.report.unchanged++;
    rec.keys.push({ file: hooksJson, key: 'hooks' });
  }
}

function opencodeConfigDir(o: { home: string; env: NodeJS.ProcessEnv }): string {
  return path.join(o.env.XDG_CONFIG_HOME || path.join(o.home, '.config'), 'opencode');
}

function installOpencode(o: InstallOptions, inputs: Inputs, base: Base, prev: TargetRecord): TargetRecord {
  const rec = emptyRecord();
  const ctx: Ctx = { ...base, prev };
  const user = o.scope === 'user';
  const cfg = opencodeConfigDir(o);
  const skillsDir = user ? path.join(o.home, '.agents', 'skills') : path.join(o.project as string, '.agents', 'skills');
  const commandsDir = user ? path.join(cfg, 'commands') : path.join(o.project as string, '.opencode', 'commands');
  const agentsDir = user ? path.join(cfg, 'agents') : path.join(o.project as string, '.opencode', 'agents');

  for (const skill of inputs.skills) {
    if (!skillTargets(inputs.registry, skill.name).includes('opencode')) continue;
    const dest = path.join(skillsDir, skill.name);
    guard(base.report, dest, () => writeOwnedDir(ctx, dest, skill.files, rec));
  }
  for (const command of inputs.commands) {
    const generated = toOpencodeCommand(command);
    const file = path.join(commandsDir, generated.fileName);
    guard(base.report, file, () => writeOwnedFile(ctx, file, generated.text, rec));
  }
  for (const agent of inputs.agents) {
    const file = path.join(agentsDir, `${agent.name}.md`);
    guard(base.report, file, () => writeOwnedFile(ctx, file, toOpencodeAgent(agent), rec));
  }
  if (!user) {
    base.report.notes.push('opencode: escopo de projeto grava skills, comandos e agentes; o MCP e o plugin de hooks sao do usuario (rode sem --scope project)');
    return rec;
  }

  const jsonFile = [path.join(cfg, 'opencode.json'), path.join(cfg, 'opencode.jsonc')].find((f) => fs.existsSync(f))
    ?? path.join(cfg, 'opencode.json');
  guard(base.report, jsonFile, () => opencodeMcpConfig(o, base, ctx, rec, jsonFile));

  const plugin = path.join(cfg, 'plugins', 'delphi-dev.js');
  guard(base.report, plugin, () => writeOwnedFile(ctx, plugin, renderOpencodePlugin(o.checkout), rec));
  return rec;
}

function opencodeMcpConfig(o: InstallOptions, base: Base, ctx: Ctx, rec: TargetRecord, jsonFile: string): void {
  const entry = { type: 'local', command: ['node', `${posix(o.checkout)}/runtime/kb-mcp.mjs`], enabled: true };
  const before = fs.existsSync(jsonFile) ? fs.readFileSync(jsonFile, 'utf8') : null;
  const merged = mergeOpencodeMcp(before, MCP_SERVER, entry);
  if (!merged.ok) {
    base.report.warnings.push(
      `${jsonFile}: nao foi alterado (${merged.reason}). Adicione em "mcp": "${MCP_SERVER}": ${JSON.stringify(entry)}`,
    );
  } else {
    if (merged.changed) writeConfigText(ctx, jsonFile, merged.text);
    else base.report.unchanged++;
    rec.keys.push({ file: jsonFile, key: 'mcp' });
  }
}

/**
 * Keeps what an earlier run recorded (another scope, a file that has since left the repo, an item
 * that is currently skipped) and adds/refreshes what this run wrote. Ownership is only ever dropped
 * by `uninstall`, never forgotten by accident, so a later `uninstall` still finds everything it owns.
 */
function union(a: TargetRecord, b: TargetRecord): TargetRecord {
  const merge = <T>(x: T[], y: T[], key: (t: T) => string): T[] => {
    const map = new Map<string, T>();
    for (const item of [...x, ...y]) map.set(key(item), item);
    return [...map.values()];
  };
  return {
    files: merge(a.files, b.files, (f) => f.path),
    dirs: merge(a.dirs, b.dirs, (d) => d.path),
    blocks: [...new Set([...a.blocks, ...b.blocks])],
    keys: merge(a.keys, b.keys, (k) => `${k.file}#${k.key}`),
  };
}

function claudeNote(checkout: string, report: InstallReport, verb: 'instalar' | 'remover'): void {
  if (verb === 'instalar') {
    report.notes.push('claude: nada a gravar em disco; o Claude Code usa o marketplace (/plugin marketplace add adrianosantostreina/delphi-dev e /plugin install delphi-dev@delphi-dev)');
    if (!fs.existsSync(path.join(checkout, '.claude-plugin', 'plugin.json'))) {
      report.warnings.push(`claude: ${checkout} nao tem .claude-plugin/plugin.json`);
    }
  } else {
    report.notes.push('claude: nada a remover em disco; use /plugin uninstall delphi-dev dentro do Claude Code');
  }
}

// ---- public API -----------------------------------------------------------

export function installTargets(o: InstallOptions): InstallReport {
  const diskTargets = o.targets.filter(isDiskTarget);
  if (o.scope === 'project' && !o.project && diskTargets.length) throw new Error('--scope project exige --project <pasta>');
  const report = newInstallReport();
  const now = o.now ?? new Date();
  const stamp = stampOf(now);

  if (o.targets.includes('claude')) claudeNote(o.checkout, report, 'instalar');
  if (!diskTargets.length) return report;

  const inputs = loadInputs(o.checkout, report);
  const file = manifestPath(o);
  const corrupt = manifestIsCorrupt(file);
  const manifest = readManifest(file);
  const base: Base = { dryRun: o.dryRun, force: o.force, stamp, backupDir: backupDirOf(o, stamp), report };

  for (const target of diskTargets) {
    const previous = manifest[target];
    let next = emptyRecord();
    // Every item is already guarded; this is the last line of defence so the manifest is ALWAYS written.
    guard(report, target, () => {
      next = target === 'codex'
        ? installCodex(o, inputs, base, previous)
        : installOpencode(o, inputs, base, previous);
    });
    manifest[target] = union(previous, next);
  }
  manifest.version = readPluginVersion(o.checkout);
  manifest.installedAt = now.toISOString();

  if (corrupt) {
    const aside = freeAside(file, stamp);
    report.warnings.push(
      `manifesto de instalacao ilegivel (${file}): tratado como "sem posse"; ${o.dryRun ? 'seria guardado' : 'guardado'} em ${aside}`,
    );
    if (!o.dryRun) fs.renameSync(file, aside);
  }
  if (!o.dryRun) writeManifest(file, manifest);
  return report;
}

function removeBlockFile(base: Base, file: string): void {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  if (hasManagedBlockProblem(text)) {
    base.report.warnings.push(
      `${file}: marcadores do delphi-dev desbalanceados; bloco nao foi removido. Apague o trecho a mao:\n${spot(text, BLOCK_START)}`,
    );
    return;
  }
  const next = removeManagedBlock(text);
  if (next === text) return;
  if (!base.dryRun) {
    if (next === '') fs.unlinkSync(file);
    else atomicWrite(file, next);
  }
  base.report.removed.push(`${file} (bloco delphi-dev)`);
}

function removeKey(base: Base, k: { file: string; key: string }): void {
  if (!fs.existsSync(k.file)) return;
  const text = fs.readFileSync(k.file, 'utf8');
  const result = k.key === 'hooks' ? removeCodexHooks(text) : removeOpencodeMcp(text, MCP_SERVER);
  if (!result.ok) {
    base.report.warnings.push(`${k.file}: nao foi possivel remover a entrada do delphi-dev (${result.reason})`);
    return;
  }
  if (!result.changed) return;
  if (!base.dryRun) atomicWrite(k.file, result.text);
  base.report.removed.push(`${k.file} (${k.key})`);
}

export function uninstallTargets(o: UninstallOptions): InstallReport {
  const file = manifestPath(o);
  const report = newInstallReport();
  const diskTargets = o.targets.filter(isDiskTarget);
  if (o.targets.includes('claude')) claudeNote('', report, 'remover');
  if (!diskTargets.length) return report;

  if (manifestIsCorrupt(file)) {
    // Without a readable record nothing can be proven to be ours: remove nothing and keep the file for inspection.
    report.warnings.push(`manifesto de instalacao ilegivel (${file}); nada foi removido. Apague os arquivos do delphi-dev a mao ou reinstale`);
    return report;
  }
  const manifest = readManifest(file);
  const stamp = stampOf(o.now ?? new Date());
  const base: Base = { dryRun: o.dryRun, force: o.force, stamp, backupDir: backupDirOf(o, stamp), report };

  for (const target of diskTargets) {
    const rec = manifest[target];
    const other: InstallTarget = target === 'codex' ? 'opencode' : 'codex';
    // A skill folder both agents read from ~/.agents/skills stays while the other target is still installed.
    const sharedWithOther = new Set(o.targets.includes(other) ? [] : manifest[other].dirs.map((d) => d.path));
    removeOwned({ ...base, prev: rec }, { ...rec, dirs: rec.dirs.filter((d) => !sharedWithOther.has(d.path)) });
    for (const blockFile of rec.blocks) removeBlockFile(base, blockFile);
    for (const key of rec.keys) removeKey(base, key);
    manifest[target] = emptyRecord();
  }

  if (!o.dryRun) {
    const empty = (r: TargetRecord) => r.files.length + r.dirs.length + r.blocks.length + r.keys.length === 0;
    if (empty(manifest.codex) && empty(manifest.opencode)) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } else {
      writeManifest(file, manifest as InstallManifest);
    }
  }
  return report;
}

export interface DoctorCheck {
  target: AnyTarget;
  name: string;
  ok: boolean;
  detail: string;
  /** Not applicable in this scope: `ok` is true so it never fails the diagnosis, but it is shown as "n/a". */
  na?: boolean;
}

export function doctor(
  o: { targets: AnyTarget[]; home: string; env: NodeJS.ProcessEnv; checkout?: string; scope?: 'user' | 'project' },
): DoctorCheck[] {
  const file = manifestPath(o);
  const corrupt = manifestIsCorrupt(file);
  const manifest = readManifest(file);
  const checks: DoctorCheck[] = [];
  for (const target of o.targets) {
    if (target === 'claude') {
      const plugin = o.checkout ? path.join(o.checkout, '.claude-plugin', 'plugin.json') : '';
      const ok = !!plugin && fs.existsSync(plugin);
      checks.push({
        target, name: 'plugin do Claude Code', ok,
        detail: ok ? 'instalado pelo marketplace do Claude Code (nada em disco aqui)' : plugin || 'informe o checkout para validar',
      });
      continue;
    }
    const rec = manifest[target];
    const installed = rec.files.length + rec.dirs.length > 0;
    checks.push({
      target, name: 'instalado', ok: installed,
      detail: installed
        ? `${rec.dirs.length} pasta(s) de skill, ${rec.files.length} arquivo(s)`
        : corrupt ? `manifesto ilegivel: ${file}` : 'nada registrado no manifesto',
    });
    if (!installed) continue;

    const missing = [
      ...rec.files.filter((f) => !fs.existsSync(f.path)).map((f) => f.path),
      ...rec.dirs.filter((d) => !fs.existsSync(path.join(d.path, MARKER))).map((d) => d.path),
    ];
    checks.push({ target, name: 'arquivos presentes', ok: missing.length === 0, detail: missing.length ? missing.join(', ') : 'ok' });

    const edited = [
      ...rec.files
        .filter((f) => fs.existsSync(f.path) && sha256(fs.readFileSync(f.path)) !== f.sha256)
        .map((f) => f.path),
      ...rec.dirs
        .filter((d) => fs.existsSync(path.join(d.path, MARKER)) && treeHash(readTree(d.path)) !== d.treeHash)
        .map((d) => d.path),
    ];
    checks.push({ target, name: 'sem alteracao manual', ok: edited.length === 0, detail: edited.length ? edited.join(', ') : 'ok' });

    if (o.scope === 'project') {
      // The project scope writes skills, commands and agents only; MCP and hooks are the user's (see installCodex/installOpencode).
      checks.push({ target, name: 'mcp configurado', ok: true, na: true, detail: 'n/a (o escopo de projeto nao configura MCP)' });
    } else if (target === 'codex') {
      const block = rec.blocks.find((f) => fs.existsSync(f) && fs.readFileSync(f, 'utf8').includes(BLOCK_START));
      checks.push({ target, name: 'mcp configurado', ok: !!block, detail: block ?? 'bloco do delphi-dev ausente no config.toml' });
    } else {
      const key = rec.keys.find((k) => k.key === 'mcp');
      let ok = false;
      if (key && fs.existsSync(key.file)) {
        try {
          const json = JSON.parse(fs.readFileSync(key.file, 'utf8')) as { mcp?: Record<string, unknown> };
          ok = !!json.mcp?.[MCP_SERVER];
        } catch {
          ok = false;
        }
      }
      checks.push({ target, name: 'mcp configurado', ok, detail: key?.file ?? 'opencode.json nao foi alterado' });
    }
  }
  return checks;
}
