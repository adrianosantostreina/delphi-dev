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

  // claude plugin install <path> does not support local paths directly.
  // The correct sequence is: marketplace add → plugin install <name>@<source>
  try {
    spawn('claude', ['plugin', 'marketplace', 'add', PLUGIN_DEST]);
    spawn('claude', ['plugin', 'install', 'delphi-dev@delphi-dev']);
  } catch {
    // Fallback: some Claude Code versions use a different command
    try {
      spawn('claude', ['plugin', 'install', '--from-path', PLUGIN_DEST]);
    } catch {
      throw new Error(
        `Could not register the plugin automatically.\n\n` +
        `Please open Claude Code and run these two commands:\n` +
        `  /plugin marketplace add ${PLUGIN_DEST}\n` +
        `  /plugin install delphi-dev@delphi-dev\n`
      );
    }
  }
}

export function isPluginInstalled(): boolean {
  try {
    const output = execSync('claude plugin list', { encoding: 'utf-8' });
    return output.includes('delphi-dev');
  } catch {
    return false;
  }
}
