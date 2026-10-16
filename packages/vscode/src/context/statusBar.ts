import * as vscode from 'vscode';

let statusBarItem: vscode.StatusBarItem | undefined;
let agentLabel: string | undefined;

function render(): void {
  if (!statusBarItem) return;
  statusBarItem.text = agentLabel ? `$(tools) Delphi Dev · ${agentLabel}` : '$(tools) Delphi Dev';
}

export function createStatusBar(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBarItem.tooltip = 'Delphi Dev - remote control for your AI agent (click to choose the agent)';
  statusBarItem.command = 'delphi-dev.chooseAgent';
  render();
  context.subscriptions.push(statusBarItem);
}

export function setStatusAgent(label: string | undefined): void {
  agentLabel = label;
  render();
}

export function updateStatusBar(visible: boolean): void {
  if (!statusBarItem) return;
  const showStatusBar = vscode.workspace.getConfiguration('delphiDev').get<boolean>('showStatusBar', true);
  if (visible && showStatusBar) statusBarItem.show();
  else statusBarItem.hide();
}
