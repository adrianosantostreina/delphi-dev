import type { AgentAdapter, AgentId, DeliveryResult } from '../agents/types';
import type { Resolution } from '../agents/resolve';
import type { RegistryCommand } from '../registry';

export interface RunServices {
  adapters: Record<AgentId, AgentAdapter>;
  resolve(): Promise<Resolution>;
  /** `@path` of the active editor (plus `:range` for a selection when withRange), or undefined when there is no file. */
  fileRef(withRange: boolean): string | undefined;
  pluginPresent(agent: AgentId): boolean | undefined;
  remember(agent: AgentId): void;
  notifyMissingPlugin(agent: AgentId): Promise<void>;
  notifyNoAgent(): Promise<void>;
}

export async function runCommand(command: RegistryCommand, s: RunServices): Promise<DeliveryResult | 'no-agent' | 'cancelled'> {
  const resolution = await s.resolve();
  // Dismissing the picker is a choice, not an error: say nothing.
  if (resolution.kind === 'cancelled') return 'cancelled';
  if (resolution.kind === 'none') {
    await s.notifyNoAgent();
    return 'no-agent';
  }
  const id = resolution.id;
  const adapter = s.adapters[id];
  s.remember(id);
  // A notification only resolves when the user reacts to it: it must never hold the command back.
  if (s.pluginPresent(id) === false) {
    try {
      void Promise.resolve(s.notifyMissingPlugin(id)).catch(() => undefined);
    } catch {
      // a notification that throws is not worth losing the command
    }
  }
  const arg = command.takesFile ? s.fileRef(command.id === 'review') : undefined;
  return adapter.send(adapter.invocation(command, arg));
}
