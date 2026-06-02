import * as vscode from 'vscode';

const CLAUDEIGNORE_CONTENT = `# =============================================
# .claudeignore — Projeto Delphi
# Gerado automaticamente pelo plugin delphi-dev
# =============================================

# --- Arquivos compilados e binarios ---
*.dcu
*.exe
*.dll
*.bpl
*.dcp
*.rsm
*.so
*.dylib
*.apk
*.ipa

# --- Recursos compilados ---
*.res
*.dres

# --- Configuracao e metadados de IDE ---
*.dproj
*.dof
*.cfg
*.local
*.identcache
*.projdata
*.tvsconfig
*.dsk

# --- Mapas e debug ---
*.map
*.drc
*.jdbg

# --- Arquivos temporarios ---
*.~*
*.bak
*.tmp
*.log

# --- Saidas de compilacao por plataforma ---
Win32/
Win64/
Android/
Android64/
iOSDevice32/
iOSDevice64/
iOSSimulator/
OSX64/
OSXARM64/
Linux64/

# --- Historico e backup de IDE ---
__history/
__recovery/

# --- Outros ---
*.svn/
.git/
node_modules/
`;

const DISMISSED_KEY = 'delphiDev.claudeignoreDismissed';

export async function checkAndOfferClaudeignore(
  context: vscode.ExtensionContext
): Promise<void> {
  const config = vscode.workspace.getConfiguration('delphiDev');
  if (!config.get<boolean>('autoCreateClaudeignore', true)) {
    return;
  }

  const dismissed = context.workspaceState.get<boolean>(DISMISSED_KEY, false);
  if (dismissed) {
    return;
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const rootUri = workspaceFolders[0].uri;
  const claudeignoreUri = vscode.Uri.joinPath(rootUri, '.claudeignore');

  try {
    await vscode.workspace.fs.stat(claudeignoreUri);
    // File exists, do nothing
    return;
  } catch {
    // File doesn't exist, offer to create
  }

  const action = await vscode.window.showInformationMessage(
    'Delphi project detected. Create .claudeignore to optimize Claude Code performance?',
    'Create',
    'Not now'
  );

  if (action === 'Create') {
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(claudeignoreUri, encoder.encode(CLAUDEIGNORE_CONTENT));
    vscode.window.showInformationMessage('.claudeignore created successfully.');
  } else {
    await context.workspaceState.update(DISMISSED_KEY, true);
  }
}

export function registerClaudeignoreCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('delphi-dev.createClaudeignore', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage('No workspace folder open.');
        return;
      }

      const rootUri = workspaceFolders[0].uri;
      const claudeignoreUri = vscode.Uri.joinPath(rootUri, '.claudeignore');

      try {
        await vscode.workspace.fs.stat(claudeignoreUri);
        const overwrite = await vscode.window.showWarningMessage(
          '.claudeignore already exists. Overwrite with Delphi defaults?',
          'Overwrite',
          'Cancel'
        );
        if (overwrite !== 'Overwrite') {
          return;
        }
      } catch {
        // File doesn't exist, proceed
      }

      const encoder = new TextEncoder();
      await vscode.workspace.fs.writeFile(claudeignoreUri, encoder.encode(CLAUDEIGNORE_CONTENT));
      vscode.window.showInformationMessage('.claudeignore created with Delphi defaults.');
    })
  );
}
