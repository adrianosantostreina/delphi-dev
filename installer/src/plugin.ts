import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const PLUGIN_DEST = path.join(os.homedir(), '.claude', 'plugins', 'delphi-dev');
const REPO_URL = 'https://github.com/adrianosantostreina/delphi-dev.git';

function spawn(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

export function installPlugin(): void {
  if (fs.existsSync(PLUGIN_DEST)) {
    spawn('git', ['-C', PLUGIN_DEST, 'pull', '--ff-only']);
  } else {
    spawn('git', ['clone', '--depth=1', REPO_URL, PLUGIN_DEST]);
  }
  spawn('claude', ['plugin', 'install', PLUGIN_DEST]);
}

export function isPluginInstalled(): boolean {
  try {
    const output = execSync('claude plugin list', { encoding: 'utf-8' });
    return output.includes('delphi-dev');
  } catch {
    return false;
  }
}
