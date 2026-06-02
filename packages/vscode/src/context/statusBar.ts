import * as vscode from 'vscode';
import { COMMANDS } from '../constants';

let statusBarItem: vscode.StatusBarItem | undefined;

export function createStatusBar(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBarItem.text = '$(tools) Delphi Dev';
  statusBarItem.tooltip = 'Delphi Dev for Claude Code - Click for commands';
  statusBarItem.command = COMMANDS.ABOUT;
  context.subscriptions.push(statusBarItem);
}

export function updateStatusBar(visible: boolean): void {
  if (!statusBarItem) {
    return;
  }

  const config = vscode.workspace.getConfiguration('delphiDev');
  const showStatusBar = config.get<boolean>('showStatusBar', true);

  if (visible && showStatusBar) {
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}
