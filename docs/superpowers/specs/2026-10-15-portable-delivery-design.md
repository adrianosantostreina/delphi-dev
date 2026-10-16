# Design — Núcleo portátil e entrega para Codex e OpenCode (Sprint 3 = 3A + 3B)

> Spec de 2026-10-15. Branch `feature/v4.0-multi-agente`. Sub-projetos **3A (núcleo portátil)** e
> **3B (entrega para Codex e OpenCode)** do [plano de sprints](../plans/2026-10-13-v4.0-multi-agente.md).
> O sub-projeto **3C (extensão VS Code multiagente)** tem spec própria:
> [`2026-10-15-vscode-multi-agent-design.md`](2026-10-15-vscode-multi-agent-design.md).
> Base já pronta: [`2026-10-14-kb-v4-design.md`](2026-10-14-kb-v4-design.md) (runtime `kb/` → `runtime/`).

## 1. Objetivo

Quem usa **Codex** ou **OpenCode** — no terminal ou dentro do VS Code — instala o `delphi-dev` com um
comando e passa a ter: as skills, os 11 comandos, os 4 subagentes, a base de conhecimento (MCP) e os
hooks, **com degradação explícita** onde o agente não tiver o recurso. O Claude Code **não pode piorar**.

Tudo neste repositório. Nada de repositório separado para Codex ou OpenCode.

## 2. Decisões travadas

| # | Decisão |
|---|---|
| D1 | Alvos: **Claude Code (já pronto), Codex e OpenCode**. Antigravity (`agy`) fica **fora**; a issue #9 pede só o `plugin.json` na raiz e não é prometida aqui. |
| D2 | O **installer é o caminho principal** (`npx delphi-dev --target …`). Funciona igual no terminal e dentro do VS Code. Manifestos/marketplace nativos do Codex ficam como alternativa. |
| D3 | **Um checkout estável** em `~/.delphi-dev/plugin` (clone do GitHub). A lógica que gera os arquivos de cada agente vive **neste repo**, num bundle commitado (`runtime/kb-cli.mjs`); o pacote npm fica fino. |
| D4 | **Fonte única de conteúdo:** `skills/`, `commands/`, `agents/`. Os arquivos de Codex/OpenCode são **gerados**, nunca mantidos à mão. |
| D5 | **Nunca apagar nada do usuário.** Toda escrita é por marcador ou chave própria, com manifesto de propriedade, backup e recusa em caso de dúvida (lição do `removeHooks`). |
| D6 | Skills e MCP são o **núcleo garantido**; hooks são "validar em teste real e degradar" (§12). |
| D7 | Texto do plugin **neutro de ferramenta**: nada de "Agent tool", "Edit tool", `AskUserQuestion`. Um lint de portabilidade falha o CI. |

## 3. Evidências levantadas (2026-10-15, nesta máquina)

Tudo abaixo foi **executado**, não lido de documentação. A coluna "efeito" é o que isso decide.

| Fato verificado | Como | Efeito no desenho |
|---|---|---|
| OpenCode 1.19.1 instalado; com `USERPROFILE`/`HOME` apontando para uma pasta temporária, o config muda para `<tmp>\.config\opencode` | `opencode debug paths` | Instalação do OpenCode é **testável isolada** (`--home <tmp>`). |
| OpenCode descobriu a skill em `~/.agents/skills`, o comando de `~/.config/opencode/commands`, o agente de `~/.config/opencode/agents` e o MCP de `opencode.json` | `opencode debug skill`, `debug config` | Os formatos de saída (§8) são os que o OpenCode lê. |
| **O `runtime/kb-mcp.mjs` real conectou no OpenCode** (`delphi-dev-kb ✓ connected`) | `opencode mcp list` | MCP com caminho absoluto funciona; **sem** `${CLAUDE_PLUGIN_ROOT}`. |
| Codex 0.162 (`codex.exe` empacotado na extensão `openai.chatgpt`) lista skills de `~/.agents/skills` (raiz `r0`) e de `<projeto>/.agents/skills` com nome e descrição | `codex debug prompt-input` | Skills compartilhadas Codex+OpenCode **numa pasta só**; projeto é testável sem modelo. |
| Codex resolve o "home" pelo **perfil do Windows**, ignorando `USERPROFILE` | mesmo teste, `r0` ficou no home real | Teste do Codex em escopo **de projeto**; o código recebe `home` por parâmetro. |
| `codex mcp list/get` lê `config.toml` com `[mcp_servers.delphi-dev-kb]` (`transport: stdio`, caminho com espaços) | `CODEX_HOME` temporário | Formato do MCP do Codex confirmado. |
| `codex features`: `hooks` e `plugins` **estáveis** | `codex features list` | Hooks existem; falta validar o disparo (§12). |
| OpenCode expõe `GET /global/health`, `GET /command`, `POST /tui/append-prompt`, `/tui/submit-prompt`, `/tui/execute-command`, `/tui/show-toast` | `opencode serve` + OpenAPI `/doc` | Base do controle remoto do 3C. |
| `~/.agents/skills` **já é compartilhada** (skills AWS); `~/.config/opencode` já tem `opencode.json`, um agente `delphi-reviewer` e um plugin `gk-hooks.js` | `ls` (só nomes) | Nunca sobrescrever; coexistir; prefixo `delphi-`. |
| OpenCode **rejeita** chave desconhecida em `opencode.json` e "falha ao iniciar com config inválido" | skill embutida `customize-opencode` | Merge **estrito**, com backup e verificação (§9). |

## 4. Escopo

**Dentro:** lint de portabilidade; regras dentro das skills; notação `kb:`; registro de comandos;
geradores (skills de comando e subagentes do Codex, comandos e subagentes do OpenCode, MCP, hooks);
`kb-cli install/uninstall/doctor/lint/fix-encoding`; installer npm com `--target`; script de validação
com os CLIs reais; docs.

**Fora (outros sub-projetos / sprints):** extensão VS Code (3C); bump para 4.0.0 e release (Sprint 5);
Antigravity; instalação via marketplace nativo do Codex; busca vetorial.

## 5. Arquitetura

```
npx delphi-dev --target codex|opencode|claude|all        (pacote npm fino)
   │  git clone/pull  →  ~/.delphi-dev/plugin             (ou --from <checkout> em desenvolvimento)
   └─ node ~/.delphi-dev/plugin/runtime/kb-cli.mjs install --target <t> [--scope user|project] [--home <dir>]
          │
          ├─ lê      skills/  commands/  agents/  portable.json  hooks  runtime/
          ├─ gera    (em memória)  skills de comando · agentes TOML/MD · comandos OpenCode · plugin JS
          └─ grava   com manifesto de propriedade  ~/.delphi-dev/install-manifest.json
```

### 5.1 Onde cada coisa vai (escopo `user`, o padrão)

| | Codex | OpenCode |
|---|---|---|
| Skills do plugin | `~/.agents/skills/<nome>/` (cópia) | `~/.agents/skills/<nome>/` (**a mesma**) |
| Comandos | skills `delphi-cmd-<id>` em `~/.agents/skills/` (geradas) | `~/.config/opencode/commands/delphi-<id>.md` |
| Subagentes | `~/.codex/agents/<nome>.toml` | `~/.config/opencode/agents/<nome>.md` |
| MCP | bloco gerenciado em `~/.codex/config.toml` | chave `mcp["delphi-dev-kb"]` em `opencode.json` |
| Hooks | entradas em `~/.codex/hooks.json` | `~/.config/opencode/plugins/delphi-dev.js` |

`CODEX_HOME` e `XDG_CONFIG_HOME` são respeitados. Escopo `project` grava só skills, subagentes e
comandos dentro do repositório do usuário (`.agents/skills`, `.codex/agents`, `.opencode/commands`,
`.opencode/agents`) — sem MCP nem hooks, que exigem confiança do projeto.

### 5.2 Checkout

- `~/.delphi-dev/plugin`: `git clone --depth 1` do repositório; atualização por `git pull --ff-only`
  (`npx delphi-dev update` e `/update`). Tolera offline: mantém o que tem.
- É um **segundo clone**, além do `~/.claude/plugins/delphi-dev` do alvo Claude. Aceito para manter o
  alvo Claude intocado e para quem não usa Claude.
- `--from <caminho>` usa um checkout existente (o mantenedor, antes do release) e aponta MCP e hooks
  para ele.

## 6. Registro `portable.json` (raiz do repo)

Uma lista explícita dos comandos de usuário e das exceções por alvo. É a fonte do 3B e do 3C.

```json
{
  "schema": 1,
  "skills": { "delphi-claudeignore": { "targets": ["claude"] } },
  "commands": [
    { "id": "audit", "title": { "pt-BR": "Auditar projeto", "en-US": "Audit project" },
      "description": { "pt-BR": "Laudo técnico completo", "en-US": "Complete technical audit" },
      "takesFile": false, "icon": "checklist" }
  ]
}
```

- `skills[nome].targets`: alvos que **recebem** a skill; ausente = todos. `delphi-claudeignore` só no Claude
  (`.claudeignore` não existe nos outros).
- `commands[]`: um por arquivo de `commands/`. `takesFile` diz se a extensão anexa o arquivo ativo.
- **Invocação por alvo (derivada, não gravada):** Claude `/<id>`; Codex `$delphi-cmd-<id>`;
  OpenCode `/delphi-<id>`. O prefixo evita colisão com comandos do usuário (`/review`, `/spec`…).
- O lint garante: todo `commands/*.md` tem entrada, toda entrada tem arquivo, títulos nos dois idiomas.

## 7. Núcleo portátil (3A)

### 7.1 Regras de portabilidade (lint)

`kb-cli lint [--root <dir>]` (exit 1 com achados; roda no CI e num teste sobre o repo real):

| Regra | Falha quando |
|---|---|
| `skill-name` | pasta ≠ `name`, ou fora de `^[a-z0-9]+(-[a-z0-9]+)*$`, ou > 64 |
| `skill-description` | ausente ou > 1024 caracteres |
| `skill-frontmatter` | chave fora de `name`, `description`, `license`, `compatibility`, `metadata` |
| `tool-names` | texto com nome de ferramenta de um agente específico (lista em §7.4) |
| `path-ref` | referência a `rules/…` ou `knowledge/…` fora da notação `kb:`, ou `../` em skill |
| `references-exist` | `references/<arquivo>` citado e inexistente na pasta da skill |
| `command-registry` | comando sem entrada no `portable.json` (ou o inverso), skill inexistente |
| `agent-frontmatter` | agente sem `name`/`description` |
| `version-sync` | `plugin.json` ≠ `marketplace.json` ≠ linha `Versão:` do `/about` |

Exceção explícita por linha: comentário HTML `<!-- portability:allow <regra> -->` na linha ou na
anterior. Usada só onde o texto enumera ferramentas de propósito (`delphi-contribute`, passo da pergunta).

### 7.2 Skills autossuficientes

- `rules/*.md` (6 arquivos) → `skills/delphi-standards/references/rules/`. `delphi-legacy` e
  `delphi-spring4d` passam a dizer "ative a skill `delphi-standards` e leia
  `references/rules/<arquivo>`" — referência **por nome de skill**, não por caminho. Motivo: no destino
  as skills são copiadas para `~/.agents/skills/` e a pasta `rules/` da raiz não vai junto.
- Referências `knowledge/<tier>/<arquivo>.md` → **`kb:<tier>/<arquivo>.md`**. Cada `SKILL.md` que usa
  `kb:` ganha, logo após o primeiro título, a linha padrão:

  > **Notação `kb:`** — `kb:core/arquivo.md` é um arquivo da base de conhecimento. Leia com `kb_get`
  > (MCP `delphi-dev-kb`); sem ele, procure em `~/.delphi-dev/kb-cache/current/` ou em
  > `knowledge/` na raiz do plugin (`~/.delphi-dev/plugin/knowledge/` só existe se o plugin foi instalado
  > com `npx delphi-dev --target codex|opencode`).

- `kb_get` passa a **cair no snapshot embutido** quando o arquivo não existe no snapshot atualizado
  (resolve o `INDEX.md` ausente do cache baixado — minor 14 do review final).

### 7.3 Comandos e subagentes

- **Comandos não são movidos nem reescritos.** `commands/*.md` continua sendo a fonte; o Claude Code
  não muda. Os geradores (§8) derivam as versões de Codex e OpenCode.
- **Subagentes não são reestruturados.** O corpo de `agents/*.md` já é neutro de ferramenta; o gerador
  só converte o formato.
- Texto específico de Claude restante é neutralizado (`delphi-spec`: "ferramenta Write"; `new-project`:
  passo do `.claudeignore` passa a "somente no Claude Code").

### 7.4 Lista do `tool-names`

Frases tipo `ferramenta Write|Edit|Read|Bash|Agent|Task|Skill|Grep|Glob|WebFetch|TodoWrite|AskUserQuestion`,
`<Nome> tool` para os mesmos nomes, e os identificadores `AskUserQuestion`, `subagent_type`,
`CLAUDE_PLUGIN_ROOT`, `allowed-tools`.

## 8. Geradores (3B)

Todos são **funções puras** (texto entra, texto sai), testadas sem tocar o disco.

### 8.1 Skills de comando para o Codex

Para cada `commands/<id>.md`: pasta `delphi-cmd-<id>/` com

```
SKILL.md          ---\nname: delphi-cmd-<id>\ndescription: "<descrição do comando>"\n---\n<corpo do comando>
agents/openai.yaml   policy:\n  allow_implicit_invocation: false
```

- `description` = `Comando /<id> do delphi-dev (chamada explícita). <descrição original>`, sempre como
  string JSON (YAML válido). Corpo: `$ARGUMENTS` → "o que o usuário informou depois do comando".
- `allow_implicit_invocation: false`: o comando só roda quando chamado (`$delphi-cmd-audit`), sem
  competir com as skills de conhecimento pela descrição.

### 8.2 Comandos do OpenCode

`delphi-<id>.md` = frontmatter com **apenas** `description` + corpo original. `$ARGUMENTS` é nativo.

### 8.3 Subagentes

Entrada: `agents/<nome>.md` (frontmatter `name`, `description`, `model: inherit`; corpo).

- **Descrição limpa** (a original traz blocos `<example>` e "Exemplos:"): corta do primeiro `<example>`
  ou `Exemplos:`/`Examples:`; colapsa espaços; limita a 600 caracteres em fronteira de palavra.
- **Codex** `~/.codex/agents/<nome>.toml`: `name`, `description`, `developer_instructions` (corpo em
  string literal multilinha `'''`; se o corpo contiver `'''`, string básica escapada).
- **OpenCode** `~/.config/opencode/agents/<nome>.md`: `description`, `mode: subagent`; corpo = prompt.
  `model: inherit` é descartado.
- Contrato writer → tester (CLAUDE.md) preservado: o texto do `delphi-writer` já pede a delegação ao
  `delphi-tester` em linguagem neutra; sem subagentes disponíveis, o agente segue a skill `delphi-tests`.

### 8.4 MCP

- **Codex** — bloco gerenciado em `config.toml`:

  ```toml
  # >>> delphi-dev (gerenciado; não edite entre os marcadores) >>>
  [mcp_servers.delphi-dev-kb]
  command = "node"
  args = ["<checkout>/runtime/kb-mcp.mjs"]
  # <<< delphi-dev <<<
  ```

  Se já existir `[mcp_servers.delphi-dev-kb]` **fora** do bloco, não grava (evita tabela duplicada, que
  quebra o Codex) e avisa.
- **OpenCode** — `mcp["delphi-dev-kb"] = { "type": "local", "command": ["node", "<checkout>/runtime/kb-mcp.mjs"], "enabled": true }`.
  Merge estrito (§9). Variáveis `{env:VAR}` seriam o formato; não usamos nenhuma.

### 8.5 Hooks

| Alvo | O que grava | Eventos |
|---|---|---|
| Codex | entradas em `~/.codex/hooks.json`, `command` POSIX com guarda de Node e `commandWindows` | `PostToolUse` (`apply_patch`) → `hook-fix-encoding`; `UserPromptSubmit` → `hook-inject` |
| OpenCode | `~/.config/opencode/plugins/delphi-dev.js` (gerado) | `tool.execute.after` → fix-encoding; `chat.message` + `experimental.chat.system.transform` → inject |

- O plugin JS chama `node <checkout>/runtime/<hook>.mjs` com `spawnSync` (timeout 3 s, sempre engole
  erro). Não usa módulo nativo nem `bun:sqlite`.
- `hook-fix-encoding` passa a aceitar também `filePath` e `path` no `tool_input` (o OpenCode usa
  `filePath`).
- **Validação real do disparo é manual** (§13.3): no Codex exige confiar em `/hooks` uma vez; a API de
  plugins do OpenCode está em reescrita (V2).

### 8.6 Rede de proteção do `fix-encoding`

Novo `kb-cli fix-encoding <arquivos…>`. A skill `delphi-encoding` instrui: "se não houver hook ativo,
depois de gravar arquivos Delphi rode `node "<raiz>/runtime/kb-cli.mjs" fix-encoding <arquivos>`",
com `<raiz>` = `~/.delphi-dev/plugin` nos alvos Codex/OpenCode.

## 9. Segurança de escrita (D5)

1. **Manifesto de propriedade** `~/.delphi-dev/install-manifest.json`: por alvo, lista de arquivos
   (`path`, `sha256`), blocos (`file`, `marker`) e chaves JSON gravadas. Só o que consta ali é tocado.
2. **Pastas de skill**: cada pasta nossa recebe `.delphi-dev-managed` (versão + hash). Pasta existente
   **sem** marcador = do usuário → **não sobrescreve** (aviso), salvo `--force`.
3. **Arquivo alterado pelo usuário** desde a última instalação (hash ≠ manifesto) → não sobrescreve;
   `--force` faz backup `.bak-<data>` e sobrescreve.
4. **JSON** (`opencode.json`, `hooks.json`): `JSON.parse` estrito; se falhar (comentários/JSONC) →
   **não toca**, imprime o trecho para colar à mão. Só adiciona a **nossa** chave; preserva o resto,
   inclusive ordem. Backup `<arquivo>.delphi-dev.bak` na primeira alteração.
5. **TOML**: só dentro dos marcadores; conteúdo fora é intocável.
6. **Escrita atômica** (temp + rename); `--dry-run` imprime o plano sem gravar.
7. **Uninstall** remove só o que o manifesto lista **e** cujo hash ainda confere; o resto vira aviso.
8. Depois de gravar, `doctor` confere a estrutura; com `--deep` e CLIs presentes, roda
   `codex mcp get delphi-dev-kb` e `opencode debug config`.

## 10. `kb-cli` — novos subcomandos

```
install   --target codex|opencode|all  [--scope user|project] [--project <dir>]
          [--home <dir>] [--checkout <dir>] [--dry-run] [--force]
uninstall --target codex|opencode|all  [--home <dir>] [--force]
doctor    [--target …] [--home <dir>] [--deep]
lint      [--root <dir>]
fix-encoding <arquivo…>
```

`install --target claude` responde que o alvo Claude usa `/plugin` ou `npx delphi-dev` (não é
duplicado aqui).

**Códigos de saída de `install`:** `0` tudo aplicado · `1` erro de execução · `2` parcial (rodou, mas
recusou/ignorou itens por proteção: JSONC, JSON inválido, conflito, bloco TOML corrompido, arquivo
modificado pelo usuário, erro de E/S num item) e imprime `N item(ns) não aplicado(s)` · `64` uso. O
segundo pacote (`npx delphi-dev`) repassa o `2` e **não** imprime "installed … restart" nesse caso.
Backups de **pasta** de skill vão para `~/.delphi-dev/backups/<stamp>/` (fora de `skills/`, onde
virariam skill duplicada); backups de arquivo de config ficam ao lado (`.delphi-dev.bak`).

## 11. Installer npm

`npx delphi-dev [--target claude|codex|opencode|all] [--from <checkout>] [--scope …]`

- Sem `--target`: **conservador** — instala apenas o Claude Code (comportamento publicado, idêntico ao
  de sempre). A detecção continua existindo, mas só gera uma **dica**: `codex` se `codex` no PATH,
  `~/.codex` ou a extensão `openai.chatgpt` existir; `opencode` se `opencode` no PATH,
  `~/.config/opencode` ou a extensão `sst-dev.opencode` existir; para cada um imprime o comando exato
  (`npx delphi-dev --target codex`). Config de Codex/OpenCode só é escrita com `--target` explícito
  (`codex|opencode|all`).
- Para `codex`/`opencode`: garante o checkout (§5.2) e executa `kb-cli install`.
- Alvo `claude`: comportamento atual, intocado (inclui a extensão VS Code).
- `update`: `git pull` do checkout + reexecuta `kb-cli install` dos alvos já instalados.

## 12. Degradação

| Recurso | Garantido | Se faltar |
|---|---|---|
| Skills, comandos, subagentes | sim (arquivos em pastas que o agente lê) | — |
| MCP da base | sim (verificado no OpenCode; formato verificado no Codex) | skills mandam procurar nos `.md` |
| Hook `fix-encoding` | **validar** | skill manda rodar `kb-cli fix-encoding` |
| Hook de injeção | **validar** | `kb_search` sob demanda continua |
| Node < 22.13 | — | igual ao spec da base (§9 daquela spec) |

## 13. Testes e validação

### 13.1 Automatizados (CI e local)
- Geradores: função pura, entrada/saída exata, com os `agents/*.md` e `commands/*.md` reais.
- Escrita: pasta temporária; idempotência (2ª execução = 0 mudanças); preserva arquivo do usuário;
  recusa conflito; uninstall restaura; JSON inválido não é tocado.
- Plugin JS do OpenCode: importado em Node com `spawnSync` real e hooks chamados com entradas
  simuladas (BOM aplicado; contexto de injeção devolvido).
- `lint` sobre o **repositório real** sem achados.

### 13.2 Com os CLIs reais (script `kb/scripts/validate-targets.mjs`, local)
- **OpenCode** (isolado por `HOME`): `debug skill`, `agent list`, `debug config`, `mcp list` — esperam
  as skills, os 11 comandos, os 4 subagentes e o MCP `connected`.
- **Codex** (escopo de projeto + `CODEX_HOME` temporário): `debug prompt-input` lista as skills do
  plugin; `mcp list` mostra `delphi-dev-kb`.

### 13.3 Manual (matriz em `docs/testes-v4.0-codex-opencode.md`)
Disparo dos hooks nos dois agentes (terminal e VS Code); `$delphi-cmd-audit` no Codex; `/delphi-audit`
no OpenCode; instalação limpa no Windows sem Node.

## 14. Riscos

| Risco | Mitigação |
|---|---|
| Hooks do Codex/OpenCode não dispararem na extensão do VS Code | Rede de proteção §8.6 e §12; matriz manual |
| API de plugins do OpenCode mudar (V2) | Plugin mínimo e gerado; reinstalar corrige; falha silenciosa |
| `opencode.json` do usuário com JSONC | Recusa e imprime o trecho (§9.4) |
| Dois clones do repo | Aceito (§5.2); `doctor` mostra ambos |
| `agents/openai.yaml` com esquema diferente do esperado | Verificado por `debug prompt-input`; se a skill sumir da lista, só perde a chamada implícita |

## 15. Fora de escopo
Antigravity; bump 4.0.0 e release; instalação por marketplace nativo; extensão VS Code (3C).
