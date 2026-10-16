# Design — Extensão Delphi-Dev multiagente para o VS Code (Sprint 3 = 3C)

> Spec de 2026-10-15. Branch `feature/v4.0-multi-agente`. Depende do registro `portable.json` e das
> invocações por agente definidos em
> [`2026-10-15-portable-delivery-design.md`](2026-10-15-portable-delivery-design.md) (§6).

## 1. Objetivo

A extensão **Delphi-Dev** é o "controle remoto" do plugin dentro do VS Code. Hoje ela só fala com o
**Claude Code**. Passa a controlar também **Codex** e **OpenCode**, com o mesmo painel, o mesmo menu de
contexto e a mesma lista de comandos — escolhendo o agente em uso, e entregando o comando do jeito que a
extensão de cada agente permite.

## 2. Decisões travadas

| # | Decisão |
|---|---|
| E1 | A extensão **mora neste repositório** (`packages/vscode`), fonte única. O repo `delphi-dev-vscode` vira arquivo, com aviso. |
| E2 | A lista de comandos vem do **registro `portable.json`** (copiado no build). Acabou o descompasso entre plugin e extensão. |
| E3 | Um **adaptador por agente**, com dependências injetadas (testável sem VS Code). |
| E4 | **Entrega honesta:** onde o agente não aceita um prompt programático, a extensão abre o painel, copia o comando e avisa — nunca finge que enviou. |
| E5 | Publicação **só quando tudo estiver pronto** (política do mantenedor). Este spec não publica nada. |
| E6 | Versão da extensão: **3.0.0** (Marketplace tem 0.1.0; o espelho 2.0.0 nunca foi publicado). |

## 3. Estado atual e evidências (2026-10-15)

| Fato | Fonte |
|---|---|
| Três versões coexistem: **Marketplace 0.1.0** (273 instalações), repo `delphi-dev-vscode` 0.1.1, espelho `packages/vscode` 2.0.0 (nunca publicado) | `vsce show`, `gh api` |
| O espelho tem `build`, `refactor`, `migrate` (**não existem** como comandos do plugin) e **não** tem `dashboard`, `e2e`, `update` | `package.json` vs `commands/` |
| `publish-vscode.yml` dispara em `main` (o repo usa `master`) **e** roda `npm ci` (não há lockfile raiz commitado) → nunca publicou | workflow + `.gitignore` |
| Entrega ao Claude: `executeCommand('claude-vscode.primaryEditor.open', undefined, prompt)`; reserva `vscode://anthropic.claude-code/open?prompt=…` | `claudeCodeBridge.ts` |
| Codex (`openai.chatgpt`): comandos `chatgpt.openSidebar`, `chatgpt.newCodexPanel`, `chatgpt.addToThread`…; **nenhum recebe texto livre**. URI `vscode://openai.chatgpt/?prompt=` existe no código mas **não é documentada** | manifesto e bundle da extensão instalada |
| Codex: skills se chamam com `$nome`, não `/nome`; plugins "não estão disponíveis na extensão" | docs; teste de `debug prompt-input` |
| OpenCode (`sst-dev.opencode` 1.0.0): só abre o CLI num terminal; comandos `opencode.openTerminal`, `openNewTerminal`, `addFilepathToTerminal`; **nenhum recebe prompt**; inicia sem `--port` | manifesto da extensão |
| OpenCode 1.19.1 local: `GET /global/health`, `POST /tui/append-prompt`, `POST /tui/submit-prompt`, `GET /command` existem | `opencode serve` + `/doc` |
| O setting `delphiDev.language` existe mas **nenhum código o lê** | `src/` |

## 4. Escopo

**Dentro:** registro → comandos/menus/árvore; três adaptadores; resolução do agente (setting +
detecção + escolha); status bar; diagnóstico "plugin não instalado para este agente"; testes
automatizados; workflow de publicação corrigido; docs; integração leve com o plugin (`/about`,
`/update`, `/new-project`).

**Fora:** publicar; mover o repo `delphi-dev-vscode` (só o aviso); controlar o painel por UI
automation; o setting `delphiDev.language` (fica como está, documentado como reservado).

## 5. Arquitetura

```
packages/vscode/
  scripts/sync-registry.mjs      portable.json → src/generated/registry.json + package.json (comandos)
  src/generated/registry.json    (commitado; o teste falha se divergir do portable.json)
  src/registry.ts                tipos + leitura + camelCase do id
  src/agents/
    types.ts                     AgentId, AgentAdapter, DeliveryResult, AdapterDeps
    claude.ts  codex.ts  opencode.ts
    resolve.ts                   escolhe o agente (setting, detecção, último usado)
    presence.ts                  o plugin está instalado para este agente?
  src/commands/delphiCommands.ts registra um comando VS Code por entrada do registro
  src/views/…  src/context/…     árvore e status bar (agora com o agente)
  test/mocks/vscode.ts           dublê do módulo `vscode`
```

### 5.1 Registro e comandos

- Id VS Code = `delphi-dev.` + camelCase do id (`new-project` → `newProject`, `contribute-kb` →
  `contributeKb`, `e2e` → `e2e`).
- `scripts/sync-registry.mjs --write|--check` mantém `contributes.commands` do `package.json` =
  comandos do registro + extras manuais (`createClaudeignore`, `chooseAgent`). `build`, `refactor` e
  `migrate` saem. Menus (`editor/context`, `explorer/context`) continuam escritos à mão; um teste
  garante que todo comando citado em menu existe em `contributes.commands`.
- Comando com `takesFile` anexa `@<arquivo>[:linhas]` do editor ativo.

### 5.2 Texto entregue a cada agente

| Agente | Forma | Exemplo (`audit`, `review` com arquivo) |
|---|---|---|
| Claude Code | `/<id> [@arquivo]` | `/audit` · `/review @src\Unit1.pas:10-20` |
| Codex | `$delphi-cmd-<id> [@arquivo]` | `$delphi-cmd-audit` |
| OpenCode | `/delphi-<id> [@arquivo]` | `/delphi-audit` |

## 6. Adaptadores

```ts
type AgentId = 'claude' | 'codex' | 'opencode';
type DeliveryResult = 'sent' | 'prefilled' | 'copied' | 'unavailable';

interface AgentAdapter {
  readonly id: AgentId;
  readonly label: string;                       // "Claude Code" | "Codex" | "OpenCode"
  isInstalled(): boolean;                       // a extensão/CLI do agente existe
  invocation(cmd: RegistryCommand, arg?: string): string;
  send(text: string): Promise<DeliveryResult>;
}
```

### 6.1 Claude Code
Mantém o comportamento atual: `claude-vscode.primaryEditor.open` com o prompt; se lançar, a URI
`vscode://anthropic.claude-code/open?prompt=…`; se nada abrir, oferece instalar `anthropic.claude-code`.
Resultado `sent`.

### 6.2 Codex
1. Se `delphiDev.codexPromptUri` = `true` (experimental, padrão `false`): abre
   `vscode://openai.chatgpt/?prompt=<texto codificado>`; se `openExternal` devolver `true` → `prefilled`.
2. Senão: `chatgpt.openSidebar` (reserva `chatgpt.newCodexPanel`), copia o texto para a área de
   transferência e mostra "Comando copiado — cole no Codex e tecle Enter" → `copied`.
3. Sem a extensão: mensagem com botão "Instalar Codex" (`openai.chatgpt`) → `unavailable`.

A URI só vira padrão depois do teste manual do §10 confirmar que preenche (e que **não** envia sozinha).

### 6.3 OpenCode
Controle completo pela API HTTP do próprio OpenCode, num terminal **da extensão**:

1. Porta = `delphiDev.opencodePort` (padrão `4096`). Se `GET /global/health` responde → reutiliza.
2. Senão cria (ou reaproveita) o terminal "OpenCode · Delphi Dev" no workspace e executa
   `opencode --port <porta>`; espera o `health` por até 20 s.
3. `POST /tui/append-prompt {"text": <texto>}` e `POST /tui/submit-prompt`, com até 5 tentativas a
   cada 500 ms (a TUI precisa terminar de anexar). → `sent`.
4. Qualquer falha (CLI ausente, porta ocupada por servidor sem TUI, tempo esgotado) → mostra o
   terminal, copia o texto → `copied`.

Quem já abre o OpenCode com `opencode --port 4096` (ou define outra porta no setting) passa a ser
controlado sem terminal extra.

### 6.4 Resolução do agente (`resolve.ts`)
- `delphiDev.agent` = `claude|codex|opencode` → esse.
- `auto` (padrão): instalados = filtro de `isInstalled()`. Um → ele. Zero → mensagem de instalação.
  Vários → **último usado** (guardado em `globalState`) se ainda instalado; senão QuickPick uma vez.
- Comando `delphi-dev.chooseAgent` e clique na status bar abrem o QuickPick e gravam o último usado.

### 6.5 "Plugin instalado para este agente?" (`presence.ts`)
Antes de entregar: Codex → existe `~/.agents/skills/delphi-cmd-audit/SKILL.md`; OpenCode → existe
`<config>/opencode/commands/delphi-audit.md`; Claude → sem checagem (instalação por marketplace).
Ausente → aviso "O plugin delphi-dev ainda não está instalado para <agente>" com botão **Copiar
comando** (`npx delphi-dev --target codex|opencode`). Não bloqueia o envio.

## 7. Interface

- **Árvore** "Commands": uma linha por comando do registro (título pelo idioma da UI do VS Code:
  `pt*` → pt-BR, senão en-US), ícone do registro.
- **Status bar:** `$(tools) Delphi Dev · <agente>`; tooltip "Delphi Dev — controle remoto do agente";
  clique = escolher agente.
- **`createClaudeignore`** só roda quando o agente resolvido é o Claude.
- **Settings novos:** `delphiDev.agent`, `delphiDev.opencodePort`, `delphiDev.codexPromptUri`.
- **Boas-vindas** da árvore sem projeto Delphi: inalterado.

## 8. Publicação, versão e docs

- `publish-vscode.yml`: gatilho `master`; `npm ci` → `npm install --workspace=packages/vscode`;
  `sync-registry --check` antes do build. Publicação continua dependendo do segredo `VSCE_TOKEN`
  (não existe neste repo hoje) e da sua decisão.
- `package.json`: `version` 3.0.0, `displayName` "Delphi Dev", descrição e `keywords` citando os três
  agentes; `CHANGELOG.md` e `README.md` da extensão atualizados.
- Repo `delphi-dev-vscode`: README com aviso "movido para delphi-dev/packages/vscode" (ação manual
  do mantenedor — este spec não altera outro repositório).

## 9. Integração com o plugin

- `commands/about.md` e `commands/update.md`: se `code` existir e `code --list-extensions` não listar
  `adrianosantos.delphi-dev-vscode`, sugerir `code --install-extension adrianosantos.delphi-dev-vscode`
  (uma linha, nos dois idiomas; nunca instala sozinho).
- `commands/new-project.md`: passo novo — criar `.vscode/extensions.json` com
  `{"recommendations": ["adrianosantos.delphi-dev-vscode"]}` se o arquivo não existir (o VS Code então
  pergunta ao abrir a pasta).

## 10. Testes e validação

### 10.1 Automatizados (vitest, `packages/vscode/test`)
- `sync-registry`: gera/valida `package.json` e `registry.json`; divergência falha.
- Adaptadores com dependências falsas: o texto de cada agente; `copied` quando não há prompt
  programático; OpenCode: reutiliza servidor vivo, sobe terminal, tenta de novo, cai no clipboard;
  Claude: reserva por URI.
- `resolve`: setting explícito; um instalado; vários + último usado; QuickPick uma vez.
- `presence`: arquivos presentes/ausentes em home temporário.

### 10.2 Manual (matriz em `docs/testes-v4.0-extensao.md`)
1. `code --open-url "vscode://openai.chatgpt/?prompt=%24delphi-cmd-audit"` preenche a caixa do Codex?
   Envia sozinho? (decide o padrão de `codexPromptUri`).
2. Botão "Audit" com cada agente, num projeto Delphi, no VS Code limpo.
3. OpenCode: terminal da extensão abre, comando aparece e executa; reutilização com `--port` manual.
4. Regressão do Claude Code (comportamento idêntico ao 0.1.0).

## 11. Riscos

| Risco | Mitigação |
|---|---|
| URI do Codex mudar ou não existir | Atrás de flag; padrão é copiar + abrir painel |
| `append-prompt` não tratar `/…` como comando na TUI | Teste manual 3; reserva é copiar |
| Extensão do OpenCode abre o próprio terminal e o nosso duplica | Reutilização por porta; documentado |
| Quem está no Marketplace 0.1.0 perde algo | Nada some: os 8 comandos publicados continuam |
| Segredo `VSCE_TOKEN` ausente | Registrado como pendência manual; publicação é decisão do mantenedor |
