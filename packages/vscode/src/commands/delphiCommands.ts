import * as vscode from 'vscode';
import { registry, vscodeCommandId } from '../registry';
import type { Services } from '../agents/services';
import { runCommand } from './runCommand';

export function registerCommands(context: vscode.ExtensionContext, services: Services): void {
  for (const command of registry.commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(vscodeCommandId(command.id), () => runCommand(command, services.run)),
    );
  }
  context.subscriptions.push(
    vscode.commands.registerCommand('delphi-dev.chooseAgent', async () => {
      const agent = await services.chooseAgent();
      if (agent) await vscode.commands.executeCommand('delphi-dev.refreshStatus');
    }),
  );
}
