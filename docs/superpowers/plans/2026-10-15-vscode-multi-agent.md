# Extensão Delphi-Dev multiagente — Plano de implementação (3C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A extensão Delphi-Dev do VS Code passa a controlar Claude Code, Codex e OpenCode a partir da mesma lista de comandos (registro `portable.json`), com adaptadores testáveis, escolha do agente e publicação corrigida.

**Architecture:** O registro é copiado para `src/generated/registry.json` por um script de sincronização que também gera `contributes.commands`. Cada agente é um adaptador com dependências injetadas (`AdapterDeps`), então toda a lógica de entrega é testada com vitest sem VS Code. Um resolvedor escolhe o agente (setting → detecção → último usado).

**Tech Stack:** TypeScript (CommonJS, esbuild), VS Code API ^1.98, vitest ^1.6 (igual ao `installer/`, evita duplicar versões no workspace), Node 18+ no extension host (`fetch` nativo).

**Spec:** [`docs/superpowers/specs/2026-10-15-vscode-multi-agent-design.md`](../specs/2026-10-15-vscode-multi-agent-design.md). Depende de `portable.json` (plano [`2026-10-15-portable-delivery.md`](2026-10-15-portable-delivery.md), Task 1).

## Global Constraints

- Branch `feature/v4.0-multi-agente`. Commits em pt-BR `tipo(escopo): descrição`, terminando com a linha `Co-Authored-By` do modelo que fez o commit. **Push só com confirmação. Nada de `vsce publish`/`npm publish`** (política do mantenedor: publicar só quando tudo estiver pronto).
- Código em `packages/vscode/src` fica **ASCII** salvo literais de texto para o usuário em português; ferramentas de edição convertem `\uXXXX` em caracteres: confira com `perl -ne 'print "$ARGV:$.\n" if /[^\x00-\x7F]/' <arquivo>`.
- Testes nunca tocam rede, `gh`, navegador, área de transferência nem o home real: tudo por `AdapterDeps` falsas.
- O módulo `vscode` só é importado por `deps.ts`, `services.ts`, `commands/*`, `views/*`, `context/*`, `extension.ts`. Adaptadores, resolvedor e `presence` **não** importam `vscode`.
- Registro: id VS Code = `delphi-dev.` + camelCase do id (`new-project` → `newProject`).
- Texto entregue: Claude `/<id> [@arquivo]`, Codex `$delphi-cmd-<id> [@arquivo]`, OpenCode `/delphi-<id> [@arquivo]`.
- Comportamento do Claude Code igual ao da versão atual do `claudeCodeBridge.ts` (mesmo `executeCommand`, mesma URI de reserva).
- Versão da extensão: **3.0.0**.

## Review Focus

1. **Nunca fingir envio:** onde não há prompt programático (Codex sem URI; OpenCode sem servidor) o resultado é `copied`, e sem a extensão/CLI é `unavailable` com oferta de instalação. (Tasks 3, 4)
2. **OpenCode:** o comando `opencode --port …` nunca é digitado dentro de um terminal que já existe e pode estar rodando a TUI. (Task 4)
3. **Claude Code:** regressão zero em relação ao `claudeCodeBridge.ts` atual. (Task 2)
4. **`package.json` em sincronia:** o teste falha se `contributes.commands` divergir do registro, e todo comando de menu existe. (Task 1)
5. **Vários agentes instalados:** pergunta uma vez e lembra; não pergunta a cada clique. (Task 5)

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `packages/vscode/scripts/sync-registry.mjs` | `portable.json` → `src/generated/registry.json` + `contributes.commands` |
| `packages/vscode/src/generated/registry.json` | Cópia commitada do registro |
| `packages/vscode/src/registry.ts` | Tipos, `vscodeCommandId`, `pickLocale` |
| `packages/vscode/src/agents/types.ts` | `AgentId`, `AdapterDeps`, `AgentAdapter`, `say` |
| `packages/vscode/src/agents/deps.ts` | `realDeps()` sobre a API do VS Code |
| `packages/vscode/src/agents/{claude,codex,opencode}.ts` | Os três adaptadores |
| `packages/vscode/src/agents/resolve.ts` | Escolha do agente |
| `packages/vscode/src/agents/presence.ts` | "O plugin está instalado para este agente?" |
| `packages/vscode/src/commands/runCommand.ts` | Orquestra um comando |
| `packages/vscode/src/agents/services.ts` | Liga tudo ao VS Code |
| `packages/vscode/test/**` | vitest + dublê do `vscode` |
| `.github/workflows/publish-vscode.yml` | Publicação corrigida |

---

### Task 1: Infra de testes, registro copiado e `package.json` gerado

**Files:**
- Create: `packages/vscode/vitest.config.ts`, `packages/vscode/test/mocks/vscode.ts`, `packages/vscode/scripts/sync-registry.mjs`, `packages/vscode/src/registry.ts`, `packages/vscode/src/generated/registry.json` (gerado), `packages/vscode/test/sync-registry.test.ts`, `packages/vscode/test/registry.test.ts`
- Modify: `packages/vscode/package.json`

**Interfaces:**
- Produces:
  - `scripts/sync-registry.mjs`: `camelId(id)`, `commandId(id)`, `buildCommands(registry)`, `computeOutputs(registry, pkg)`, CLI `--write|--check`
  - `src/registry.ts`: `type Locale`, `interface RegistryCommand`, `interface Registry`, `registry: Registry`, `vscodeCommandId(id)`, `pickLocale(language)`

- [ ] **Step 1: Dependência e scripts**

Em `packages/vscode/package.json`: acrescente em `devDependencies` `"vitest": "^1.6.0"` e em `scripts`:

```json
    "test": "vitest run",
    "sync": "node scripts/sync-registry.mjs --write",
    "check:registry": "node scripts/sync-registry.mjs --check"
```

Run: `cd packages/vscode && npm install`
Expected: instala sem erro (cria `node_modules/`, ignorado pelo git).

- [ ] **Step 2: Configuração do vitest e dublê do `vscode`**

`packages/vscode/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import * as path from 'node:path';

export default defineConfig({
  resolve: { alias: { vscode: path.resolve(__dirname, 'test/mocks/vscode.ts') } },
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
```

`packages/vscode/test/mocks/vscode.ts`:

```ts
// Minimal stand-in for the `vscode` module, only what the unit-tested modules touch.
export class ThemeIcon {
  constructor(public id: string) {}
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  description?: string;
  iconPath?: unknown;
  command?: { command: string; title: string };
  tooltip?: string;
  constructor(public label: string, public collapsibleState?: TreeItemCollapsibleState) {}
}

export const env = { language: 'en' };
export const window = {};
export const workspace = {};
export const commands = {};
export const extensions = {};
```

- [ ] **Step 3: Testes (vermelho)**

`packages/vscode/test/sync-registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
// @ts-expect-error plain ESM script without types
import { buildCommands, camelId, commandId, computeOutputs } from '../scripts/sync-registry.mjs';

const pkgDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(pkgDir, '..', '..');
const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'portable.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));

describe('sync-registry', () => {
  it('derives camelCase VS Code ids', () => {
    expect(camelId('new-project')).toBe('newProject');
    expect(camelId('contribute-kb')).toBe('contributeKb');
    expect(camelId('e2e')).toBe('e2e');
    expect(commandId('audit')).toBe('delphi-dev.audit');
  });

  it('builds one command per registry entry plus the extension-only ones', () => {
    const commands = buildCommands(registry) as { command: string; title: string; icon: string }[];
    expect(commands).toHaveLength(registry.commands.length + 2);
    expect(commands.find((c) => c.command === 'delphi-dev.audit')).toEqual({
      command: 'delphi-dev.audit', title: 'Delphi Dev: Audit project', icon: '$(checklist)',
    });
    expect(commands.map((c) => c.command)).toContain('delphi-dev.createClaudeignore');
    expect(commands.map((c) => c.command)).toContain('delphi-dev.chooseAgent');
  });

  it('the committed registry.json and package.json are in sync with portable.json', () => {
    const out = computeOutputs(registry, pkg);
    expect(fs.readFileSync(path.join(pkgDir, 'src', 'generated', 'registry.json'), 'utf8')).toBe(out.registryText);
    expect(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).toBe(out.pkgText);
  });

  it('every command used by a menu or a welcome view exists in contributes.commands', () => {
    const declared = new Set(pkg.contributes.commands.map((c: { command: string }) => c.command));
    const used: string[] = [];
    for (const group of Object.values(pkg.contributes.menus) as { command: string }[][]) {
      for (const item of group) used.push(item.command);
    }
    for (const w of pkg.contributes.viewsWelcome ?? []) {
      for (const m of String(w.contents).matchAll(/command:([A-Za-z0-9_.-]+)/g)) used.push(m[1]);
    }
    expect(used.length).toBeGreaterThan(0);
    for (const c of used) expect(declared.has(c), c).toBe(true);
  });
});
```

`packages/vscode/test/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pickLocale, registry, vscodeCommandId } from '../src/registry';

describe('registry', () => {
  it('has the 11 plugin commands with both languages', () => {
    expect(registry.commands).toHaveLength(11);
    for (const c of registry.commands) {
      expect(c.title['pt-BR']).not.toBe('');
      expect(c.title['en-US']).not.toBe('');
    }
  });

  it('maps ids and locales', () => {
    expect(vscodeCommandId('new-project')).toBe('delphi-dev.newProject');
    expect(pickLocale('pt-br')).toBe('pt-BR');
    expect(pickLocale('pt')).toBe('pt-BR');
    expect(pickLocale('en')).toBe('en-US');
    expect(pickLocale('de')).toBe('en-US');
  });
});
```

Run: `cd packages/vscode && npx vitest run`
Expected: FAIL (script e `src/registry` ainda não existem).

- [ ] **Step 4: Implementar o script e o módulo**

`packages/vscode/scripts/sync-registry.mjs`:

```js
#!/usr/bin/env node
// Keeps the extension in step with the plugin's portable.json:
//   src/generated/registry.json  <- copy of portable.json
//   package.json contributes.commands <- one command per registry entry + extension-only commands
//   node scripts/sync-registry.mjs --write | --check
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.resolve(here, '..');
const REGISTRY_SRC = path.resolve(pkgDir, '..', '..', 'portable.json');
const REGISTRY_OUT = path.join(pkgDir, 'src', 'generated', 'registry.json');
const PKG = path.join(pkgDir, 'package.json');

const EXTRA_COMMANDS = [
  { command: 'delphi-dev.createClaudeignore', title: 'Delphi Dev: Create .claudeignore', icon: '$(file-add)' },
  { command: 'delphi-dev.chooseAgent', title: 'Delphi Dev: Choose Agent', icon: '$(account)' },
];

export function camelId(id) {
  return id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

export function commandId(id) {
  return `delphi-dev.${camelId(id)}`;
}

export function buildCommands(registry) {
  return [
    ...registry.commands.map((c) => ({
      command: commandId(c.id),
      title: `Delphi Dev: ${c.title['en-US']}`,
      icon: `$(${c.icon})`,
    })),
    ...EXTRA_COMMANDS,
  ];
}

export function computeOutputs(registry, pkg) {
  const next = { ...pkg, contributes: { ...pkg.contributes, commands: buildCommands(registry) } };
  return {
    registryText: `${JSON.stringify(registry, null, 2)}\n`,
    pkgText: `${JSON.stringify(next, null, 2)}\n`,
  };
}

function main() {
  const mode = process.argv.includes('--check') ? 'check' : process.argv.includes('--write') ? 'write' : null;
  if (!mode) {
    console.error('usage: sync-registry.mjs --write | --check');
    process.exit(64);
  }
  const registry = JSON.parse(fs.readFileSync(REGISTRY_SRC, 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
  const out = computeOutputs(registry, pkg);
  if (mode === 'write') {
    fs.mkdirSync(path.dirname(REGISTRY_OUT), { recursive: true });
    fs.writeFileSync(REGISTRY_OUT, out.registryText);
    fs.writeFileSync(PKG, out.pkgText);
    console.log('registry.json and package.json updated');
    return;
  }
  const stale = [];
  if (!fs.existsSync(REGISTRY_OUT) || fs.readFileSync(REGISTRY_OUT, 'utf8') !== out.registryText) stale.push('src/generated/registry.json');
  if (fs.readFileSync(PKG, 'utf8') !== out.pkgText) stale.push('package.json');
  if (stale.length) {
    console.error(`out of sync with portable.json: ${stale.join(', ')} (run npm run sync)`);
    process.exit(1);
  }
  console.log('registry in sync');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
```

`packages/vscode/src/registry.ts`:

```ts
import data from './generated/registry.json';

export type Locale = 'pt-BR' | 'en-US';

export interface RegistryCommand {
  id: string;
  title: Record<Locale, string>;
  description: Record<Locale, string>;
  takesFile: boolean;
  icon: string;
}

export interface Registry {
  schema: 1;
  skills: Record<string, { targets?: string[] }>;
  commands: RegistryCommand[];
}

export const registry = data as unknown as Registry;

export function vscodeCommandId(id: string): string {
  return `delphi-dev.${id.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase())}`;
}

export function pickLocale(language: string): Locale {
  return language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en-US';
}
```

- [ ] **Step 5: Gerar e rodar**

Run: `cd packages/vscode && npm run sync && npx vitest run && npx tsc --noEmit`
Expected: `registry.json and package.json updated`; vitest PASS; `tsc` sem erro. Confira `git diff packages/vscode/package.json`: `contributes.commands` agora tem 13 entradas (11 do registro + `createClaudeignore` + `chooseAgent`), sem `build`/`refactor`/`migrate`. **O teste de menus pode falhar** se o `editor/context` citar um comando que saiu: nesse caso remova do menu o que não existe mais (a lista de menus só usa `review`, `audit`, `write`, `tdd`, `spec`, que existem).

- [ ] **Step 6: Commit**

```bash
git add packages/vscode/package.json packages/vscode/vitest.config.ts packages/vscode/test packages/vscode/scripts packages/vscode/src/registry.ts packages/vscode/src/generated
git commit -m "feat(vscode): registro de comandos copiado do plugin e package.json gerado, com testes"
```

---

### Task 2: Contrato dos adaptadores, dependências reais e adaptador do Claude Code

**Files:**
- Create: `packages/vscode/src/agents/types.ts`, `packages/vscode/src/agents/deps.ts`, `packages/vscode/src/agents/claude.ts`, `packages/vscode/test/helpers.ts`, `packages/vscode/test/claude.test.ts`

**Interfaces:**
- Produces: `AgentId`, `DeliveryResult`, `TerminalLike`, `FetchResult`, `AdapterDeps`, `AgentAdapter`, `say(d, pt, en)`, `realDeps()`, `createClaudeAdapter(d)`, e (testes) `fakeDeps(over?)`, `cmd(id, takesFile?)`

- [ ] **Step 1: Escrever o helper e o teste**

`packages/vscode/test/helpers.ts`:

```ts
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
```

`packages/vscode/test/claude.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createClaudeAdapter } from '../src/agents/claude';
import { cmd, fakeDeps } from './helpers';

describe('claude adapter', () => {
  it('builds /<id> with an optional file argument', () => {
    const a = createClaudeAdapter(fakeDeps());
    expect(a.invocation(cmd('audit'))).toBe('/audit');
    expect(a.invocation(cmd('review', true), '@src/U.pas:10-20')).toBe('/review @src/U.pas:10-20');
    expect(a.id).toBe('claude');
  });

  it('reports installed from the extension id', () => {
    expect(createClaudeAdapter(fakeDeps({ hasExtension: (id) => id === 'anthropic.claude-code' })).isInstalled()).toBe(true);
    expect(createClaudeAdapter(fakeDeps({ hasExtension: () => false })).isInstalled()).toBe(false);
  });

  it('sends through the same command claudeCodeBridge used', async () => {
    const d = fakeDeps();
    expect(await createClaudeAdapter(d).send('/audit')).toBe('sent');
    expect(d.calls).toEqual(['exec:claude-vscode.primaryEditor.open:[null,"/audit"]']);
  });

  it('falls back to the URI handler when the command throws', async () => {
    const d = fakeDeps({
      executeCommand: async () => {
        throw new Error('no such command');
      },
    });
    expect(await createClaudeAdapter(d).send('/review @a b.pas')).toBe('sent');
    expect(d.calls).toEqual([`open:vscode://anthropic.claude-code/open?prompt=${encodeURIComponent('/review @a b.pas')}`]);
  });

  it('offers to install the extension when nothing opens, and never says it sent', async () => {
    const executed: unknown[][] = [];
    const d = fakeDeps({
      executeCommand: async (command, ...args) => {
        if (command === 'claude-vscode.primaryEditor.open') throw new Error('missing');
        executed.push([command, ...args]);
        return undefined;
      },
      openExternal: async () => false,
      showError: async () => 'Instalar Claude Code',
    });
    expect(await createClaudeAdapter(d).send('/audit')).toBe('unavailable');
    expect(executed).toEqual([['workbench.extensions.installExtension', 'anthropic.claude-code']]);
  });
});
```

Run: `cd packages/vscode && npx vitest run test/claude.test.ts`
Expected: FAIL com "Failed to resolve import ../src/agents/claude".

- [ ] **Step 2: Implementar**

`packages/vscode/src/agents/types.ts`:

```ts
import type { RegistryCommand } from '../registry';

export type AgentId = 'claude' | 'codex' | 'opencode';
export type DeliveryResult = 'sent' | 'prefilled' | 'copied' | 'unavailable';

export interface TerminalLike {
  sendText(text: string, addNewLine?: boolean): void;
  show(preserveFocus?: boolean): void;
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
```

`packages/vscode/src/agents/deps.ts`:

```ts
import { spawnSync } from 'node:child_process';
import * as vscode from 'vscode';
import type { AdapterDeps } from './types';

export function realDeps(): AdapterDeps {
  return {
    executeCommand: (command, ...args) => vscode.commands.executeCommand(command, ...args),
    openExternal: (uri) => vscode.env.openExternal(vscode.Uri.parse(uri)),
    writeClipboard: (text) => vscode.env.clipboard.writeText(text),
    showInfo: (message, ...actions) => vscode.window.showInformationMessage(message, ...actions),
    showError: (message, ...actions) => vscode.window.showErrorMessage(message, ...actions),
    hasExtension: (id) => vscode.extensions.getExtension(id) !== undefined,
    commandExists: (cmd) => {
      try {
        const r = spawnSync(cmd, ['--version'], { shell: process.platform === 'win32', timeout: 4000, windowsHide: true });
        return r.status === 0;
      } catch {
        return false;
      }
    },
    getSetting: <T>(key: string, fallback: T): T => vscode.workspace.getConfiguration('delphiDev').get<T>(key, fallback),
    fetch: async (url, init) => {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(2500) });
      return { ok: r.ok, status: r.status };
    },
    createTerminal: ({ name, cwd }) => vscode.window.createTerminal({ name, cwd }),
    findTerminal: (name) => vscode.window.terminals.find((t) => t.name === name),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    workspaceCwd: () => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    isPortuguese: () => vscode.env.language.toLowerCase().startsWith('pt'),
  };
}
```

`packages/vscode/src/agents/claude.ts`:

```ts
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
```

- [ ] **Step 3: Rodar e ver passar**

Run: `cd packages/vscode && npx vitest run && npx tsc --noEmit`
Expected: PASS. (O teste do fallback instalável usa `'Instalar Claude Code'` porque `fakeDeps` tem `isPortuguese: () => true`.)

- [ ] **Step 4: Commit**

```bash
git add packages/vscode/src/agents packages/vscode/test
git commit -m "feat(vscode): contrato dos adaptadores, dependencias reais e adaptador do Claude Code"
```

---

### Task 3: Adaptador do Codex

**Files:**
- Create: `packages/vscode/src/agents/codex.ts`, `packages/vscode/test/codex.test.ts`

**Interfaces:**
- Consumes: `AdapterDeps`, `say`
- Produces: `createCodexAdapter(d): AgentAdapter`

- [ ] **Step 1: Escrever o teste**

`packages/vscode/test/codex.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createCodexAdapter } from '../src/agents/codex';
import { cmd, fakeDeps } from './helpers';

describe('codex adapter', () => {
  it('builds $delphi-cmd-<id> with an optional file argument', () => {
    const a = createCodexAdapter(fakeDeps());
    expect(a.invocation(cmd('audit'))).toBe('$delphi-cmd-audit');
    expect(a.invocation(cmd('new-project'))).toBe('$delphi-cmd-new-project');
    expect(a.invocation(cmd('review', true), '@U.pas')).toBe('$delphi-cmd-review @U.pas');
  });

  it('is installed when the openai.chatgpt extension exists', () => {
    expect(createCodexAdapter(fakeDeps({ hasExtension: (id) => id === 'openai.chatgpt' })).isInstalled()).toBe(true);
    expect(createCodexAdapter(fakeDeps({ hasExtension: () => false })).isInstalled()).toBe(false);
  });

  it('opens the panel, copies the command and says so (it cannot send)', async () => {
    const d = fakeDeps();
    expect(await createCodexAdapter(d).send('$delphi-cmd-audit')).toBe('copied');
    expect(d.calls).toEqual(['exec:chatgpt.openSidebar']);
    expect(d.clipboard).toEqual(['$delphi-cmd-audit']);
    expect(d.infos[0]).toContain('$delphi-cmd-audit');
  });

  it('falls back to a new panel when the sidebar command is missing', async () => {
    const d = fakeDeps({
      executeCommand: async (command) => {
        if (command === 'chatgpt.openSidebar') throw new Error('missing');
        return undefined;
      },
    });
    expect(await createCodexAdapter(d).send('$delphi-cmd-audit')).toBe('copied');
    expect(d.clipboard).toEqual(['$delphi-cmd-audit']);
  });

  it('still copies when no panel command works', async () => {
    const d = fakeDeps({
      executeCommand: async () => {
        throw new Error('nope');
      },
    });
    expect(await createCodexAdapter(d).send('$delphi-cmd-audit')).toBe('copied');
  });

  it('uses the experimental prompt URI only when the setting is on', async () => {
    const off = fakeDeps();
    await createCodexAdapter(off).send('$delphi-cmd-audit');
    expect(off.calls.some((c) => c.startsWith('open:'))).toBe(false);

    const on = fakeDeps({ getSetting: <T>(key: string, fallback: T) => (key === 'codexPromptUri' ? (true as T) : fallback) });
    expect(await createCodexAdapter(on).send('$delphi-cmd-audit')).toBe('prefilled');
    expect(on.calls).toEqual([`open:vscode://openai.chatgpt/?prompt=${encodeURIComponent('$delphi-cmd-audit')}`]);
    expect(on.clipboard).toEqual([]);
  });

  it('copies anyway when the URI was not opened', async () => {
    const d = fakeDeps({
      getSetting: <T>(key: string, fallback: T) => (key === 'codexPromptUri' ? (true as T) : fallback),
      openExternal: async () => false,
    });
    expect(await createCodexAdapter(d).send('$delphi-cmd-audit')).toBe('copied');
    expect(d.clipboard).toEqual(['$delphi-cmd-audit']);
  });

  it('offers to install the extension and does not pretend to have sent', async () => {
    const executed: unknown[][] = [];
    const d = fakeDeps({
      hasExtension: () => false,
      showError: async () => 'Instalar Codex',
      executeCommand: async (command, ...args) => {
        executed.push([command, ...args]);
        return undefined;
      },
    });
    expect(await createCodexAdapter(d).send('$delphi-cmd-audit')).toBe('unavailable');
    expect(executed).toEqual([['workbench.extensions.installExtension', 'openai.chatgpt']]);
    expect(d.clipboard).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd packages/vscode && npx vitest run test/codex.test.ts`
Expected: FAIL com "Failed to resolve import ../src/agents/codex".

- [ ] **Step 3: Implementar**

`packages/vscode/src/agents/codex.ts`:

```ts
import type { AdapterDeps, AgentAdapter, DeliveryResult } from './types';
import { say } from './types';

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
      await d.showInfo(
        say(d, `Comando copiado: ${text} — cole no Codex e tecle Enter.`, `Command copied: ${text} — paste it into Codex and press Enter.`),
      );
      return 'copied';
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd packages/vscode && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/vscode/src/agents/codex.ts packages/vscode/test/codex.test.ts
git commit -m "feat(vscode): adaptador do Codex (painel + copia; URI experimental atras de flag)"
```

---

### Task 4: Adaptador do OpenCode (servidor HTTP da TUI)

**Files:**
- Create: `packages/vscode/src/agents/opencode.ts`, `packages/vscode/test/opencode.test.ts`

**Interfaces:**
- Produces: `createOpencodeAdapter(d): AgentAdapter`, `OPENCODE_TERMINAL_NAME`

- [ ] **Step 1: Escrever o teste**

`packages/vscode/test/opencode.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createOpencodeAdapter, OPENCODE_TERMINAL_NAME } from '../src/agents/opencode';
import type { FetchResult } from '../src/agents/types';
import { cmd, fakeDeps } from './helpers';

interface Hit { url: string; method?: string; body?: string }

function server(opts: { healthyAfter?: number; appendFailures?: number } = {}) {
  const hits: Hit[] = [];
  let healthChecks = 0;
  let appendFailures = opts.appendFailures ?? 0;
  const fetch = async (url: string, init?: { method?: string; body?: string }): Promise<FetchResult> => {
    hits.push({ url, method: init?.method, body: init?.body });
    if (url.endsWith('/global/health')) {
      healthChecks++;
      const ok = opts.healthyAfter === undefined ? true : healthChecks > opts.healthyAfter;
      return { ok, status: ok ? 200 : 503 };
    }
    if (url.endsWith('/tui/append-prompt') && appendFailures > 0) {
      appendFailures--;
      return { ok: false, status: 400 };
    }
    return { ok: true, status: 200 };
  };
  return { hits, fetch };
}

const posts = (hits: Hit[]) => hits.filter((h) => h.method === 'POST').map((h) => h.url.replace(/^http:\/\/127\.0\.0\.1:\d+/, ''));

describe('opencode adapter', () => {
  it('builds /delphi-<id> with an optional file argument', () => {
    const a = createOpencodeAdapter(fakeDeps());
    expect(a.invocation(cmd('audit'))).toBe('/delphi-audit');
    expect(a.invocation(cmd('tdd', true), '@U.pas')).toBe('/delphi-tdd @U.pas');
  });

  it('is installed when the extension or the CLI exists', () => {
    expect(createOpencodeAdapter(fakeDeps({ hasExtension: () => true, commandExists: () => false })).isInstalled()).toBe(true);
    expect(createOpencodeAdapter(fakeDeps({ hasExtension: () => false, commandExists: () => true })).isInstalled()).toBe(true);
    expect(createOpencodeAdapter(fakeDeps({ hasExtension: () => false, commandExists: () => false })).isInstalled()).toBe(false);
  });

  it('reuses a server that is already up: append, submit, no terminal', async () => {
    const s = server();
    const d = fakeDeps({ fetch: s.fetch });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('sent');
    expect(posts(s.hits)).toEqual(['/tui/append-prompt', '/tui/submit-prompt']);
    expect(JSON.parse(s.hits.find((h) => h.url.endsWith('/tui/append-prompt'))!.body!)).toEqual({ text: '/delphi-audit' });
    expect(d.terminals).toEqual([]);
  });

  it('starts its own terminal on the configured port and waits for the server', async () => {
    const s = server({ healthyAfter: 3 });
    const d = fakeDeps({
      fetch: s.fetch,
      getSetting: <T>(key: string, fallback: T) => (key === 'opencodePort' ? (4321 as T) : fallback),
    });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('sent');
    expect(d.terminals).toHaveLength(1);
    expect(d.terminals[0].name).toBe(OPENCODE_TERMINAL_NAME);
    expect(d.terminals[0].sent).toEqual([{ text: 'opencode --port 4321', newline: true }]);
    expect(s.hits[0].url).toBe('http://127.0.0.1:4321/global/health');
    expect(posts(s.hits)).toEqual(['/tui/append-prompt', '/tui/submit-prompt']);
  });

  it('retries the append until the TUI is attached', async () => {
    const s = server({ appendFailures: 2 });
    const d = fakeDeps({ fetch: s.fetch });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('sent');
    expect(posts(s.hits).filter((p) => p === '/tui/append-prompt')).toHaveLength(3);
  });

  it('falls back to the clipboard when the server never comes up', async () => {
    const s = server({ healthyAfter: 1_000_000 });
    const d = fakeDeps({ fetch: s.fetch });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('copied');
    expect(d.clipboard).toEqual(['/delphi-audit']);
    expect(d.terminals[0].shown).toBeGreaterThan(0);
    expect(posts(s.hits)).toEqual([]);
  });

  it('falls back to the clipboard when the TUI never accepts the prompt', async () => {
    const s = server({ appendFailures: 1_000 });
    const d = fakeDeps({ fetch: s.fetch });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('copied');
    expect(d.clipboard).toEqual(['/delphi-audit']);
  });

  it('never types the opencode command into a terminal that already exists', async () => {
    const sent: string[] = [];
    const existing = { sendText: (t: string) => sent.push(t), show: () => undefined };
    const s = server({ healthyAfter: 1_000_000 });
    const d = fakeDeps({ fetch: s.fetch, findTerminal: () => existing });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('copied');
    expect(sent).toEqual([]);
    expect(d.terminals).toEqual([]);
  });

  it('survives a network error on health', async () => {
    const d = fakeDeps({
      fetch: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    expect(await createOpencodeAdapter(d).send('/delphi-audit')).toBe('copied');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd packages/vscode && npx vitest run test/opencode.test.ts`
Expected: FAIL com "Failed to resolve import ../src/agents/opencode".

- [ ] **Step 3: Implementar**

`packages/vscode/src/agents/opencode.ts`:

```ts
import type { AdapterDeps, AgentAdapter, DeliveryResult } from './types';
import { say } from './types';

export const OPENCODE_TERMINAL_NAME = 'OpenCode - Delphi Dev';
const HEALTH_ATTEMPTS = 40;
const HEALTH_INTERVAL_MS = 500;
const APPEND_ATTEMPTS = 5;

export function createOpencodeAdapter(d: AdapterDeps): AgentAdapter {
  const port = (): number => d.getSetting<number>('opencodePort', 4096);
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

  async function deliver(text: string): Promise<boolean> {
    for (let attempt = 0; attempt < APPEND_ATTEMPTS; attempt++) {
      if ((await post('/tui/append-prompt', { text })) && (await post('/tui/submit-prompt', {}))) return true;
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

  return {
    id: 'opencode',
    label: 'OpenCode',
    isInstalled: () => d.hasExtension('sst-dev.opencode') || d.commandExists('opencode'),
    invocation: (command, arg) => `/delphi-${command.id}${arg ? ` ${arg}` : ''}`,
    async send(text): Promise<DeliveryResult> {
      if (await healthy()) {
        if (await deliver(text)) return 'sent';
        return copyFallback(text);
      }

      let terminal = d.findTerminal(OPENCODE_TERMINAL_NAME);
      if (!terminal) {
        terminal = d.createTerminal({ name: OPENCODE_TERMINAL_NAME, cwd: d.workspaceCwd() });
        terminal.show(true);
        // Only a terminal we just created is safe to type into: an older one may already be running the TUI.
        terminal.sendText(`opencode --port ${port()}`, true);
      } else {
        terminal.show(true);
      }

      if (await waitHealthy()) {
        if (await deliver(text)) return 'sent';
      }
      return copyFallback(text);
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd packages/vscode && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/vscode/src/agents/opencode.ts packages/vscode/test/opencode.test.ts
git commit -m "feat(vscode): adaptador do OpenCode pela API HTTP da TUI, com terminal proprio e reserva"
```

---

### Task 5: Resolução do agente, presença do plugin e orquestração do comando

**Files:**
- Create: `packages/vscode/src/agents/resolve.ts`, `packages/vscode/src/agents/presence.ts`, `packages/vscode/src/commands/runCommand.ts`, `packages/vscode/test/resolve.test.ts`, `packages/vscode/test/presence.test.ts`, `packages/vscode/test/runCommand.test.ts`

**Interfaces:**
- Produces:
  - `resolveAgent(i: ResolveInput): Promise<AgentId | undefined>`
  - `pluginPresent(agent, home, env, exists, project?): boolean | undefined`, `installCommandFor(agent): string`
  - `interface RunServices`, `runCommand(cmd, s): Promise<DeliveryResult | 'no-agent'>`

- [ ] **Step 1: Escrever os testes**

`packages/vscode/test/resolve.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveAgent } from '../src/agents/resolve';
import type { AgentId } from '../src/agents/types';

const never = async (): Promise<AgentId | undefined> => {
  throw new Error('should not ask');
};

describe('resolveAgent', () => {
  it('honors an explicit setting without asking', async () => {
    expect(await resolveAgent({ setting: 'codex', installed: ['claude'], last: undefined, pick: never })).toBe('codex');
  });

  it('uses the only installed agent', async () => {
    expect(await resolveAgent({ setting: 'auto', installed: ['opencode'], last: undefined, pick: never })).toBe('opencode');
  });

  it('returns undefined when nothing is installed', async () => {
    expect(await resolveAgent({ setting: 'auto', installed: [], last: 'claude', pick: never })).toBeUndefined();
  });

  it('reuses the last agent when it is still installed (no question)', async () => {
    expect(await resolveAgent({ setting: 'auto', installed: ['claude', 'codex'], last: 'codex', pick: never })).toBe('codex');
  });

  it('asks once when several are installed and there is no usable last', async () => {
    const asked: AgentId[][] = [];
    const out = await resolveAgent({
      setting: 'auto', installed: ['claude', 'codex'], last: 'opencode',
      pick: async (options) => {
        asked.push(options);
        return 'claude';
      },
    });
    expect(out).toBe('claude');
    expect(asked).toEqual([['claude', 'codex']]);
  });

  it('returns undefined when the user dismisses the question', async () => {
    expect(await resolveAgent({ setting: 'auto', installed: ['claude', 'codex'], last: undefined, pick: async () => undefined })).toBeUndefined();
  });
});
```

`packages/vscode/test/presence.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { installCommandFor, pluginPresent } from '../src/agents/presence';

const present = (...paths: string[]) => (p: string) => paths.map((x) => path.normalize(x)).includes(path.normalize(p));
const home = path.join('/h', 'u');

describe('pluginPresent', () => {
  it('cannot tell for Claude Code (marketplace install)', () => {
    expect(pluginPresent('claude', home, {}, () => false)).toBeUndefined();
  });

  it('finds the Codex command skill in the user folder or in the project', () => {
    const user = path.join(home, '.agents', 'skills', 'delphi-cmd-audit', 'SKILL.md');
    expect(pluginPresent('codex', home, {}, present(user))).toBe(true);
    expect(pluginPresent('codex', home, {}, present())).toBe(false);
    const proj = path.join('/p', '.agents', 'skills', 'delphi-cmd-audit', 'SKILL.md');
    expect(pluginPresent('codex', home, {}, present(proj), '/p')).toBe(true);
  });

  it('finds the OpenCode command in the config folder, honoring XDG_CONFIG_HOME', () => {
    const def = path.join(home, '.config', 'opencode', 'commands', 'delphi-audit.md');
    expect(pluginPresent('opencode', home, {}, present(def))).toBe(true);
    const xdg = path.join('/x', 'opencode', 'commands', 'delphi-audit.md');
    expect(pluginPresent('opencode', home, { XDG_CONFIG_HOME: '/x' }, present(xdg))).toBe(true);
    expect(pluginPresent('opencode', home, {}, present())).toBe(false);
  });

  it('suggests the installer command', () => {
    expect(installCommandFor('codex')).toBe('npx delphi-dev --target codex');
    expect(installCommandFor('opencode')).toBe('npx delphi-dev --target opencode');
  });
});
```

`packages/vscode/test/runCommand.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { runCommand, type RunServices } from '../src/commands/runCommand';
import type { AgentAdapter, AgentId } from '../src/agents/types';
import { cmd } from './helpers';

function adapter(id: AgentId, log: string[]): AgentAdapter {
  const prefix: Record<AgentId, string> = { claude: '/', codex: '$delphi-cmd-', opencode: '/delphi-' };
  return {
    id, label: id, isInstalled: () => true,
    invocation: (c, arg) => `${prefix[id]}${c.id}${arg ? ` ${arg}` : ''}`,
    async send(text) {
      log.push(`send:${id}:${text}`);
      return 'sent';
    },
  };
}

function services(over: Partial<RunServices> = {}, log: string[] = []): RunServices {
  return {
    adapters: { claude: adapter('claude', log), codex: adapter('codex', log), opencode: adapter('opencode', log) },
    resolve: async () => 'claude',
    fileRef: () => '@src/U.pas:3-9',
    pluginPresent: () => true,
    remember: (a) => log.push(`remember:${a}`),
    notifyMissingPlugin: async (a) => {
      log.push(`missing:${a}`);
    },
    notifyNoAgent: async () => {
      log.push('no-agent');
    },
    ...over,
  };
}

describe('runCommand', () => {
  it('sends the invocation of the resolved agent', async () => {
    const log: string[] = [];
    expect(await runCommand(cmd('audit'), services({ resolve: async () => 'codex' }, log))).toBe('sent');
    expect(log).toEqual(['remember:codex', 'send:codex:$delphi-cmd-audit']);
  });

  it('appends the file reference only for commands that take a file', async () => {
    const log: string[] = [];
    await runCommand(cmd('review', true), services({}, log));
    await runCommand(cmd('audit', false), services({}, log));
    expect(log.filter((l) => l.startsWith('send:'))).toEqual(['send:claude:/review @src/U.pas:3-9', 'send:claude:/audit']);
  });

  it('warns about a missing plugin but still sends', async () => {
    const log: string[] = [];
    await runCommand(cmd('audit'), services({ resolve: async () => 'opencode', pluginPresent: () => false }, log));
    expect(log).toEqual(['remember:opencode', 'missing:opencode', 'send:opencode:/delphi-audit']);
  });

  it('does not warn when presence is unknown', async () => {
    const log: string[] = [];
    await runCommand(cmd('audit'), services({ pluginPresent: () => undefined }, log));
    expect(log.some((l) => l.startsWith('missing:'))).toBe(false);
  });

  it('tells the user when no agent can be resolved', async () => {
    const log: string[] = [];
    expect(await runCommand(cmd('audit'), services({ resolve: async () => undefined }, log))).toBe('no-agent');
    expect(log).toEqual(['no-agent']);
  });
});
```

Run: `cd packages/vscode && npx vitest run test/resolve.test.ts test/presence.test.ts test/runCommand.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 2: Implementar**

`packages/vscode/src/agents/resolve.ts`:

```ts
import type { AgentId } from './types';

export interface ResolveInput {
  setting: 'auto' | AgentId;
  installed: AgentId[];
  last: AgentId | undefined;
  pick(options: AgentId[]): Promise<AgentId | undefined>;
}

export async function resolveAgent(i: ResolveInput): Promise<AgentId | undefined> {
  if (i.setting !== 'auto') return i.setting;
  if (i.installed.length === 0) return undefined;
  if (i.installed.length === 1) return i.installed[0];
  if (i.last && i.installed.includes(i.last)) return i.last;
  return i.pick(i.installed);
}
```

`packages/vscode/src/agents/presence.ts`:

```ts
import * as path from 'node:path';
import type { AgentId } from './types';

/** true/false when we can tell whether the plugin is installed for the agent; undefined when we cannot. */
export function pluginPresent(
  agent: AgentId,
  home: string,
  env: NodeJS.ProcessEnv,
  exists: (p: string) => boolean,
  project?: string,
): boolean | undefined {
  if (agent === 'claude') return undefined;
  if (agent === 'codex') {
    const candidates = [path.join(home, '.agents', 'skills', 'delphi-cmd-audit', 'SKILL.md')];
    if (project) candidates.push(path.join(project, '.agents', 'skills', 'delphi-cmd-audit', 'SKILL.md'));
    return candidates.some(exists);
  }
  const config = path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'opencode', 'commands', 'delphi-audit.md');
  const candidates = [config];
  if (project) candidates.push(path.join(project, '.opencode', 'commands', 'delphi-audit.md'));
  return candidates.some(exists);
}

export function installCommandFor(agent: AgentId): string {
  return `npx delphi-dev --target ${agent}`;
}
```

`packages/vscode/src/commands/runCommand.ts`:

```ts
import type { AgentAdapter, AgentId, DeliveryResult } from '../agents/types';
import type { RegistryCommand } from '../registry';

export interface RunServices {
  adapters: Record<AgentId, AgentAdapter>;
  resolve(): Promise<AgentId | undefined>;
  /** `@path[:range]` of the active editor, or undefined when there is no file. */
  fileRef(): string | undefined;
  pluginPresent(agent: AgentId): boolean | undefined;
  remember(agent: AgentId): void;
  notifyMissingPlugin(agent: AgentId): Promise<void>;
  notifyNoAgent(): Promise<void>;
}

export async function runCommand(command: RegistryCommand, s: RunServices): Promise<DeliveryResult | 'no-agent'> {
  const id = await s.resolve();
  if (!id) {
    await s.notifyNoAgent();
    return 'no-agent';
  }
  const adapter = s.adapters[id];
  s.remember(id);
  if (s.pluginPresent(id) === false) await s.notifyMissingPlugin(id);
  const arg = command.takesFile ? s.fileRef() : undefined;
  return adapter.send(adapter.invocation(command, arg));
}
```

- [ ] **Step 3: Rodar e ver passar**

Run: `cd packages/vscode && npx vitest run && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/vscode/src/agents/resolve.ts packages/vscode/src/agents/presence.ts packages/vscode/src/commands/runCommand.ts packages/vscode/test
git commit -m "feat(vscode): resolucao do agente, presenca do plugin e orquestracao do comando"
```

---

### Task 6: Ligar ao VS Code (comandos, árvore, status bar, configurações)

**Files:**
- Create: `packages/vscode/src/agents/services.ts`, `packages/vscode/test/commandsProvider.test.ts`
- Modify: `packages/vscode/src/commands/delphiCommands.ts` (reescrita), `packages/vscode/src/views/delphiCommandsProvider.ts` (reescrita), `packages/vscode/src/context/statusBar.ts`, `packages/vscode/src/extension.ts`, `packages/vscode/src/constants.ts`, `packages/vscode/package.json`
- Delete: `packages/vscode/src/commands/claudeCodeBridge.ts`

**Interfaces:**
- Consumes: Tasks 1–5
- Produces: `createServices(context): { run: RunServices; adapters; installedAgents(): AgentId[]; chooseAgent(): Promise<AgentId|undefined>; current(): Promise<AgentId|undefined> }`, `DelphiCommandsProvider(locale?)`, `setStatusAgent(label)`

- [ ] **Step 1: Teste da árvore (vermelho)**

`packages/vscode/test/commandsProvider.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DelphiCommandsProvider } from '../src/views/delphiCommandsProvider';
import { registry, vscodeCommandId } from '../src/registry';

describe('DelphiCommandsProvider', () => {
  it('lists every registry command with its localized label and VS Code command', async () => {
    const items = await new DelphiCommandsProvider('pt-BR').getChildren();
    expect(items).toHaveLength(registry.commands.length);
    const audit = items.find((i) => i.command?.command === 'delphi-dev.audit')!;
    expect(audit.label).toBe('Auditar projeto');
    expect(audit.description).toBe('Laudo técnico completo com score e recomendações');
    const en = await new DelphiCommandsProvider('en-US').getChildren();
    expect(en.find((i) => i.command?.command === vscodeCommandId('new-project'))!.label).toBe('New project');
  });
});
```

Run: `cd packages/vscode && npx vitest run test/commandsProvider.test.ts`
Expected: FAIL (o provider atual tem lista fixa em inglês e não aceita locale).

- [ ] **Step 2: Implementar a árvore e os serviços**

`packages/vscode/src/views/delphiCommandsProvider.ts` (substitui o arquivo inteiro):

```ts
import * as vscode from 'vscode';
import { pickLocale, registry, vscodeCommandId, type Locale, type RegistryCommand } from '../registry';

class DelphiCommandItem extends vscode.TreeItem {
  constructor(entry: RegistryCommand, locale: Locale) {
    super(entry.title[locale], vscode.TreeItemCollapsibleState.None);
    this.description = entry.description[locale];
    this.iconPath = new vscode.ThemeIcon(entry.icon);
    this.command = { command: vscodeCommandId(entry.id), title: entry.title[locale] };
    this.tooltip = entry.description[locale];
  }
}

export class DelphiCommandsProvider implements vscode.TreeDataProvider<DelphiCommandItem> {
  private readonly locale: Locale;

  constructor(locale?: Locale) {
    this.locale = locale ?? pickLocale(vscode.env.language);
  }

  getTreeItem(element: DelphiCommandItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<DelphiCommandItem[]> {
    return Promise.resolve(registry.commands.map((entry) => new DelphiCommandItem(entry, this.locale)));
  }
}
```

`packages/vscode/src/agents/services.ts`:

```ts
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as vscode from 'vscode';
import { getActiveFileContext } from '../utils/fileUtils';
import type { RunServices } from '../commands/runCommand';
import { createClaudeAdapter } from './claude';
import { createCodexAdapter } from './codex';
import { realDeps } from './deps';
import { createOpencodeAdapter } from './opencode';
import { installCommandFor, pluginPresent } from './presence';
import { resolveAgent } from './resolve';
import type { AgentAdapter, AgentId } from './types';

const LAST_AGENT_KEY = 'delphiDev.lastAgent';
const ALL: AgentId[] = ['claude', 'codex', 'opencode'];

export interface Services {
  run: RunServices;
  adapters: Record<AgentId, AgentAdapter>;
  installedAgents(): AgentId[];
  current(): Promise<AgentId | undefined>;
  chooseAgent(): Promise<AgentId | undefined>;
}

export function createServices(context: vscode.ExtensionContext): Services {
  const deps = realDeps();
  const adapters: Record<AgentId, AgentAdapter> = {
    claude: createClaudeAdapter(deps),
    codex: createCodexAdapter(deps),
    opencode: createOpencodeAdapter(deps),
  };
  const pt = deps.isPortuguese();
  const installedAgents = (): AgentId[] => ALL.filter((id) => adapters[id].isInstalled());
  const lastAgent = (): AgentId | undefined => {
    const value = context.globalState.get<string>(LAST_AGENT_KEY);
    return ALL.includes(value as AgentId) ? (value as AgentId) : undefined;
  };

  async function pick(options: AgentId[]): Promise<AgentId | undefined> {
    const choice = await vscode.window.showQuickPick(
      options.map((id) => ({ label: adapters[id].label, id })),
      { placeHolder: pt ? 'Qual agente deve receber os comandos do Delphi Dev?' : 'Which agent should receive Delphi Dev commands?' },
    );
    return choice?.id;
  }

  const setting = (): 'auto' | AgentId => {
    const value = vscode.workspace.getConfiguration('delphiDev').get<string>('agent', 'auto');
    return value === 'claude' || value === 'codex' || value === 'opencode' ? value : 'auto';
  };

  const current = (): Promise<AgentId | undefined> =>
    resolveAgent({ setting: setting(), installed: installedAgents(), last: lastAgent(), pick });

  async function chooseAgent(): Promise<AgentId | undefined> {
    const choice = await pick(ALL);
    if (choice) await context.globalState.update(LAST_AGENT_KEY, choice);
    return choice;
  }

  const run: RunServices = {
    adapters,
    resolve: current,
    fileRef: () => {
      const ctx = getActiveFileContext();
      if (!ctx) return undefined;
      return `@${ctx.filePath}${ctx.lineRange ? `:${ctx.lineRange}` : ''}`;
    },
    pluginPresent: (agent) =>
      pluginPresent(agent, os.homedir(), process.env, (p) => fs.existsSync(p), vscode.workspace.workspaceFolders?.[0]?.uri.fsPath),
    remember: (agent) => {
      void context.globalState.update(LAST_AGENT_KEY, agent);
    },
    notifyMissingPlugin: async (agent) => {
      const command = installCommandFor(agent);
      const copy = pt ? 'Copiar comando' : 'Copy command';
      const choice = await vscode.window.showWarningMessage(
        pt
          ? `O plugin delphi-dev ainda não está instalado para ${adapters[agent].label}. Rode: ${command}`
          : `The delphi-dev plugin is not installed for ${adapters[agent].label} yet. Run: ${command}`,
        copy,
      );
      if (choice === copy) await vscode.env.clipboard.writeText(command);
    },
    notifyNoAgent: async () => {
      await vscode.window.showWarningMessage(
        pt
          ? 'Nenhum agente encontrado (Claude Code, Codex ou OpenCode). Instale um deles e tente de novo.'
          : 'No agent found (Claude Code, Codex or OpenCode). Install one and try again.',
      );
    },
  };

  return { run, adapters, installedAgents, current, chooseAgent };
}
```

`packages/vscode/src/commands/delphiCommands.ts` (substitui o arquivo inteiro):

```ts
import * as vscode from 'vscode';
import { registry, vscodeCommandId } from '../registry';
import type { Services } from '../agents/services';
import { runCommand } from './runCommand';

export function registerCommands(context: vscode.ExtensionContext, services: Services): void {
  for (const command of registry.commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(vscodeCommandId(command.id), () => runCommand(command, services.run)),
    );
  }
  context.subscriptions.push(
    vscode.commands.registerCommand('delphi-dev.chooseAgent', async () => {
      const agent = await services.chooseAgent();
      if (agent) await vscode.commands.executeCommand('delphi-dev.refreshStatus');
    }),
  );
}
```

- [ ] **Step 3: Status bar, extension.ts, constants**

`packages/vscode/src/context/statusBar.ts` (substitui o arquivo inteiro):

```ts
import * as vscode from 'vscode';

let statusBarItem: vscode.StatusBarItem | undefined;
let agentLabel: string | undefined;

function render(): void {
  if (!statusBarItem) return;
  statusBarItem.text = agentLabel ? `$(tools) Delphi Dev · ${agentLabel}` : '$(tools) Delphi Dev';
}

export function createStatusBar(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBarItem.tooltip = 'Delphi Dev - remote control for your AI agent (click to choose the agent)';
  statusBarItem.command = 'delphi-dev.chooseAgent';
  render();
  context.subscriptions.push(statusBarItem);
}

export function setStatusAgent(label: string | undefined): void {
  agentLabel = label;
  render();
}

export function updateStatusBar(visible: boolean): void {
  if (!statusBarItem) return;
  const showStatusBar = vscode.workspace.getConfiguration('delphiDev').get<boolean>('showStatusBar', true);
  if (visible && showStatusBar) statusBarItem.show();
  else statusBarItem.hide();
}
```

(O caractere `·` é um literal de texto da interface; o arquivo é UTF-8.)

`packages/vscode/src/extension.ts` (substitui o arquivo inteiro):

```ts
import * as vscode from 'vscode';
import { createServices } from './agents/services';
import { registerCommands } from './commands/delphiCommands';
import { detectDelphiProject, watchDelphiFiles } from './context/delphiDetector';
import { createStatusBar, setStatusAgent, updateStatusBar } from './context/statusBar';
import { checkAndOfferClaudeignore, registerClaudeignoreCommand } from './features/claudeignore';
import { DelphiCommandsProvider } from './views/delphiCommandsProvider';
import { VIEWS } from './constants';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const services = createServices(context);

  registerCommands(context, services);
  registerClaudeignoreCommand(context);

  vscode.window.createTreeView(VIEWS.COMMANDS_TREE, { treeDataProvider: new DelphiCommandsProvider() });

  createStatusBar(context);
  const refreshAgent = async (): Promise<void> => {
    const installed = services.installedAgents();
    const configured = vscode.workspace.getConfiguration('delphiDev').get<string>('agent', 'auto');
    const id = configured !== 'auto' ? (configured as 'claude' | 'codex' | 'opencode') : installed.length === 1 ? installed[0] : undefined;
    setStatusAgent(id ? services.adapters[id].label : undefined);
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('delphi-dev.refreshStatus', refreshAgent),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('delphiDev.agent')) void refreshAgent();
      if (e.affectsConfiguration('delphiDev.showStatusBar')) detectDelphiProject().then(updateStatusBar);
    }),
  );
  await refreshAgent();

  // The .claudeignore feature only makes sense when Claude Code is the agent in use.
  const offerClaudeignore = (): void => {
    if (services.adapters.claude.isInstalled()) checkAndOfferClaudeignore(context);
  };
  const isDelphi = await detectDelphiProject();
  updateStatusBar(isDelphi);
  if (isDelphi) offerClaudeignore();
  watchDelphiFiles(context, (isDelphiNow) => {
    updateStatusBar(isDelphiNow);
    if (isDelphiNow) offerClaudeignore();
  });
}

export function deactivate(): void {
  // Cleanup handled by disposables in context.subscriptions
}
```

`packages/vscode/src/constants.ts`: remova o objeto `COMMANDS` inteiro (os ids agora vêm do registro) e mantenha `EXTENSION_ID`, `VIEWS`, `CONTEXT_KEYS` e as constantes de extensão/glob. Depois `git rm packages/vscode/src/commands/claudeCodeBridge.ts`.

Confira se algum outro arquivo importava `COMMANDS`: `grep -rn "COMMANDS\b" packages/vscode/src` — o único era `context/statusBar.ts` (já reescrito) e `views/delphiCommandsProvider.ts` (já reescrito). Qualquer outro uso deve passar a usar `vscodeCommandId`.

- [ ] **Step 4: Configurações no `package.json`**

Rode uma vez, da raiz do repo (não commitado):

```bash
node -e '
const fs = require("fs");
const file = "packages/vscode/package.json";
const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
const props = pkg.contributes.configuration.properties;
props["delphiDev.agent"] = {
  type: "string",
  enum: ["auto", "claude", "codex", "opencode"],
  enumDescriptions: [
    "Use the only installed agent, or the last one you used",
    "Claude Code",
    "Codex",
    "OpenCode"
  ],
  default: "auto",
  description: "Which AI agent receives the Delphi Dev commands."
};
props["delphiDev.opencodePort"] = {
  type: "number",
  default: 4096,
  description: "Port used to control OpenCode (opencode --port). A server already listening there is reused."
};
props["delphiDev.codexPromptUri"] = {
  type: "boolean",
  default: false,
  description: "Experimental: try to prefill the Codex composer through vscode://openai.chatgpt/?prompt=. Off = open the panel and copy the command."
};
props["delphiDev.language"].description = "Reserved: language for Delphi Dev prompts (not used yet).";
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
console.log("ok");
'
```

Expected: `ok`. Depois `cd packages/vscode && npm run sync` (precisa continuar sem mudança: `contributes.commands` não foi tocado).

- [ ] **Step 5: Rodar tudo**

Run: `cd packages/vscode && npx vitest run && npx tsc --noEmit && npm run build && npm run check:registry`
Expected: testes PASS, `tsc` limpo, `Build complete.`, `registry in sync`.

- [ ] **Step 6: Commit**

```bash
git add -A packages/vscode
git commit -m "feat(vscode): comandos, arvore, status bar e configuracoes dirigidos pelo registro e pelos adaptadores"
```

---

### Task 7: Publicação corrigida, versão 3.0.0 e documentação da extensão

**Files:**
- Modify: `.github/workflows/publish-vscode.yml` (substitui o arquivo inteiro), `packages/vscode/package.json`, `packages/vscode/CHANGELOG.md`, `packages/vscode/README.md`, `.github/workflows/runtime-check.yml`

- [ ] **Step 1: Workflow**

`.github/workflows/publish-vscode.yml`:

```yaml
name: Publish VS Code Extension

on:
  push:
    branches: [master]
    paths:
      - 'packages/vscode/package.json'
  workflow_dispatch:

jobs:
  check-version:
    runs-on: ubuntu-latest
    outputs:
      should_publish: ${{ steps.check.outputs.changed }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2
      - id: check
        run: |
          set -euo pipefail
          OLD=$(git show HEAD^:packages/vscode/package.json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).version))")
          NEW=$(node -e "console.log(require('./packages/vscode/package.json').version)")
          echo "Old: $OLD, New: $NEW"
          if [ "$OLD" != "$NEW" ]; then echo "changed=true" >> "$GITHUB_OUTPUT"; else echo "changed=false" >> "$GITHUB_OUTPUT"; fi

  publish:
    needs: check-version
    if: needs.check-version.outputs.should_publish == 'true' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      # No root package-lock.json is committed, so install (not ci).
      - run: npm install --workspace=packages/vscode
      - name: Registry in sync with the plugin
        run: npm run check:registry --workspace=packages/vscode
      - run: npm test --workspace=packages/vscode
      - run: npm run build --workspace=packages/vscode
      - name: Publish to VS Code Marketplace
        run: npx vsce publish --no-dependencies
        working-directory: packages/vscode
        env:
          VSCE_PAT: ${{ secrets.VSCE_TOKEN }}
```

Em `.github/workflows/runtime-check.yml`, acrescente `'packages/vscode/**'` e `'portable.json'` às duas listas `paths` (`pull_request` e `push`) e um job `vscode`, no mesmo nível do job `check`:

```yaml
  vscode:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm install --workspace=packages/vscode
      - run: npm run check:registry --workspace=packages/vscode
      - run: npm test --workspace=packages/vscode
      - run: npx tsc --noEmit -p packages/vscode
```

(o `defaults.run.working-directory: kb` pertence ao job `check`; não vale para o job `vscode`).

- [ ] **Step 2: Versão e metadados**

Rode uma vez, da raiz do repo:

```bash
node -e '
const fs = require("fs");
const file = "packages/vscode/package.json";
const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
pkg.version = "3.0.0";
pkg.displayName = "Delphi Dev";
pkg.description = "Remote control for the delphi-dev plugin: Delphi expert commands for Claude Code, Codex and OpenCode inside VS Code.";
pkg.keywords = ["delphi","object-pascal","pascal","claude","claude-code","codex","opencode","clean-code","code-review","firemonkey","vcl","firedac"];
pkg.repository = { type: "git", url: "https://github.com/adrianosantostreina/delphi-dev.git", directory: "packages/vscode" };
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
console.log("ok");
'
cd packages/vscode && npm run sync && npm run check:registry
```

Expected: `ok` e `registry in sync` (a sincronização preserva os campos novos).

- [ ] **Step 3: CHANGELOG e README**

Rode uma vez (da raiz do repo):

```bash
node -e '
const fs = require("fs");
function patch(file, fn) { fs.writeFileSync(file, fn(fs.readFileSync(file, "utf8"))); }

patch("packages/vscode/CHANGELOG.md", (t) => {
  if (!t.startsWith("# Changelog\n")) throw new Error("CHANGELOG sem o titulo esperado");
  const entry = `# Changelog

## [3.0.0] - 2026-10-15

### Added
- Controls **Claude Code, Codex and OpenCode** from the same sidebar, menus and command palette.
- Agent selection: setting \`delphiDev.agent\` (auto / claude / codex / opencode), a status bar picker and
  a one-time question when several agents are installed.
- OpenCode: starts \`opencode --port\` in its own terminal and sends the command through the TUI API.
- Codex: opens the panel and copies the command (experimental prompt URI behind \`delphiDev.codexPromptUri\`).
- Warns when the delphi-dev plugin is not installed for the chosen agent and offers the install command.
- Command list now comes from the plugin registry (\`portable.json\`): adds Dashboard, E2E test and Update
  knowledge base; sidebar labels follow the VS Code UI language (pt-BR / en).

### Removed
- Build, Refactor and Migrate entries (the plugin never shipped those commands).

### Changed
- The .claudeignore offer only appears when Claude Code is installed.
`;
  return entry + t.slice("# Changelog\n".length);
});

patch("packages/vscode/README.md", (t) => {
  let out = t.replace(/^# Delphi Dev for Claude Code$/m, "# Delphi Dev");
  out += `
## Supported agents

| Agent | How commands are delivered |
|---|---|
| Claude Code | Sent straight to the Claude Code panel |
| Codex | Opens the Codex panel and copies \`$delphi-cmd-<name>\`; paste and press Enter |
| OpenCode | Runs \`opencode --port 4096\` in a terminal and submits \`/delphi-<name>\` through its API |

Install the plugin for your agent with \`npx delphi-dev\` (it detects Claude Code, Codex and OpenCode).
Choose the agent in the status bar or with the \`delphiDev.agent\` setting.
`;
  return out;
});
console.log("ok");
'
```

Expected: `ok`.

- [ ] **Step 4: Rodar tudo e commitar**

Run: `cd packages/vscode && npx vitest run && npx tsc --noEmit && npm run build && npm run check:registry`
Expected: PASS e `Build complete.`

```bash
git add .github packages/vscode
git commit -m "ci(vscode): publicacao corrigida (master, npm install), versao 3.0.0 e documentacao da extensao"
```

---

### Task 8: Integração com o plugin (`/about`, `/update`, `/new-project`)

**Files:**
- Modify: `commands/about.md`, `commands/update.md`, `commands/new-project.md`, `kb/__tests__/portable-content.test.ts`, `runtime/*.mjs` (só se `kb/src` mudar; aqui não muda)

- [ ] **Step 1: Teste (vermelho)**

Ao fim de `kb/__tests__/portable-content.test.ts`:

```ts
describe('vscode extension hints', () => {
  const install = 'code --install-extension adrianosantos.delphi-dev-vscode';

  it('about and update suggest the extension when it is missing', () => {
    expect(read('commands/about.md')).toContain(install);
    expect(read('commands/update.md')).toContain(install);
  });

  it('new-project recommends the extension through .vscode/extensions.json', () => {
    const text = read('commands/new-project.md');
    expect(text).toContain('.vscode/extensions.json');
    expect(text).toContain('"recommendations": ["adrianosantos.delphi-dev-vscode"]');
  });
});
```

Run: `cd kb && npx vitest run __tests__/portable-content.test.ts`
Expected: FAIL.

- [ ] **Step 2: Acrescentar as seções**

Rode uma vez, da raiz do repo (anexa ao fim de cada arquivo, preservando o conteúdo):

```bash
node -e '
const fs = require("fs");
const TIP = `

## Dica: extensão Delphi-Dev para o VS Code / Tip: Delphi-Dev VS Code extension

Se o comando \`code\` existir e \`code --list-extensions\` **não** listar \`adrianosantos.delphi-dev-vscode\`,
termine com **uma** linha, no idioma do usuário:

- **pt-BR:** "Dica: instale a extensão Delphi-Dev do VS Code (controle remoto destes comandos):
  \`code --install-extension adrianosantos.delphi-dev-vscode\`."
- **en-US:** "Tip: install the Delphi-Dev VS Code extension (remote control for these commands):
  \`code --install-extension adrianosantos.delphi-dev-vscode\`."

Nunca instale sozinho. Não mostre a dica se a extensão já estiver instalada ou se \`code\` não existir.
`;
const NEWPROJ = `

## Recomendação da extensão no VS Code

No fim do scaffold, se a pasta do projeto ainda não tiver \`.vscode/extensions.json\`, crie-o com:

\`\`\`json
{
  "recommendations": ["adrianosantos.delphi-dev-vscode"]
}
\`\`\`

Se o arquivo já existir, não o sobrescreva. Com isso o VS Code oferece a extensão ao abrir a pasta.
`;
for (const f of ["commands/about.md", "commands/update.md"]) {
  fs.appendFileSync(f, TIP);
}
fs.appendFileSync("commands/new-project.md", NEWPROJ);
console.log("ok");
'
```

- [ ] **Step 3: Rodar**

Run: `cd kb && npx vitest run && node ../runtime/kb-cli.mjs lint --root ..`
Expected: PASS e `0 achado(s) de portabilidade`.

- [ ] **Step 4: Commit**

```bash
git add commands kb/__tests__/portable-content.test.ts
git commit -m "feat(commands): dica da extensao no /about e /update e recomendacao no /new-project"
```

---

### Task 9: Matriz manual da extensão e handoff

**Files:**
- Create: `docs/testes-v4.0-extensao.md`
- Modify: `docs/handoff.md`

- [ ] **Step 1: Matriz**

`docs/testes-v4.0-extensao.md`:

```markdown
# Testes manuais — extensão Delphi-Dev multiagente (3.0.0)

Pré-requisito: `cd packages/vscode && npm run build` e carregar a extensão em desenvolvimento
(F5 no VS Code, "Extension Development Host") com um projeto Delphi aberto.

| # | Agente | Fluxo | Esperado | Resultado |
|---|---|---|---|---|
| 1 | Claude | Botão **Auditar projeto** | painel do Claude abre com `/audit` | |
| 2 | Claude | Menu de contexto em `.pas` → **Revisar código** | `/review @arquivo[:linhas]` | |
| 3 | Claude | Sem a extensão do Claude | oferta "Instalar Claude Code" | |
| 4 | Codex | Botão **Auditar projeto** | painel do Codex abre; aviso "Comando copiado: `$delphi-cmd-audit`" | |
| 5 | Codex | Colar no composer e Enter | roda o roteiro do `/audit` | |
| 6 | Codex | `code --open-url "vscode://openai.chatgpt/?prompt=%24delphi-cmd-audit"` | **anotar:** preenche a caixa? envia sozinho? (decide `delphiDev.codexPromptUri`) | |
| 7 | Codex | Plugin não instalado | aviso com **Copiar comando** (`npx delphi-dev --target codex`) | |
| 8 | OpenCode | Botão **Auditar projeto** (nada rodando) | terminal "OpenCode - Delphi Dev" abre, `opencode --port 4096` sobe, o comando entra e executa | |
| 9 | OpenCode | Repetir com o terminal já aberto | reutiliza; **não** digita `opencode --port` de novo | |
| 10 | OpenCode | `opencode --port 4096` iniciado à mão, depois o botão | reutiliza o servidor, sem terminal extra | |
| 11 | OpenCode | `/tui/append-prompt` com texto `/delphi-audit` + submit | a TUI executa como comando (não como texto) | |
| 12 | Todos | Dois agentes instalados, setting `auto` | pergunta **uma vez**; depois lembra | |
| 13 | Todos | Status bar → clicar | QuickPick de agentes; label da barra atualiza | |
| 14 | Todos | UI do VS Code em pt-BR / en | rótulos da árvore no idioma | |
| 15 | Claude | Abrir pasta Delphi sem `.claudeignore` | oferta aparece só se o Claude estiver instalado | |

## Pontos que dependem de confirmação
- Item 6 e 11 decidem o comportamento padrão do Codex e a confiabilidade do OpenCode.
- Segredo `VSCE_TOKEN` não existe neste repositório: precisa ser criado antes de qualquer publicação.
- O `package.json` atual está em **2.0.0** (o CHANGELOG só registra a 0.1.0): conferir qual versão o Marketplace serve; a 3.0.0 só sai quando o mantenedor decidir.
```

- [ ] **Step 2: Handoff**

Em `docs/handoff.md`, no topo da seção mais recente, acrescente um item "Sprint 3C implementado" apontando para a spec, este plano e `docs/testes-v4.0-extensao.md`, com os pendentes: matriz manual, criação do `VSCE_TOKEN`, aviso no repo `delphi-dev-vscode`, e a decisão de publicar.

- [ ] **Step 3: Commit**

```bash
git add docs/testes-v4.0-extensao.md docs/handoff.md
git commit -m "docs: matriz manual da extensao multiagente e handoff do Sprint 3C"
```

---

## Cobertura da spec (3C)

| Spec | Tasks |
|---|---|
| §3 estado atual / E1, E6 | 7 |
| §5.1 registro e comandos gerados | 1, 6 |
| §5.2 texto por agente | 2, 3, 4 |
| §6.1 Claude | 2 |
| §6.2 Codex | 3 |
| §6.3 OpenCode | 4 |
| §6.4 resolução do agente | 5, 6 |
| §6.5 plugin presente? | 5, 6 |
| §7 interface (árvore, status, settings, claudeignore) | 6 |
| §8 publicação, versão, docs | 7 |
| §9 integração com o plugin | 8 |
| §10.1 testes automatizados | 1–5 |
| §10.2 matriz manual | 9 |
