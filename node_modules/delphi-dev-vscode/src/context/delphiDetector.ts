import * as vscode from 'vscode';
import { CONTEXT_KEYS, DELPHI_PROJECT_GLOB, DELPHI_GLOB_PATTERN } from '../constants';

let fileWatcher: vscode.FileSystemWatcher | undefined;

export async function detectDelphiProject(): Promise<boolean> {
  const files = await vscode.workspace.findFiles(DELPHI_PROJECT_GLOB, null, 1);
  const isDelphi = files.length > 0;
  await vscode.commands.executeCommand('setContext', CONTEXT_KEYS.IS_DELPHI_PROJECT, isDelphi);
  return isDelphi;
}

export function watchDelphiFiles(
  context: vscode.ExtensionContext,
  onChanged: (isDelphi: boolean) => void
): void {
  fileWatcher = vscode.workspace.createFileSystemWatcher(DELPHI_GLOB_PATTERN);

  const refresh = async () => {
    const isDelphi = await detectDelphiProject();
    onChanged(isDelphi);
  };

  fileWatcher.onDidCreate(refresh);
  fileWatcher.onDidDelete(refresh);

  context.subscriptions.push(fileWatcher);
}
