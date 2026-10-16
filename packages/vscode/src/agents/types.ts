import type { RegistryCommand } from '../registry';

export type AgentId = 'claude' | 'codex' | 'opencode';
export type DeliveryResult = 'sent' | 'prefilled' | 'copied' | 'unavailable';

export interface TerminalLike {
  sendText(text: string, addNewLine?: boolean): void;
  show(preserveFocus?: boolean): void;
  dispose(): void;
}

export interface FetchResult {
  ok: boolean;
  status: number;
}

/** Everything an adapter needs from the outside world; faked in tests. */
export interface AdapterDeps {
  executeCommand(command: string, ...args: unknown[]): PromiseLike<unknown>;
  openExternal(uri: string): PromiseLike<boolean>;
  writeClipboard(text: string): PromiseLike<void>;
  showInfo(message: string, ...actions: string[]): PromiseLike<string | undefined>;
  showError(message: string, ...actions: string[]): PromiseLike<string | undefined>;
  hasExtension(id: string): boolean;
  commandExists(cmd: string): boolean;
  getSetting<T>(key: string, fallback: T): T;
  fetch(url: string, init?: { method?: string; body?: string; headers?: Record<string, string> }): Promise<FetchResult>;
  createTerminal(opts: { name: string; cwd?: string }): TerminalLike;
  findTerminal(name: string): TerminalLike | undefined;
  sleep(ms: number): Promise<void>;
  now(): number;
  workspaceCwd(): string | undefined;
  isPortuguese(): boolean;
}

export interface AgentAdapter {
  readonly id: AgentId;
  readonly label: string;
  isInstalled(): boolean;
  invocation(command: RegistryCommand, arg?: string): string;
  send(text: string): Promise<DeliveryResult>;
}

export function say(d: AdapterDeps, pt: string, en: string): string {
  return d.isPortuguese() ? pt : en;
}
