import type { AgentId } from './types';

/** `none` = nothing to send to; `cancelled` = the user dismissed the picker (not an error). */
export type Resolution = { kind: 'agent'; id: AgentId } | { kind: 'none' } | { kind: 'cancelled' };

export interface ResolveInput {
  setting: 'auto' | AgentId;
  installed: AgentId[];
  last: AgentId | undefined;
  /** undefined means the user dismissed the picker. */
  pick(options: AgentId[]): Promise<AgentId | undefined>;
}

export async function resolveAgent(i: ResolveInput): Promise<Resolution> {
  if (i.setting !== 'auto') return { kind: 'agent', id: i.setting };
  if (i.installed.length === 0) return { kind: 'none' };
  if (i.installed.length === 1) return { kind: 'agent', id: i.installed[0] };
  if (i.last && i.installed.includes(i.last)) return { kind: 'agent', id: i.last };
  const picked = await i.pick(i.installed);
  return picked ? { kind: 'agent', id: picked } : { kind: 'cancelled' };
}

/** Setting values come from hand-editable JSON: anything unknown means "auto", never an exception. */
export function parseAgentSetting(value: unknown): 'auto' | AgentId {
  return value === 'claude' || value === 'codex' || value === 'opencode' ? value : 'auto';
}
