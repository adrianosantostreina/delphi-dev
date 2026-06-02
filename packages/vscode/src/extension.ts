import * as vscode from 'vscode';
import { registerCommands } from './commands/delphiCommands';
import { DelphiCommandsProvider } from './views/delphiCommandsProvider';
import { detectDelphiProject, watchDelphiFiles } from './context/delphiDetector';
import { createStatusBar, updateStatusBar } from './context/statusBar';
import { checkAndOfferClaudeignore, registerClaudeignoreCommand } from './features/claudeignore';
import { VIEWS } from './constants';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Register all commands
  registerCommands(context);
  registerClaudeignoreCommand(context);

  // Set up tree view
  const treeProvider = new DelphiCommandsProvider();
  vscode.window.createTreeView(VIEWS.COMMANDS_TREE, {
    treeDataProvider: treeProvider,
  });

  // Set up status bar
  createStatusBar(context);

  // Detect Delphi project and configure UI
  const isDelphi = await detectDelphiProject();
  updateStatusBar(isDelphi);

  if (isDelphi) {
    checkAndOfferClaudeignore(context);
  }

  // Watch for changes in Delphi files
  watchDelphiFiles(context, (isDelphiNow) => {
    updateStatusBar(isDelphiNow);
    if (isDelphiNow) {
      checkAndOfferClaudeignore(context);
    }
  });

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('delphiDev.showStatusBar')) {
        detectDelphiProject().then(updateStatusBar);
      }
    })
  );
}

export function deactivate(): void {
  // Cleanup handled by disposables in context.subscriptions
}
