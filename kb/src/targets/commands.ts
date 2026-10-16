import { readFrontmatter } from '../frontmatter';
import { commandSkillName, opencodeCommandName } from '../registry';

export interface CommandDef {
  id: string;
  description: string;
  body: string;
}

// "o que o usu\xe1rio informou depois do comando" (kept as escapes: kb/src stays ASCII)
const ARGUMENTS_TEXT = 'o que o usu\xe1rio informou depois do comando';

export function parseCommand(id: string, raw: string): CommandDef {
  const fm = readFrontmatter(raw);
  const description = (fm.data.description ?? '').replace(/\s+/g, ' ').trim();
  if (!description) throw new Error(`command ${id} has no description`);
  return { id, description, body: fm.body.replace(/^\n+/, '').trimEnd() };
}

/** Codex has no custom slash commands: each command becomes an explicit-only skill. */
export function toCodexCommandSkill(command: CommandDef): { name: string; skillMd: string; openaiYaml: string } {
  const name = commandSkillName(command.id);
  const description = `Comando /${command.id} do delphi-dev (chamada expl\xedcita). ${command.description}`;
  const skillMd = [
    '---',
    `name: ${name}`,
    `description: ${JSON.stringify(description)}`,
    '---',
    '',
    command.body.split('$ARGUMENTS').join(ARGUMENTS_TEXT),
    '',
  ].join('\n');
  const openaiYaml = ['policy:', '  allow_implicit_invocation: false', ''].join('\n');
  return { name, skillMd, openaiYaml };
}

export function toOpencodeCommand(command: CommandDef): { fileName: string; text: string } {
  const text = ['---', `description: ${JSON.stringify(command.description)}`, '---', '', command.body, ''].join('\n');
  return { fileName: `${opencodeCommandName(command.id)}.md`, text };
}
