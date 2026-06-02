import { execSync } from 'child_process';

const EXTENSION_ID = 'adrianosantos.delphi-dev-vscode';
const MARKETPLACE_URL = 'https://marketplace.visualstudio.com/items?itemName=adrianosantos.delphi-dev-vscode';

// On Windows, use execSync with a string command so Node finds code.cmd via PATH
// without the DEP0190 shell+args deprecation warning.
function run(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
}

export function installVSCodeExtension(): void {
  try {
    execSync(`code --install-extension ${EXTENSION_ID}`, { stdio: 'inherit' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not found') || msg.includes('not be found')) {
      throw new Error(
        `VS Code extension not yet on the Marketplace.\n` +
        `Install manually when available: ${MARKETPLACE_URL}\n` +
        `Or search "Delphi Dev" inside VS Code Extensions panel.`
      );
    }
    throw err;
  }
}

export function isVSCodeExtensionInstalled(): boolean {
  try {
    const output = run('code --list-extensions');
    return output.toLowerCase().includes('adrianosantos.delphi-dev-vscode');
  } catch {
    return false;
  }
}

export function isVSCodeAvailable(): boolean {
  try {
    run('code --version');
    return true;
  } catch {
    return false;
  }
}
