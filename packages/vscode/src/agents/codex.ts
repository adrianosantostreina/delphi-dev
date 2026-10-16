import type { AdapterDeps, AgentAdapter, DeliveryResult } from './types';
import { say, tell } from './types';

const EXTENSION = 'openai.chatgpt';

export function createCodexAdapter(d: AdapterDeps): AgentAdapter {
  return {
    id: 'codex',
    label: 'Codex',
    isInstalled: () => d.hasExtension(EXTENSION),
    invocation: (command, arg) => `$delphi-cmd-${command.id}${arg ? ` ${arg}` : ''}`,
    async send(text): Promise<DeliveryResult> {
      if (!d.hasExtension(EXTENSION)) {
        const install = say(d, 'Instalar Codex', 'Install Codex');
        const choice = await d.showError(
          say(d, 'Extensão do Codex (openai.chatgpt) não encontrada.', 'Codex extension (openai.chatgpt) not found.'),
          install,
        );
        if (choice === install) await d.executeCommand('workbench.extensions.installExtension', EXTENSION);
        return 'unavailable';
      }

      // Experimental and undocumented: only when the maintainer confirmed it prefills without sending.
      if (d.getSetting<boolean>('codexPromptUri', false)) {
        try {
          if (await d.openExternal(`vscode://openai.chatgpt/?prompt=${encodeURIComponent(text)}`)) return 'prefilled';
        } catch {
          // fall through to copy
        }
      }

      for (const open of ['chatgpt.openSidebar', 'chatgpt.newCodexPanel']) {
        try {
          await d.executeCommand(open);
          break;
        } catch {
          // try the next one
        }
      }
      // Codex has no documented way to receive a prompt: copy it and say so.
      await d.writeClipboard(text);
      tell(d,
        say(d, `Comando copiado: ${text} — cole no Codex e tecle Enter.`, `Command copied: ${text} — paste it into Codex and press Enter.`),
      );
      return 'copied';
    },
  };
}
