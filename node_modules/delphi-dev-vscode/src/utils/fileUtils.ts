import * as vscode from 'vscode';

export interface FileContext {
  filePath: string;
  lineRange?: string;
  hasSelection: boolean;
}

export function getActiveFileContext(): FileContext | null {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return null;
  }

  const filePath = vscode.workspace.asRelativePath(editor.document.uri);
  const selection = editor.selection;

  if (!selection.isEmpty) {
    const startLine = selection.start.line + 1;
    const endLine = selection.end.line + 1;
    return {
      filePath,
      lineRange: `${startLine}-${endLine}`,
      hasSelection: true,
    };
  }

  return { filePath, hasSelection: false };
}

export function isDelphiFile(uri: vscode.Uri): boolean {
  const ext = uri.fsPath.toLowerCase();
  return /\.(pas|dpr|dfm|dpk|inc|fmx)$/.test(ext);
}
