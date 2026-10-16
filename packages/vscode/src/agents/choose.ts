import type { AgentId } from './types';

export interface ChooseInput {
  installed: AgentId[];
  setting: 'auto' | AgentId;
  labels: Record<AgentId, string>;
  pt: boolean;
  pick(options: AgentId[]): Promise<AgentId | undefined>;
  remember(agent: AgentId): void;
  info(message: string): void;
  notifyNoAgent(): Promise<void>;
}

/** The status bar "choose agent" flow. Returns the agent the user picked, or undefined when nothing changed. */
export async function chooseAgentFlow(i: ChooseInput): Promise<AgentId | undefined> {
  if (i.installed.length === 0) {
    await i.notifyNoAgent();
    return undefined;
  }
  if (i.installed.length === 1) {
    const only = i.labels[i.installed[0]];
    if (i.setting === 'auto') {
      i.info(i.pt ? `Apenas o ${only} está instalado: ele já é o agente em uso.` : `Only ${only} is installed: it is already the agent in use.`);
    } else {
      const set = i.labels[i.setting];
      i.info(
        i.pt
          ? `Apenas o ${only} está instalado. O agente em uso vem da configuração delphiDev.agent (${set}).`
          : `Only ${only} is installed. The agent in use comes from the delphiDev.agent setting (${set}).`,
      );
    }
    return undefined;
  }
  const choice = await i.pick(i.installed);
  if (choice) i.remember(choice);
  return choice;
}
