import type { AgentAdapter, AgentId, DeliveryResult } from '../agents/types';
import type { RegistryCommand } from '../registry';

export interface RunServices {
  adapters: Record<AgentId, AgentAdapter>;
  resolve(): Promise<AgentId | undefined>;
  /** `@path` of the active editor (plus `:range` for a selection when withRange), or undefined when there is no file. */
  fileRef(withRange: boolean): string | undefined;
  pluginPresent(agent: AgentId): boolean | undefined;
  remember(agent: AgentId): void;
  notifyMissingPlugin(agent: AgentId): Promise<void>;
  notifyNoAgent(): Promise<void>;
}

export async function runCommand(command: RegistryCommand, s: RunServices): Promise<DeliveryResult | 'no-agent'> {
  const id = await s.resolve();
  if (!id) {
    await s.notifyNoAgent();
    return 'no-agent';
  }
  const adapter = s.adapters[id];
  s.remember(id);
  if (s.pluginPresent(id) === false) await s.notifyMissingPlugin(id);
  const arg = command.takesFile ? s.fileRef(command.id === 'review') : undefined;
  return adapter.send(adapter.invocation(command, arg));
}
