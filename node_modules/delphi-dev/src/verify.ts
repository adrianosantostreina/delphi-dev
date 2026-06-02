import { detectSystem } from './detect';
import { isPluginInstalled } from './plugin';
import { isVSCodeExtensionInstalled, isVSCodeAvailable } from './vscode-ext';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const RAG_PATH = path.join(os.homedir(), '.claude', 'plugins', 'delphi-dev', 'rag', 'rag.db');

export interface VerifyResult {
  claudeOk: boolean;
  pluginOk: boolean;
  ragOk: boolean;
  vscodeOk: boolean;
  hooksOk: boolean;
}

export function verifyInstallation(): VerifyResult {
  const system = detectSystem();
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  let hooksOk = false;
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    hooksOk = !!(settings.hooks?.SubagentStop && settings.hooks?.UserPromptSubmit);
  }
  return {
    claudeOk: system.hasClaudeCLI,
    pluginOk: isPluginInstalled(),
    ragOk: fs.existsSync(RAG_PATH),
    vscodeOk: !isVSCodeAvailable() || isVSCodeExtensionInstalled(),
    hooksOk,
  };
}
