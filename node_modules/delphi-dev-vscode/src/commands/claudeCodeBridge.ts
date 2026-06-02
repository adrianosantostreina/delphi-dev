import * as vscode from 'vscode';

export async function sendToClaudeCode(prompt: string): Promise<void> {
  try {
    await vscode.commands.executeCommand(
      'claude-vscode.primaryEditor.open',
      undefined,
      prompt
    );
  } catch {
    await fallbackToUri(prompt);
  }
}

async function fallbackToUri(prompt: string): Promise<void> {
  const encodedPrompt = encodeURIComponent(prompt);
  const uri = vscode.Uri.parse(
    `vscode://anthropic.claude-code/open?prompt=${encodedPrompt}`
  );
  try {
    const opened = await vscode.env.openExternal(uri);
    if (!opened) {
      await showInstallPrompt();
    }
  } catch {
    await showInstallPrompt();
  }
}

async function showInstallPrompt(): Promise<void> {
  const action = await vscode.window.showErrorMessage(
    'Claude Code extension not found. Please install it from the marketplace.',
    'Install Claude Code'
  );
  if (action === 'Install Claude Code') {
    await vscode.commands.executeCommand(
      'workbench.extensions.installExtension',
      'anthropic.claude-code'
    );
  }
}
