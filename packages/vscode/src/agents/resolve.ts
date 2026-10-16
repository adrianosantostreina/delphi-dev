import type { AgentId } from './types';

export interface ResolveInput {
  setting: 'auto' | AgentId;
  installed: AgentId[];
  last: AgentId | undefined;
  pick(options: AgentId[]): Promise<AgentId | undefined>;
}

export async function resolveAgent(i: ResolveInput): Promise<AgentId | undefined> {
  if (i.setting !== 'auto') return i.setting;
  if (i.installed.length === 0) return undefined;
  if (i.installed.length === 1) return i.installed[0];
  if (i.last && i.installed.includes(i.last)) return i.last;
  return i.pick(i.installed);
}

/** Setting values come from hand-editable JSON: anything unknown means "auto", never an exception. */
export function parseAgentSetting(value: unknown): 'auto' | AgentId {
  return value === 'claude' || value === 'codex' || value === 'opencode' ? value : 'auto';
}
