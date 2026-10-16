import * as fs from 'node:fs';
import * as path from 'node:path';

export type Target = 'claude' | 'codex' | 'opencode';
export const TARGETS: readonly Target[] = ['claude', 'codex', 'opencode'];
export type Locale = 'pt-BR' | 'en-US';
const LOCALES: Locale[] = ['pt-BR', 'en-US'];

export interface RegistryCommand {
  id: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  takesFile: boolean;
  icon: string;
}

export interface Registry {
  schema: 1;
  skills: Record<string, { targets?: Target[] }>;
  commands: RegistryCommand[];
}

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function localized(value: unknown, label: string, errors: string[]): void {
  const v = value as Record<string, unknown> | undefined;
  for (const locale of LOCALES) {
    if (!v || typeof v[locale] !== 'string' || (v[locale] as string).trim() === '') {
      errors.push(`${label}.${locale} is empty`);
    }
  }
}

export function validateRegistry(input: unknown): string[] {
  const errors: string[] = [];
  const reg = input as Partial<Registry> | null;
  if (!reg || typeof reg !== 'object') return ['registry is not an object'];
  if (reg.schema !== 1) errors.push('schema must be 1');

  const skills = reg.skills ?? {};
  if (typeof skills !== 'object' || Array.isArray(skills)) errors.push('skills must be an object');
  else {
    for (const [name, entry] of Object.entries(skills)) {
      const targets = (entry as { targets?: unknown })?.targets;
      if (targets === undefined) continue;
      if (!Array.isArray(targets) || targets.some((t) => !TARGETS.includes(t as Target))) {
        errors.push(`skills.${name}.targets must be a subset of ${TARGETS.join(', ')}`);
      }
    }
  }

  if (!Array.isArray(reg.commands)) {
    errors.push('commands must be an array');
    return errors;
  }
  const seen = new Set<string>();
  reg.commands.forEach((cmd, index) => {
    const at = `commands[${index}]`;
    if (typeof cmd?.id !== 'string' || !ID.test(cmd.id)) errors.push(`${at}.id is invalid`);
    else if (seen.has(cmd.id)) errors.push(`${at}.id duplicate: ${cmd.id}`);
    else seen.add(cmd.id);
    localized(cmd?.title, `${at}.title`, errors);
    localized(cmd?.description, `${at}.description`, errors);
    if (typeof cmd?.takesFile !== 'boolean') errors.push(`${at}.takesFile must be boolean`);
    if (typeof cmd?.icon !== 'string' || cmd.icon === '') errors.push(`${at}.icon is empty`);
  });
  return errors;
}

export function parseRegistry(raw: string): Registry {
  const parsed = JSON.parse(raw) as unknown;
  const errors = validateRegistry(parsed);
  if (errors.length) throw new Error(`invalid portable.json: ${errors.join('; ')}`);
  const reg = parsed as Registry;
  return { schema: 1, skills: reg.skills ?? {}, commands: reg.commands };
}

export function readRegistry(root: string): Registry {
  return parseRegistry(fs.readFileSync(path.join(root, 'portable.json'), 'utf8'));
}

export function commandSkillName(id: string): string {
  return `delphi-cmd-${id}`;
}

export function opencodeCommandName(id: string): string {
  return `delphi-${id}`;
}

export function invocationFor(target: Target, id: string): string {
  if (target === 'codex') return `$${commandSkillName(id)}`;
  if (target === 'opencode') return `/${opencodeCommandName(id)}`;
  return `/${id}`;
}

export function skillTargets(reg: Registry, skill: string): Target[] {
  return reg.skills[skill]?.targets ?? [...TARGETS];
}
