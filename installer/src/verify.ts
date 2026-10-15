import { detectSystem } from './detect';
import { isPluginInstalled } from './plugin';
import { isVSCodeExtensionInstalled, isVSCodeAvailable } from './vscode-ext';

export interface VerifyResult {
  claudeOk: boolean;
  pluginOk: boolean;
  vscodeOk: boolean;
}

export function verifyInstallation(): VerifyResult {
  const system = detectSystem();
  return {
    claudeOk: system.hasClaudeCLI,
    pluginOk: isPluginInstalled(),
    vscodeOk: !isVSCodeAvailable() || isVSCodeExtensionInstalled(),
  };
}
