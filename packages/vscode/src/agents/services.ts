import * as fs from 'node:fs';
import * as os from 'node:os';
import * as vscode from 'vscode';
import { getActiveFileContext } from '../utils/fileUtils';
import type { RunServices } from '../commands/runCommand';
import { chooseAgentFlow } from './choose';
import { createClaudeAdapter } from './claude';
import { createCodexAdapter } from './codex';
import { realDeps } from './deps';
import { createOpencodeAdapter } from './opencode';
import { installCommandFor, pluginPresent } from './presence';
import { parseAgentSetting, resolveAgent, type Resolution } from './resolve';
import type { AgentAdapter, AgentId } from './types';

const LAST_AGENT_KEY = 'delphiDev.lastAgent';
const ALL: AgentId[] = ['claude', 'codex', 'opencode'];

export interface Services {
  run: RunServices;
  adapters: Record<AgentId, AgentAdapter>;
  installedAgents(): AgentId[];
  /** The validated delphiDev.agent setting; an invalid value reads as 'auto'. */
  agentSetting(): 'auto' | AgentId;
  current(): Promise<Resolution>;
  chooseAgent(): Promise<AgentId | undefined>;
}

export function createServices(context: vscode.ExtensionContext): Services {
  const deps = realDeps();
  const adapters: Record<AgentId, AgentAdapter> = {
    claude: createClaudeAdapter(deps),
    codex: createCodexAdapter(deps),
    opencode: createOpencodeAdapter(deps),
  };
  const pt = deps.isPortuguese();
  const installedAgents = (): AgentId[] => ALL.filter((id) => adapters[id].isInstalled());
  const lastAgent = (): AgentId | undefined => {
    const value = context.globalState.get<string>(LAST_AGENT_KEY);
    return ALL.includes(value as AgentId) ? (value as AgentId) : undefined;
  };

  async function pick(options: AgentId[]): Promise<AgentId | undefined> {
    const choice = await vscode.window.showQuickPick(
      options.map((id) => ({ label: adapters[id].label, id })),
      { placeHolder: pt ? 'Qual agente deve receber os comandos do Delphi Dev?' : 'Which agent should receive Delphi Dev commands?' },
    );
    return choice?.id;
  }

  const setting = (): 'auto' | AgentId =>
    parseAgentSetting(vscode.workspace.getConfiguration('delphiDev').get<unknown>('agent', 'auto'));

  const current = (): Promise<Resolution> => {
    const chosen = setting();
    // An explicit setting wins: do not probe the machine for installed agents it does not need.
    return resolveAgent({ setting: chosen, installed: chosen === 'auto' ? installedAgents() : [], last: lastAgent(), pick });
  };

  const chooseAgent = (): Promise<AgentId | undefined> =>
    chooseAgentFlow({
      installed: installedAgents(),
      setting: setting(),
      labels: { claude: adapters.claude.label, codex: adapters.codex.label, opencode: adapters.opencode.label },
      pt,
      pick,
      remember: (agent) => {
        void context.globalState.update(LAST_AGENT_KEY, agent);
      },
      info: (message) => {
        void vscode.window.showInformationMessage(message);
      },
      notifyNoAgent,
    });

  async function notifyNoAgent(): Promise<void> {
    await vscode.window.showWarningMessage(
      pt
        ? 'Nenhum agente encontrado (Claude Code, Codex ou OpenCode). Instale um deles e tente de novo.'
        : 'No agent found (Claude Code, Codex or OpenCode). Install one and try again.',
    );
  }

  const run: RunServices = {
    adapters,
    resolve: current,
    fileRef: (withRange) => {
      const ctx = getActiveFileContext();
      if (!ctx) return undefined;
      return `@${ctx.filePath}${withRange && ctx.lineRange ? `:${ctx.lineRange}` : ''}`;
    },
    pluginPresent: (agent) =>
      pluginPresent(agent, os.homedir(), process.env, (p) => fs.existsSync(p), vscode.workspace.workspaceFolders?.[0]?.uri.fsPath),
    remember: (agent) => {
      void context.globalState.update(LAST_AGENT_KEY, agent);
    },
    notifyMissingPlugin: async (agent) => {
      const command = installCommandFor(agent);
      const copy = pt ? 'Copiar comando' : 'Copy command';
      const choice = await vscode.window.showWarningMessage(
        pt
          ? `O plugin delphi-dev ainda não está instalado para ${adapters[agent].label}. Rode: ${command}`
          : `The delphi-dev plugin is not installed for ${adapters[agent].label} yet. Run: ${command}`,
        copy,
      );
      if (choice === copy) await vscode.env.clipboard.writeText(command);
    },
    notifyNoAgent,
  };

  return { run, adapters, installedAgents, agentSetting: setting, current, chooseAgent };
}
