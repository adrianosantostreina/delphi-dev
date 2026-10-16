import * as vscode from 'vscode';
import type { AdapterDeps } from './types';
import { commandOnPath } from './which';

export function realDeps(): AdapterDeps {
  return {
    executeCommand: (command, ...args) => vscode.commands.executeCommand(command, ...args),
    openExternal: (uri) => vscode.env.openExternal(vscode.Uri.parse(uri)),
    writeClipboard: (text) => vscode.env.clipboard.writeText(text),
    showInfo: (message, ...actions) => vscode.window.showInformationMessage(message, ...actions),
    showError: (message, ...actions) => vscode.window.showErrorMessage(message, ...actions),
    hasExtension: (id) => vscode.extensions.getExtension(id) !== undefined,
    commandExists: commandOnPath,
    getSetting: <T>(key: string, fallback: T): T => vscode.workspace.getConfiguration('delphiDev').get<T>(key, fallback),
    fetch: async (url, init) => {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(2500) });
      return { ok: r.ok, status: r.status };
    },
    createTerminal: ({ name, cwd }) => vscode.window.createTerminal({ name, cwd }),
    findTerminal: (name) => vscode.window.terminals.find((t) => t.name === name),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    workspaceCwd: () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    isPortuguese: () => vscode.env.language.toLowerCase().startsWith('pt'),
  };
}
