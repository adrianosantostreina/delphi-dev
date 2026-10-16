import type { AdapterDeps, AgentAdapter, DeliveryResult, TerminalLike } from './types';
import { say } from './types';

export const OPENCODE_TERMINAL_NAME = 'OpenCode - Delphi Dev';
const HEALTH_ATTEMPTS = 40;
const HEALTH_INTERVAL_MS = 500;
const APPEND_ATTEMPTS = 5;
// /tui/append-prompt is fire-and-forget (it publishes an event and answers 200 even when no TUI is
// listening), and the server answers /global/health before the TUI has subscribed to events.
const TUI_SETTLE_MS = 2000;
const DEFAULT_PORT = 4096;
// A terminal we created less than this long ago may still be booting; an older one with the server still down is stuck.
const STARTING_GRACE_MS = 30_000;
const INSTALL_COMMAND = 'npm i -g opencode-ai';

export function createOpencodeAdapter(d: AdapterDeps): AgentAdapter {
  // The value ends up typed into a shell, and workspace settings can come from a cloned repo:
  // accept nothing but a plain integer port.
  const port = (): number => {
    const raw: unknown = d.getSetting<unknown>('opencodePort', DEFAULT_PORT);
    return typeof raw === 'number' && Number.isInteger(raw) && raw >= 1024 && raw <= 65535 ? raw : DEFAULT_PORT;
  };
  const base = (): string => `http://127.0.0.1:${port()}`;

  async function healthy(): Promise<boolean> {
    try {
      return (await d.fetch(`${base()}/global/health`)).ok;
    } catch {
      return false;
    }
  }

  async function post(path: string, body: unknown): Promise<boolean> {
    try {
      const r = await d.fetch(`${base()}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return r.ok;
    } catch {
      return false;
    }
  }

  // Each step is retried on its own: once the text is in the prompt it must not be appended again.
  async function deliver(text: string): Promise<boolean> {
    let appended = false;
    for (let attempt = 0; attempt < APPEND_ATTEMPTS; attempt++) {
      if (!appended) {
        // Best effort: drop whatever draft the user left in the prompt so the command is not glued to it.
        await post('/tui/clear-prompt', {});
        appended = await post('/tui/append-prompt', { text });
      }
      if (appended && (await post('/tui/submit-prompt', {}))) return true;
      await d.sleep(HEALTH_INTERVAL_MS);
    }
    return false;
  }

  async function waitHealthy(): Promise<boolean> {
    for (let attempt = 0; attempt < HEALTH_ATTEMPTS; attempt++) {
      if (await healthy()) return true;
      await d.sleep(HEALTH_INTERVAL_MS);
    }
    return false;
  }

  async function copyFallback(text: string): Promise<DeliveryResult> {
    await d.writeClipboard(text);
    await d.showInfo(
      say(d, `Comando copiado: ${text} — cole no OpenCode e tecle Enter.`, `Command copied: ${text} — paste it into OpenCode and press Enter.`),
    );
    return 'copied';
  }

  const isInstalled = (): boolean => d.hasExtension('sst-dev.opencode') || d.commandExists('opencode');

  async function offerInstall(): Promise<DeliveryResult> {
    const copy = say(d, 'Copiar comando de instalação', 'Copy install command');
    const choice = await d.showError(
      say(d, `OpenCode não encontrado (nem a extensão nem o comando opencode no PATH). Instale com: ${INSTALL_COMMAND}`,
        `OpenCode not found (neither the extension nor the opencode command on PATH). Install it with: ${INSTALL_COMMAND}`),
      copy,
    );
    if (choice === copy) await d.writeClipboard(INSTALL_COMMAND);
    return 'unavailable';
  }

  // The one terminal this adapter started, and when. Only that one may be waited on without being replaced.
  let started: { terminal: TerminalLike; at: number } | undefined;

  return {
    id: 'opencode',
    label: 'OpenCode',
    isInstalled,
    invocation: (command, arg) => `/delphi-${command.id}${arg ? ` ${arg}` : ''}`,
    async send(text): Promise<DeliveryResult> {
      const up = await healthy();
      // A server that already answers is reusable even when we cannot see the install (e.g. a binary outside PATH).
      if (!up && !isInstalled()) return offerInstall();
      if (up) {
        if (await deliver(text)) return 'sent';
        return copyFallback(text);
      }

      const existing = d.findTerminal(OPENCODE_TERMINAL_NAME);
      if (existing && started?.terminal === existing && d.now() - started.at < STARTING_GRACE_MS) {
        // Ours and still starting up: just wait for it, never type into it again.
        existing.show(true);
      } else {
        // Server down: whatever terminal carries this name is stuck or foreign (a restored one, an old TUI). Do not trust it.
        existing?.dispose();
        const terminal = d.createTerminal({ name: OPENCODE_TERMINAL_NAME, cwd: d.workspaceCwd() });
        started = { terminal, at: d.now() };
        terminal.show(true);
        terminal.sendText(`opencode --port ${port()}`, true);
      }

      if (await waitHealthy()) {
        await d.sleep(TUI_SETTLE_MS);
        if (await deliver(text)) return 'sent';
      }
      return copyFallback(text);
    },
  };
}
