import { spawnSync } from 'child_process';

const EXTENSION_ID = 'adrianosantos.delphi-dev-vscode';

function spawn(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

export function installVSCodeExtension(): void {
  spawn('code', ['--install-extension', EXTENSION_ID]);
}

export function isVSCodeExtensionInstalled(): boolean {
  try {
    const result = spawnSync('code', ['--list-extensions'], { encoding: 'utf-8', shell: false });
    if (result.status !== 0) return false;
    return (result.stdout ?? '').toLowerCase().includes('adrianosantos.delphi-dev-vscode');
  } catch {
    return false;
  }
}

export function isVSCodeAvailable(): boolean {
  try {
    const result = spawnSync('code', ['--version'], { stdio: 'ignore', shell: false });
    return result.status === 0;
  } catch {
    return false;
  }
}
