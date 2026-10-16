import type { AdapterDeps, AgentAdapter, DeliveryResult } from './types';
import { say } from './types';

const EXTENSION = 'anthropic.claude-code';

export function createClaudeAdapter(d: AdapterDeps): AgentAdapter {
  return {
    id: 'claude',
    label: 'Claude Code',
    isInstalled: () => d.hasExtension(EXTENSION),
    invocation: (command, arg) => `/${command.id}${arg ? ` ${arg}` : ''}`,
    async send(text): Promise<DeliveryResult> {
      try {
        await d.executeCommand('claude-vscode.primaryEditor.open', undefined, text);
        return 'sent';
      } catch {
        // fall through to the URI handler, exactly as claudeCodeBridge did
      }
      try {
        if (await d.openExternal(`vscode://anthropic.claude-code/open?prompt=${encodeURIComponent(text)}`)) return 'sent';
      } catch {
        // fall through to the install offer
      }
      const install = say(d, 'Instalar Claude Code', 'Install Claude Code');
      const choice = await d.showError(
        say(d, 'Extensão do Claude Code não encontrada. Instale-a pelo marketplace.',
          'Claude Code extension not found. Please install it from the marketplace.'),
        install,
      );
      if (choice === install) await d.executeCommand('workbench.extensions.installExtension', EXTENSION);
      return 'unavailable';
    },
  };
}
