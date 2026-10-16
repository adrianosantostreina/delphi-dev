import * as fs from 'node:fs';
import * as path from 'node:path';
import { readFrontmatter } from './frontmatter';
import { validateRegistry } from './registry';

export interface LintFinding {
  rule: string;
  file: string;
  line?: number;
  message: string;
}

const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ALLOWED_KEYS = new Set(['name', 'description', 'license', 'compatibility', 'metadata']);
const TOOL = 'Write|Edit|Read|Bash|Agent|Task|Skill|Grep|Glob|WebFetch|TodoWrite|AskUserQuestion|PowerShell';
const TOOL_PATTERNS: RegExp[] = [
  new RegExp(`\\bferramentas? (?:${TOOL})\\b`, 'i'),
  new RegExp(`\\b(?:${TOOL}) tool\\b`),
  /\b(?:AskUserQuestion|subagent_type|CLAUDE_PLUGIN_ROOT|allowed-tools)\b/,
];
const PATH_REF = /(?:^|[\s`'"(\[])(?:rules|knowledge)\/[A-Za-z0-9_.\-/]+/;
const PARENT_REF = /(?<![\w.])\.\.\//;
const REFERENCE = /\breferences\/([A-Za-z0-9_.\-/]+\.[A-Za-z0-9]+)/g;
const ALLOW = /<!--\s*portability:allow\s+([a-z-]+)\s*-->/;

const posix = (p: string): string => p.split(path.sep).join('/');

function walkMd(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walkMd(full);
    return e.isFile() && e.name.endsWith('.md') ? [full] : [];
  });
}

function allowed(lines: string[], index: number, rule: string): boolean {
  for (const i of [index, index - 1]) {
    const m = i >= 0 ? lines[i].match(ALLOW) : null;
    if (m && m[1] === rule) return true;
  }
  return false;
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

export function lintRepo(rootArg: string): LintFinding[] {
  // Absolute: the path rules below look for '/skills/' and '/commands/' inside each file path, which a relative root (--root .) would not have.
  const root = path.resolve(rootArg);
  const findings: LintFinding[] = [];
  const add = (rule: string, file: string, message: string, line?: number): void => {
    findings.push({ rule, file: posix(path.relative(root, file)), line, message });
  };

  // --- skills
  const skillsDir = path.join(root, 'skills');
  const skillNames: string[] = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
    : [];

  for (const name of skillNames) {
    const file = path.join(skillsDir, name, 'SKILL.md');
    if (!fs.existsSync(file)) {
      add('skill-name', path.join(skillsDir, name), 'folder has no SKILL.md');
      continue;
    }
    const fm = readFrontmatter(fs.readFileSync(file, 'utf8'));
    if (!SKILL_NAME.test(name) || name.length > 64) add('skill-name', file, `invalid skill folder name "${name}"`);
    if (fm.data.name !== name) add('skill-name', file, `name "${fm.data.name ?? ''}" must equal the folder "${name}"`);
    const description = (fm.data.description ?? '').replace(/\s+/g, ' ').trim();
    if (!description) add('skill-description', file, 'description is missing');
    else if (description.length > 1024) add('skill-description', file, `description has ${description.length} chars (max 1024)`);
    for (const key of fm.keys) {
      if (!ALLOWED_KEYS.has(key)) add('skill-frontmatter', file, `frontmatter key "${key}" is not portable`);
    }
  }

  // --- text rules over skills, commands and agents
  const mdFiles = [
    ...walkMd(skillsDir),
    ...walkMd(path.join(root, 'commands')),
    ...walkMd(path.join(root, 'agents')),
  ];
  for (const file of mdFiles) {
    const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
    const isSkillFile = path.basename(file) === 'SKILL.md' && posix(file).includes('/skills/');
    lines.forEach((text, i) => {
      for (const pattern of TOOL_PATTERNS) {
        if (pattern.test(text) && !allowed(lines, i, 'tool-names')) {
          add('tool-names', file, `agent-specific tool name: ${text.trim().slice(0, 80)}`, i + 1);
          break;
        }
      }
      if (posix(file).includes('/skills/')) {
        const hit = PATH_REF.test(text) && !text.includes('~/.delphi-dev/') && !allowed(lines, i, 'path-ref');
        if (hit) add('path-ref', file, `reference outside the skill folder: ${text.trim().slice(0, 80)}`, i + 1);
        if (isSkillFile && PARENT_REF.test(text) && !allowed(lines, i, 'path-ref')) {
          add('path-ref', file, `parent-relative path in a skill: ${text.trim().slice(0, 80)}`, i + 1);
        }
      }
    });

    if (posix(file).includes('/commands/')) {
      // A command has no references/ of its own: the relative path only resolves when the agent
      // loads the owning skill, so the text must name that skill (Codex/OpenCode do not guess it).
      lines.forEach((text, i) => {
        for (const m of text.matchAll(REFERENCE)) {
          const rel = m[1];
          const owners = skillNames.filter((s) => fs.existsSync(path.join(skillsDir, s, 'references', ...rel.split('/'))));
          if (!owners.length) {
            add('references-exist', file, `references/${rel} does not exist in any skill`, i + 1);
          } else if (!owners.some((o) => new RegExp(`(?<![\\w-])${o}(?![\\w-])`).test(text))) {
            add('references-exist', file, `references/${rel} belongs to the skill ${owners.join(' / ')}; name it on the same line`, i + 1);
          }
        }
      });
    }

    if (isSkillFile) {
      const skill = path.basename(path.dirname(file));
      lines.forEach((text, i) => {
        const named = (text.match(/\bdelphi-[a-z0-9-]+\b/g) ?? []).filter((n) => skillNames.includes(n));
        for (const m of text.matchAll(REFERENCE)) {
          const rel = m[1];
          const owners = [skill, ...named];
          const found = owners.some((o) => fs.existsSync(path.join(skillsDir, o, 'references', ...rel.split('/'))));
          if (!found) add('references-exist', file, `references/${rel} does not exist`, i + 1);
        }
      });
    }
  }

  // --- commands x registry
  const commandsDir = path.join(root, 'commands');
  const commandIds = fs.existsSync(commandsDir)
    ? fs.readdirSync(commandsDir).filter((n) => n.endsWith('.md')).map((n) => n.slice(0, -3))
    : [];
  const registryFile = path.join(root, 'portable.json');
  const registry = readJson(registryFile) as { commands?: { id?: string }[] } | undefined;
  if (!registry) {
    add('command-registry', registryFile, 'portable.json is missing or is not valid JSON');
  } else {
    for (const error of validateRegistry(registry)) add('command-registry', registryFile, error);
    const registered = new Set((registry.commands ?? []).map((c) => c.id));
    for (const id of commandIds) {
      if (!registered.has(id)) add('command-registry', path.join(commandsDir, `${id}.md`), `command "${id}" has no portable.json entry`);
    }
    for (const id of registered) {
      if (id && !commandIds.includes(id)) add('command-registry', registryFile, `portable.json lists "${id}" but commands/${id}.md does not exist`);
    }
  }

  // --- agents
  const agentsDir = path.join(root, 'agents');
  if (fs.existsSync(agentsDir)) {
    for (const name of fs.readdirSync(agentsDir).filter((n) => n.endsWith('.md'))) {
      const file = path.join(agentsDir, name);
      const fm = readFrontmatter(fs.readFileSync(file, 'utf8'));
      if (!fm.data.name) add('agent-frontmatter', file, 'agent has no name');
      if (!(fm.data.description ?? '').trim()) add('agent-frontmatter', file, 'agent has no description');
    }
  }

  // --- version sync
  const plugin = readJson(path.join(root, '.claude-plugin', 'plugin.json')) as { version?: string } | undefined;
  type PluginEntry = { version?: string; source?: string | { ref?: string } };
  const market = readJson(path.join(root, '.claude-plugin', 'marketplace.json')) as { plugins?: PluginEntry[] } | undefined;
  if (plugin?.version) {
    const marketVersion = market?.plugins?.[0]?.version;
    if (marketVersion !== undefined && marketVersion !== plugin.version) {
      add('version-sync', path.join(root, '.claude-plugin', 'marketplace.json'),
        `marketplace.json is ${marketVersion} but plugin.json is ${plugin.version}`);
    }
    // A pre-release is installed with `/plugin marketplace add owner/repo#v<version>`, but the plugin itself is
    // fetched from source.url: without source.ref it would silently be the default branch. A stable version must
    // not keep the pin, or the stable line would stay frozen on the beta tag.
    const source = market?.plugins?.[0]?.source;
    if (source && typeof source === 'object') {
      const want = `v${plugin.version}`;
      const prerelease = /^[0-9]+.[0-9]+.[0-9]+-/.test(plugin.version);
      const marketFile = path.join(root, '.claude-plugin', 'marketplace.json');
      if (prerelease && source.ref !== want) {
        add('version-sync', marketFile, `pre-release ${plugin.version}: plugins[0].source.ref must be "${want}" (found ${source.ref === undefined ? 'none' : `"${source.ref}"`})`);
      } else if (!prerelease && source.ref !== undefined) {
        add('version-sync', marketFile, `stable ${plugin.version}: remove plugins[0].source.ref ("${source.ref}"), it pins the plugin to a pre-release`);
      }
    }
    const about = path.join(root, 'commands', 'about.md');
    if (fs.existsSync(about)) {
      const text = fs.readFileSync(about, 'utf8');
      for (const m of text.matchAll(/\*\*(?:Vers\xE3o|Version):\*\*\s*([0-9]+\.[0-9]+\.[0-9]+[^\s]*)/g)) {
        if (m[1] !== plugin.version) {
          add('version-sync', about, `about shows ${m[1]} but plugin.json is ${plugin.version}`);
        }
      }
    }
  }

  return findings.sort((a, b) => (a.file === b.file ? (a.line ?? 0) - (b.line ?? 0) : a.file < b.file ? -1 : 1));
}
