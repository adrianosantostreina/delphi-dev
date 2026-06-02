import { execSync } from 'child_process';

export interface SystemInfo {
  nodeVersion: string;
  hasClaudeCLI: boolean;
  hasVSCode: boolean;
  hasGit: boolean;
}

export function detectSystem(): SystemInfo {
  return {
    nodeVersion: process.version,
    hasClaudeCLI: commandExists('claude --version'),
    hasVSCode: commandExists('code --version'),
    hasGit: commandExists('git --version'),
  };
}

function commandExists(cmd: string): boolean {
  try {
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
