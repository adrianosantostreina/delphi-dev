import * as vscode from 'vscode';
import { createServices } from './agents/services';
import { registerCommands } from './commands/delphiCommands';
import { detectDelphiProject, watchDelphiFiles } from './context/delphiDetector';
import { createStatusBar, setStatusAgent, updateStatusBar } from './context/statusBar';
import { checkAndOfferClaudeignore, registerClaudeignoreCommand } from './features/claudeignore';
import { DelphiCommandsProvider } from './views/delphiCommandsProvider';
import { VIEWS } from './constants';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const services = createServices(context);

  registerCommands(context, services);
  registerClaudeignoreCommand(context);

  vscode.window.createTreeView(VIEWS.COMMANDS_TREE, { treeDataProvider: new DelphiCommandsProvider() });

  createStatusBar(context);
  const refreshAgent = async (): Promise<void> => {
    const installed = services.installedAgents();
    const configured = vscode.workspace.getConfiguration('delphiDev').get<string>('agent', 'auto');
    const id = configured !== 'auto' ? (configured as 'claude' | 'codex' | 'opencode') : installed.length === 1 ? installed[0] : undefined;
    setStatusAgent(id ? services.adapters[id].label : undefined);
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('delphi-dev.refreshStatus', refreshAgent),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('delphiDev.agent')) void refreshAgent();
      if (e.affectsConfiguration('delphiDev.showStatusBar')) detectDelphiProject().then(updateStatusBar);
    }),
  );
  await refreshAgent();

  // The .claudeignore feature only makes sense when Claude Code is the agent in use.
  const offerClaudeignore = (): void => {
    if (services.adapters.claude.isInstalled()) checkAndOfferClaudeignore(context);
  };
  const isDelphi = await detectDelphiProject();
  updateStatusBar(isDelphi);
  if (isDelphi) offerClaudeignore();
  watchDelphiFiles(context, (isDelphiNow) => {
    updateStatusBar(isDelphiNow);
    if (isDelphiNow) offerClaudeignore();
  });
}

export function deactivate(): void {
  // Cleanup handled by disposables in context.subscriptions
}
