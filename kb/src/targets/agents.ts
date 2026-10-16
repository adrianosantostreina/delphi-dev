import { readFrontmatter } from '../frontmatter';

export interface AgentDef {
  name: string;
  description: string;
  model?: string;
  body: string;
}

export function parseAgent(raw: string): AgentDef {
  const fm = readFrontmatter(raw);
  const name = fm.data.name;
  if (!name) throw new Error('agent without a name in the frontmatter');
  return {
    name,
    description: fm.data.description ?? '',
    model: fm.data.model,
    body: fm.body.replace(/^\n+/, '').trimEnd(),
  };
}

/** The original description carries <example> blocks and "Exemplos:" tails meant for Claude Code. */
export function cleanDescription(description: string, max = 600): string {
  let text = description;
  const cut = text.search(/<example>|\bExemplos?:|\bExamples?:/i);
  if (cut >= 0) text = text.slice(0, cut);
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > max) {
    const head = text.slice(0, max - 3);
    const space = head.lastIndexOf(' ');
    text = `${(space > 0 ? head.slice(0, space) : head).trimEnd()}...`;
  }
  return text;
}

function basicString(value: string): string {
  return JSON.stringify(value).replace(/\x7f/g, '\\u007f');
}

export function tomlString(value: string): string {
  // \r is excluded too: a lone CR is invalid inside a TOML literal multiline string.
  const safe = !value.includes("'''") && !/[\x00-\x08\x0B-\x1F\x7F]/.test(value);
  return safe ? `'''\n${value}\n'''` : basicString(value);
}

export function toCodexToml(agent: AgentDef): string {
  return [
    `name = ${JSON.stringify(agent.name)}`,
    `description = ${basicString(cleanDescription(agent.description))}`,
    `developer_instructions = ${tomlString(agent.body)}`,
    '',
  ].join('\n');
}

export function toOpencodeAgent(agent: AgentDef): string {
  return [
    '---',
    `description: ${JSON.stringify(cleanDescription(agent.description))}`,
    'mode: subagent',
    '---',
    '',
    agent.body,
    '',
  ].join('\n');
}
