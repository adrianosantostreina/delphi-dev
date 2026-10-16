import type { AdapterDeps, TerminalLike } from '../src/agents/types';
import type { RegistryCommand } from '../src/registry';

export interface Fake extends AdapterDeps {
  calls: string[];
  clipboard: string[];
  infos: string[];
  errors: string[];
  terminals: { name: string; sent: { text: string; newline?: boolean }[]; shown: number }[];
}

export function cmd(id: string, takesFile = false): RegistryCommand {
  return {
    id,
    title: { 'pt-BR': id, 'en-US': id },
    description: { 'pt-BR': id, 'en-US': id },
    takesFile,
    icon: 'info',
  };
}

export function fakeDeps(over: Partial<AdapterDeps> = {}): Fake {
  const calls: string[] = [];
  const clipboard: string[] = [];
  const infos: string[] = [];
  const errors: string[] = [];
  const terminals: Fake['terminals'] = [];
  const base: AdapterDeps = {
    executeCommand: async (command, ...args) => {
      calls.push(`exec:${command}${args.length ? `:${JSON.stringify(args)}` : ''}`);
      return undefined;
    },
    openExternal: async (uri) => {
      calls.push(`open:${uri}`);
      return true;
    },
    writeClipboard: async (text) => {
      clipboard.push(text);
    },
    showInfo: async (message) => {
      infos.push(message);
      return undefined;
    },
    showError: async (message) => {
      errors.push(message);
      return undefined;
    },
    hasExtension: () => true,
    commandExists: () => true,
    getSetting: <T>(_key: string, fallback: T) => fallback,
    fetch: async () => ({ ok: true, status: 200 }),
    createTerminal: ({ name }) => {
      const t = { name, sent: [] as { text: string; newline?: boolean }[], shown: 0 };
      terminals.push(t);
      const like: TerminalLike = {
        sendText: (text, newline) => t.sent.push({ text, newline }),
        show: () => {
          t.shown++;
        },
      };
      return like;
    },
    findTerminal: () => undefined,
    sleep: async () => undefined,
    workspaceCwd: () => '/work',
    isPortuguese: () => true,
  };
  return Object.assign({ ...base, ...over }, { calls, clipboard, infos, errors, terminals });
}
