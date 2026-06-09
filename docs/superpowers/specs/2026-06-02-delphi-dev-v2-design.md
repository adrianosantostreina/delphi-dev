# Spec: delphi-dev v2.0 — Harness Completo

**Data:** 2026-06-02
**Autor:** Adriano Santos
**Status:** Aprovado
**Versão alvo inicial:** 2.0 (monorepo + installer)
**Versão alvo final:** 2.7 (feature-complete v2)

---

## Visão Geral

Reescrita maior do plugin `delphi-dev` para Claude Code. O objetivo é transformar o plugin em um **harness completo para desenvolvimento Delphi**: instalação confiável via npx, base de conhecimento vetorial que cresce com uso comunitário, hooks automáticos de pre/pós-execução, regras Delphi estruturadas, skills e agentes aprimorados para todas as frentes (VCL, FMX, legado, build, Spring4D, FireDAC, ACBr, async) e integração nativa com VS Code publicada no Marketplace.

A implementação segue o modelo **Big Bang versionado**: todo o escopo é implementado de uma vez e entregue em releases incrementais (v2.0 → v2.7) com critério de release claro por versão.

---

## Problema que Resolve

| Problema atual | Solução v2 |
|----------------|------------|
| Plugin instala mas não aparece no Claude Code | npx automatiza e verifica o registro |
| KB de conhecimento fica na máquina do autor | KB migrada para dentro do plugin, cresce via PRs |
| Nenhum hook registrado | Hooks SubagentStop/Stop/UserPromptSubmit/PostToolUse ativos |
| Sem aprendizado persistente entre sessões | RAG com SQLite-vec captura e reutiliza aprendizados |
| Sem validação real do código gerado | delphi-builder compila, lê log, sugere fix |
| Instalação manual e frágil | `npx delphi-dev` instala tudo em um comando |
| Extensão VS Code sem vínculo com o plugin | Monorepo, versão sincronizada, Marketplace publicado |

---

## Repositório: Estrutura do Monorepo

O repo `delphi-dev` absorve o conteúdo do `delphi-dev-vscode`. O repo `delphi-dev-vscode` no GitHub é arquivado após a migração.

```
delphi-dev/
├── .claude-plugin/
│   ├── plugin.json                  ← versão, skills, agents, commands, hooks
│   └── marketplace.json             ← existente (mantido, shape aninhado preservado)
├── skills/
│   ├── delphi-standards/            ← existente (melhorado)
│   ├── delphi-laudo/                ← existente (melhorado)
│   ├── delphi-spec/                 ← existente
│   ├── delphi-tests/                ← existente (melhorado)
│   ├── delphi-write/                ← existente
│   ├── delphi-claudeignore/         ← existente (melhorado)
│   ├── delphi-encoding/             ← NOVO (Fase 1 roadmap)
│   ├── delphi-fmx/                  ← NOVO (Fase 2 roadmap)
│   ├── delphi-build/                ← NOVO (Fase 4 roadmap)
│   ├── delphi-spring4d/             ← NOVO (Fase 3 roadmap)
│   ├── delphi-firedac/              ← NOVO (sugestão aprovada)
│   ├── delphi-acbr/                 ← NOVO (sugestão aprovada)
│   ├── delphi-async/                ← NOVO (sugestão aprovada)
│   └── delphi-legacy/               ← NOVO (projetos legados)
├── agents/
│   ├── delphi-auditor.md            ← existente (melhorado)
│   ├── delphi-writer.md             ← existente (melhorado)
│   ├── delphi-tester.md             ← existente (melhorado)
│   ├── delphi-spec-writer.md        ← existente
│   ├── delphi-builder.md            ← NOVO (Fase 4 roadmap)
│   └── delphi-migrator.md           ← NOVO (legados)
├── commands/
│   ├── audit.md                     ← existente
│   ├── write.md                     ← existente
│   ├── review.md                    ← existente
│   ├── spec.md                      ← existente
│   ├── tdd.md                       ← existente
│   ├── new-project.md               ← existente (melhorado: mobile FMX)
│   ├── about.md                     ← existente (bump v2.0)
│   ├── dashboard.md                 ← existente
│   ├── build.md                     ← NOVO (Fase 4)
│   ├── refactor.md                  ← NOVO
│   ├── migrate.md                   ← NOVO (legados)
│   └── contribute-kb.md             ← NOVO (RAG comunitário)
├── hooks/
│   ├── fix-encoding.ts              ← NOVO: PostToolUse Write|Edit (cross-platform Node.js)
│   ├── summarize-agent.ts           ← NOVO: SubagentStop
│   ├── summarize-session.ts         ← NOVO: Stop
│   └── search-rag.ts                ← NOVO: UserPromptSubmit
├── rules/
│   ├── naming.md                    ← NOVO: prefixos, nomenclatura
│   ├── architecture.md              ← NOVO: SOLID, camadas, Clean Arch
│   ├── forbidden.md                 ← NOVO: with/Break/Continue/Real/ARC
│   ├── legacy.md                    ← NOVO: modernização incremental
│   ├── security.md                  ← NOVO: SQL parametrizado, validação
│   └── testing.md                   ← NOVO: DUnitX, AAA, nomenclatura
├── knowledge/
│   ├── core/                        ← NOVO: 25+ arquivos migrados da KB global
│   │   ├── INDEX.md
│   │   ├── encoding-utf8-bom.md
│   │   ├── build-via-bat-com-log.md
│   │   ├── cores-argb.md
│   │   ├── uses-fmx-components.md
│   │   ├── uses-uma-unit-por-linha.md
│   │   ├── dpr-uses-project-manager.md
│   │   ├── componentes-designer-vs-runtime.md
│   │   ├── inherited-forms.md
│   │   ├── dimensoes-form-mobile.md
│   │   ├── unit-naming-android.md
│   │   ├── campos-orfaos-fmx.md
│   │   ├── delphi13-breaking-changes.md
│   │   ├── recursos-rcdata.md
│   │   ├── deployment-arquivos-extras.md
│   │   ├── delphi-android-ios-versions.md
│   │   ├── onclick-vs-ontap-mobile.md
│   │   ├── imei-device.md
│   │   ├── ssl-tls-android.md
│   │   ├── firedac-registro-drivers.md
│   │   └── acbr-nfce-integracao.md
│   ├── fmx/                         ← NOVO: 13 arquivos da KB FMX global
│   │   └── INDEX.md
│   ├── community/                   ← NOVO: contribuições via /contribute-kb
│   │   └── .gitkeep
│   └── local/                       ← NOVO: gitignored, gerado pelos hooks
│       └── .gitignore
├── rag/
│   ├── rag.db                       ← gerado pelo CI, baixado no npx install
│   └── schema.sql
├── scripts/
│   ├── build-rag.ts                 ← reconstrói rag.db completo (usado pelo CI)
│   ├── embed.ts                     ← gera embeddings de um arquivo .md (all-MiniLM-L6-v2)
│   ├── search.ts                    ← busca vetorial (chamado pelo hook)
│   └── capture.ts                   ← chunking + zero-shot classification local (nli-deberta-v3-small)
├── packages/
│   └── vscode/                      ← conteúdo migrado do delphi-dev-vscode
│       ├── src/
│       │   ├── extension.ts
│       │   ├── commands/
│       │   ├── views/
│       │   ├── features/
│       │   └── context/
│       ├── package.json             ← versão sincronizada com plugin.json
│       └── ...
├── installer/
│   ├── index.ts                     ← entry point do npx delphi-dev
│   └── package.json                 ← publicado como "delphi-dev" no npm
├── .github/
│   └── workflows/
│       ├── build-rag.yml            ← trigger: push em knowledge/**
│       └── publish-vscode.yml       ← trigger: bump em packages/vscode/package.json
├── package.json                     ← npm workspaces root
├── tsconfig.json
├── CLAUDE.md
├── ROADMAP.md
├── ROADMAP.pt-BR.md
├── README.md
└── README.pt-BR.md
```

---

## RAG: Sistema de Conhecimento Vetorial

### Tecnologia
- **SQLite** com extensão **sqlite-vec** para busca por similaridade de vetores
- **Modelo de embedding:** `all-MiniLM-L6-v2` (384 dimensões, leve, offline, sem API key)
- **Runtime:** Node.js ≥ 18 (disponível em qualquer máquina com npx)

### Schema do Banco

```sql
-- schema.sql
CREATE TABLE IF NOT EXISTS knowledge (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  path        TEXT    NOT NULL,
  content     TEXT    NOT NULL,
  category    TEXT    NOT NULL CHECK(category IN ('bugs','architecture','patterns','failures')),
  agent       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vec USING vec0(
  embedding float[384]
);
```

### Scripts

**`scripts/capture.ts`** (substitui o conceito de "summarize")
- Input: transcript do agent (`--mode=agent`) ou sessão completa (`--mode=session`)
- **100% local, sem API externa**
- Divide o transcript em chunks por turno de conversa / chamada de ferramenta (máx 300 tokens por chunk)
- Usa `@xenova/transformers` — pipeline `zero-shot-classification` com modelo `Xenova/nli-deberta-v3-small` para classificar cada chunk em uma das 4 categorias:
  - `bugs` — bugs resolvidos com causa raiz identificada
  - `architecture` — decisões de arquitetura e o porquê
  - `patterns` — padrões Delphi adotados/validados
  - `failures` — o que não funcionou e por quê
- Salva chunks classificados em `knowledge/local/YYYY-MM-DD-{agent-slug}.md`
- Chama `embed.ts` em seguida (pipeline assíncrono)

**`scripts/embed.ts`**
- Input: arquivo `.md` gerado pelo summarize
- Divide em chunks de 250 tokens com overlap de 50
- Gera embedding de cada chunk com `all-MiniLM-L6-v2` (via `@xenova/transformers`)
- Insere em `rag.db` (tabela `knowledge` + `knowledge_vec`)

**`scripts/search.ts`**
- Input: prompt atual (stdin via hook `UserPromptSubmit`) + agent ativo
- Gera embedding do prompt
- Busca top-3 chunks por similaridade cosseno no `knowledge_vec`
- Prioriza chunks com `agent` igual ao agent ativo
- Retorna texto formatado para injeção no contexto

**`scripts/build-rag.ts`**
- Lê todos os `knowledge/**/*.md` (core + fmx + community)
- Limpa e reconstrói `rag.db` do zero
- Usado pelo CI e pelo `npx delphi-dev sync-kb`

### Hooks Registrados

```json
{
  "hooks": {
    "SubagentStop": [{
      "matcher": "*",
      "hooks": [{"type": "command", "command": "node ~/.claude/plugins/delphi-dev/scripts/capture.js --mode=agent"}]
    }],
    "Stop": [{
      "matcher": "*",
      "hooks": [{"type": "command", "command": "node ~/.claude/plugins/delphi-dev/scripts/capture.js --mode=session"}]
    }],
    "UserPromptSubmit": [{
      "matcher": "*",
      "hooks": [{"type": "command", "command": "node ~/.claude/plugins/delphi-dev/scripts/search.js"}]
    }],
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{"type": "command", "command": "node ~/.claude/plugins/delphi-dev/hooks/fix-encoding.js"}]
    }]
  }
}
```

O installer registra esses hooks em `~/.claude/settings.json` na instalação.

### Fluxo Comunitário (`/contribute-kb`)

```
1. /contribute-kb
2. Agent lê knowledge/local/*.md dos últimos 30 dias
3. Remove dados sensíveis (paths locais, nomes de clientes, IPs)
4. Gera PRs separados por categoria (core, fmx, community)
5. Abre PR no GitHub com título padronizado: "kb: add {N} learnings from community"
6. Autor faz review e merge
7. GitHub Action detecta push em knowledge/** → roda build-rag.ts
8. rag.db atualizado sobe como asset da nova GitHub Release
9. Próximo npx delphi-dev update baixa o rag.db atualizado
```

---

## Installer: `npx delphi-dev`

### Publicação npm

Pacote: `delphi-dev` no npm registry.
Entry point: `installer/index.ts` compilado para `installer/dist/index.js`.

### Comandos

```bash
npx delphi-dev                  # alias para install
npx delphi-dev install          # instalação completa
npx delphi-dev update           # atualiza plugin + rag.db
npx delphi-dev sync-kb          # baixa rag.db mais recente da última Release
npx delphi-dev verify           # verifica se plugin está ativo no Claude Code
npx delphi-dev contribute       # empacota knowledge/local e abre PR
npx delphi-dev uninstall        # remove plugin e limpa settings.json
```

### Fluxo de `install`

```
Pré-requisitos
  ✓ Node.js ≥ 18
  ✓ Claude Code CLI (claude --version)
  ? VS Code + Claude Code extension (opcional, avisa se ausente)
  ? git (necessário para /contribute-kb, avisa se ausente)

Download
  → Se npm package: assets bundlados no pacote
  → Se --from-git: git clone https://github.com/adrianosantostreina/delphi-dev ~/.claude/plugins/delphi-dev

Registro do plugin
  → claude plugin install ~/.claude/plugins/delphi-dev
  → Verifica se plugin aparece em claude plugin list

RAG
  → Baixa rag.db da última GitHub Release (GitHub API: /releases/latest)
  → Salva em ~/.claude/plugins/delphi-dev/rag/rag.db

VS Code Extension
  → Se VS Code detectado: code --install-extension adrianosantos.delphi-dev-vscode
  → Se não: avisa URL do Marketplace

Hooks
  → Lê ~/.claude/settings.json (ou cria se não existir)
  → Adiciona bloco "hooks" com SubagentStop, Stop, UserPromptSubmit, PostToolUse
  → Não sobrescreve hooks existentes do usuário

Verificação final
  → claude plugin list | grep delphi-dev
  → Imprime resumo: ✅ Plugin ativo | ✅ RAG pronto (N docs) | ✅ VS Code | ✅ Hooks
```

---

## Rules: Regras Delphi Estruturadas

Seis arquivos em `rules/` carregados pelo skill `delphi-standards` e injetados no contexto de cada agent via `plugin.json`:

### `rules/naming.md`
Prefixos obrigatórios: `F` (field), `A` (parameter), `L` (local variable), `C_` (constant), `T` (type), `I` (interface), `E` (enum). Nomes de classes, interfaces, métodos, eventos. Exemplos corretos e incorretos.

### `rules/architecture.md`
SOLID aplicado a Delphi. Camadas: Model / Service / Repository / Presentation. Interfaces para tudo que pode variar. Constructor injection. Sem `GlobalContainer` exposto. Uma responsabilidade por classe.

### `rules/forbidden.md`
Proibido sem exceção: `with`, `Break`, `Continue`, `Real`, `const` em parâmetros interface (ARC), SQL por concatenação, `ShowMessage` em produção, `Exit` no meio de método. Cada regra com exemplo do erro e da solução.

### `rules/legacy.md`
Ao trabalhar em código legado: (1) não quebrar o que funciona, (2) modernizar apenas o escopo da tarefa, (3) extrair interfaces antes de substituir implementações, (4) adicionar testes antes de refatorar, (5) documentar decisões de não-modernização com `// LEGACY:`.

### `rules/security.md`
SQL sempre parametrizado (`TFDQuery.Params`). Validação de input no boundary. Sem hardcode de credenciais. HTTPS obrigatório em produção. Certificate validation nunca desativada em produção.

### `rules/testing.md`
DUnitX. Nomenclatura `Test_{Metodo}_{Cenario}`. Padrão AAA (Arrange/Act/Assert). Sem mocks de banco (integração com SQLite). Um assert por teste. Cobertura mínima de happy path + edge case principal.

---

## Skills: Novas e Melhoradas

### Novas Skills

#### `delphi-encoding` (Fase 1 roadmap)
- **Trigger:** qualquer `.pas/.dfm/.dpr/.dpk/.inc/.fmx` + menções a "encoding", "BOM", "acentos", "mojibake"
- **Conteúdo:** `knowledge/core/encoding-utf8-bom.md` + explicação do hook PostToolUse
- **Bilíngue:** pt-BR + en-US

#### `delphi-fmx` (Fase 2 roadmap)
- **Trigger:** `.fmx`, FireMonkey, Android, iOS, mobile, FMX no código
- **Conteúdo:** todos os 13 arquivos de `knowledge/fmx/` via `references/`
- **Bilíngue:** pt-BR + en-US para cada reference

#### `delphi-build` (Fase 4 roadmap)
- **Trigger:** `.dproj/.dpr/.dpk`, "compilar", "build", "msbuild", "dcc32", "erro de compilação"
- **Conteúdo:** `knowledge/core/build-via-bat-com-log.md` + references de parsing de erros
- **Bilíngue:** pt-BR + en-US

#### `delphi-spring4d` (Fase 3 roadmap)
- **Trigger:** `Spring.`, `TContainer`, `[Inject]`, `Lazy<T>`, "injeção de dependência", "IoC"
- **Conteúdo:** `knowledge/core/spring4d-di.md` (novo) com Register/Build/Resolve, lifetimes, anti-patterns
- **Bilíngue:** pt-BR + en-US

#### `delphi-firedac`
- **Trigger:** `TFDQuery`, `TFDConnection`, `TFDTable`, FireDAC, "connection pool", "memory leak query"
- **Conteúdo:** `knowledge/core/firedac-registro-drivers.md` + novo `firedac-patterns.md`
- **Bilíngue:** pt-BR + en-US

#### `delphi-acbr`
- **Trigger:** ACBr, NFe, NFCe, boleto, CTe, SPED, SAT
- **Conteúdo:** `knowledge/core/acbr-nfce-integracao.md` + novo `acbr-patterns.md`
- **Bilíngue:** pt-BR + en-US

#### `delphi-async`
- **Trigger:** `TTask`, `TParallel`, `IFuture`, `TThread`, `Synchronize`, `Queue`, "assíncrono", "thread"
- **Conteúdo:** novo `knowledge/core/delphi-async.md` (TTask/ITask/TParallel, cancelamento, Synchronize vs Queue, deadlock)
- **Bilíngue:** pt-BR + en-US

#### `delphi-legacy`
- **Trigger:** "legado", "antigo", "modernizar", "migrar", código com `String[N]`, `Real`, `TStringList` como hash
- **Conteúdo:** `rules/legacy.md` + RAG search para padrões de modernização
- **Bilíngue:** pt-BR + en-US

### Skills Melhoradas

#### `delphi-standards` (melhorado)
- Passa a carregar `rules/` completo em vez de só as references de `skills/delphi-standards/references/`
- Adiciona referências cruzadas com a KB (`knowledge/core/`)

#### `delphi-tests` (melhorado)
- Integra com `delphi-build`: após gerar testes, instrui o usuário a rodar `/build --tests`
- Carrega `rules/testing.md` automaticamente

#### `delphi-claudeignore` (melhorado)
- Adiciona `build_log.txt`, `test_log.txt`, `compile_output.txt`, `rag.db` ao deny-list automático

---

## Agents: Novos e Melhorados

### Novos Agents

#### `delphi-builder` (Fase 4)
Subagente de compilação e validação.

**Responsabilidades:**
1. Varre `C:\Program Files (x86)\Embarcadero\Studio\*\bin\rsvars.bat` para detectar Studios instalados
2. Se múltiplos: pergunta ou usa `.delphi-dev.json` com `"studio": "23.0"`
3. Gera `build.bat` se não existir (template de `knowledge/core/build-via-bat-com-log.md`)
4. Executa via `cmd.exe /c "<abs>\build.bat"`
5. Lê `build_log.txt` com a ferramenta `Read`
6. Parseia erros: `E2003` (identificador não declarado), `E2065` (unit faltando), `F2613` (unit não encontrada)
7. Mapeia erros para units faltantes usando catálogo em `knowledge/core/build-via-bat-com-log.md`
8. Sugere ou aplica fix (com flag `--auto-fix`)
9. Loop: recompila até `BUILD OK` ou limite de 3 tentativas
10. **Fallback se nenhum Studio encontrado:** avisa com mensagem clara; não falha silenciosamente. Solução: instalar RAD Studio ou criar `.delphi-dev.json` com `"studio": "23.0"`

**Flags suportadas:**
- `--release` — Config=Release
- `--plat=Android64` — cross-compile mobile
- `--auto-fix` — aplica correções automáticas
- `--tests` — compila e roda DUnitX

#### `delphi-migrator`
Subagente para análise e plano de modernização de código legado.

**Responsabilidades:**
1. Analisa o projeto e classifica o nível de legado (1–5)
2. Identifica: tipos obsoletos (`Real`, `String[N]`, `AnsiString`), encoding ANSI, `with`, `Break`/`Continue`, ausência de interfaces, SQL concatenado
3. Gera plano de migração priorizado por impacto × risco
4. Cria tarefas incrementais para modernização sem quebrar funcionalidade

### Agents Melhorados

#### `delphi-writer` (melhorado)
- Após entregar uma classe, opcionalmente aciona `delphi-builder` para validar compilação
- Carrega `rules/` completo antes de gerar código
- Sugere registro em `Bootstrap.pas` quando Spring4D está ativo no projeto

#### `delphi-auditor` (melhorado)
- Nova dimensão de auditoria: **"Compilabilidade"** — projeto compila limpo? Quantos warnings?
- Nova dimensão: **"Inversão de Controle"** — detecta `TXXX.Create` direto vs injeção via interface
- Carrega RAG para enriquecer diagnósticos com aprendizados comunitários

#### `delphi-tester` (melhorado)
- Após gerar testes, aciona `delphi-builder --tests` automaticamente
- Carrega `rules/testing.md` e `knowledge/core/dunitx-patterns.md`

---

## Commands: Novos e Melhorados

### Novos Commands

#### `/build`
```
/build                    → detecta .dproj na raiz, compila Debug/Win32
/build --release          → Config=Release
/build --plat=Android64   → cross-compile mobile
/build --auto-fix         → delega ao delphi-builder com correção automática
/build --tests            → compila e roda DUnitX
```
Aciona o agent `delphi-builder`.

#### `/refactor`
Refatora código Delphi respeitando idiomas Pascal:
- Extract method: extrai bloco para método privado com nome descritivo
- Remove `with`: substitui por variável local tipada
- Rename com prefixos: renomeia identificadores para seguir `rules/naming.md`
- Não muda lógica, só estrutura

#### `/migrate`
Aciona `delphi-migrator` para análise de legado e geração de plano de modernização.
```
/migrate                  → analisa projeto inteiro
/migrate --file @Unit.pas → analisa unit específica
/migrate --dry-run        → só mostra o que faria, sem editar
```

#### `/contribute-kb`
Empacota `knowledge/local/*.md` dos últimos 30 dias, remove dados sensíveis e abre PR no GitHub.
```
/contribute-kb            → modo interativo, usuário confirma antes do PR
/contribute-kb --dry-run  → mostra o que seria enviado sem criar PR

**Edge case:** se `knowledge/local/` estiver vazio ou sem arquivos nos últimos 30 dias, o command informa que não há novos aprendizados para contribuir e sugere usar o plugin em sessões Delphi para gerar conteúdo.
```

### Commands Melhorados

#### `/new-project` (melhorado com mobile FMX)
Pergunta adicional quando tipo = FMX:
- Plataformas alvo (Windows / Android / iOS / macOS)
- Orientação (Portrait / Landscape / Both)
- Banco local (SQLite via FireDAC)?
- Permissões necessárias (câmera, GPS, storage)?

Estrutura mobile gerada:
```
NomeApp/
├── src/
│   ├── model/
│   ├── interfaces/
│   ├── service/
│   ├── repository/
│   └── presentation/forms/ + frames/
├── assets/
├── resources/
├── tests/
└── NomeApp.dproj
```

Usa `knowledge/fmx/` para gerar: form com dimensões corretas (400×750), unit names sem pontos (Android), uses corretos FMX/FireDAC, DataModule com registro de drivers.

#### `/about` (bump v2.0)
Atualiza versão para 2.0 e lista todas as novas features.

---

## VS Code Integration (`packages/vscode/`)

### Migração
O conteúdo atual do repo `delphi-dev-vscode` é movido para `packages/vscode/`. O repo original é arquivado no GitHub com nota apontando para o monorepo.

### O que muda na v2.0

1. **Versão sincronizada** — `packages/vscode/package.json` versão sempre igual ao `plugin.json`
2. **Novos comandos no tree view** — `/build`, `/refactor`, `/migrate`, `/contribute-kb`
3. **Status bar melhorado** — mostra versão do plugin + indicador "RAG ativo (N docs)"
4. **WebView de aprendizados** — painel lateral que lista os últimos `knowledge/local/*.md` capturados

### Publicação no Marketplace

`.github/workflows/publish-vscode.yml`:
- Trigger: bump de versão em `packages/vscode/package.json` na branch `main`
- Steps: `npm ci`, `vsce package`, `vsce publish`
- Requer secret `VSCE_TOKEN` configurado no GitHub repo

O npx installer verifica se a extensão está instalada via `code --list-extensions` e instala do Marketplace se disponível, ou do `.vsix` bundlado caso contrário.

---

## Configuração `.delphi-dev.json`

Arquivo opcional na raiz do projeto do usuário para personalizar comportamento:

```json
{
  "studio": "23.0",
  "default_config": "Debug",
  "default_platform": "Win32",
  "build_log": "build_log.txt",
  "auto_fix": false,
  "encoding_mode": "utf8-bom",
  "legacy_mode": false
}
```

---

## Mapa de Versões e Critérios de Release

| Versão | O que entra | Critério de release |
|--------|-------------|---------------------|
| **2.0** | Monorepo + npx installer + VS Code Marketplace + plugin.json com hooks declarados | `npx delphi-dev` funciona end-to-end em máquina limpa |
| **2.1** | RAG completo (SQLite-vec + todos os hooks + CI build-rag) + `/contribute-kb` | Hook UserPromptSubmit injeta contexto real no prompt |
| **2.2** | KB migrada (25 core + 13 FMX) + `rules/` completo + skills: encoding, fmx, legacy, firedac, acbr, async | `/new-project` gera scaffold FMX mobile correto |
| **2.3** | Fase 1 roadmap (encoding UTF-8 BOM hook ativo) + Fase 4 (delphi-builder + `/build`) | Hook de encoding funciona + `/build --tests` compila e roda DUnitX |
| **2.4** | Spring4D completo (skill + integração writer/auditor/tester) + delphi-async | `/write` sugere injeção via interface quando Spring4D detectado |
| **2.5** | `/refactor` + `/migrate` + `delphi-migrator` + agents melhorados | Projeto legado recebe plano de migração via `/migrate` |
| **2.6** | VS Code: diagnósticos inline + WebView RAG + Marketplace auto-publish via CI | Extensão publicada no Marketplace; warnings inline em `.pas` |
| **2.7** | Sugestões aprovadas: `/installer` (Inno Setup), `delphi-livebindings`, `delphi-rest-horse`, `delphi-mocks`, `delphi-doc` | Feature-complete v2 |

---

## Plano de Testes

### Por versão

#### v2.0 — Testes de instalação
- [ ] `npx delphi-dev install` em máquina Windows limpa (sem plugin anterior)
- [ ] `npx delphi-dev install` em máquina com plugin v1.5.0 instalado (upgrade)
- [ ] Verificar `claude plugin list` mostra `delphi-dev`
- [ ] Verificar extensão VS Code instalada e ativa
- [ ] Verificar hooks em `~/.claude/settings.json`
- [ ] `npx delphi-dev verify` retorna sucesso
- [ ] `npx delphi-dev uninstall` limpa tudo

#### v2.1 — Testes do RAG
- [ ] SubagentStop hook dispara após sessão com `delphi-writer`
- [ ] `knowledge/local/` recebe arquivo `.md` com 4 categorias preenchidas
- [ ] `embed.ts` insere chunks no `rag.db`
- [ ] `search.ts` retorna top-3 chunks para prompt de teste
- [ ] UserPromptSubmit injeta chunks no contexto (verificável via `/rag-status`)
- [ ] `npx delphi-dev sync-kb` baixa `rag.db` da última Release
- [ ] CI build-rag.yml roda após push em `knowledge/`

#### v2.2 — Testes de knowledge e skills
- [ ] Skill `delphi-fmx` ativa ao abrir projeto com `.fmx`
- [ ] Skill `delphi-encoding` ativa ao abrir `.pas` sem BOM
- [ ] `rules/forbidden.md` citado pelo writer ao tentar usar `with`
- [ ] `/new-project` tipo FMX faz perguntas sobre plataforma e gera estrutura mobile

#### v2.3 — Testes de build
- [ ] Hook PostToolUse injeta BOM em arquivo `.pas` criado via `Write`
- [ ] `/build` detecta Studio instalado e gera `build.bat` se ausente
- [ ] `/build --tests` compila e exibe resultado do DUnitX
- [ ] `/build --auto-fix` corrige `E2003` por unit faltante e recompila

#### v2.6 — Testes de VS Code
- [ ] Warnings inline para `with` em arquivo `.pas` aberto
- [ ] WebView lista últimos aprendizados
- [ ] Status bar mostra versão e RAG status
- [ ] Extensão disponível via busca "Delphi Dev" no Marketplace

### Testes de regressão (rodar a cada release)
- [ ] `/audit` em projeto de exemplo gera laudo com 8 dimensões
- [ ] `/write` gera classe com prefixos corretos
- [ ] `/tdd` gera `TesteXxx.pas` com DUnitX
- [ ] `/spec` gera SPEC com todos os requisitos
- [ ] `/about` mostra versão correta
- [ ] Skill `delphi-standards` ativa em qualquer `.pas`

---

## Dependências Externas

| Dependência | Uso | Risco |
|-------------|-----|-------|
| `@xenova/transformers` | Embeddings MiniLM (all-MiniLM-L6-v2) + zero-shot classification (nli-deberta-v3-small) — 100% offline, sem API | Pacote grande (~150MB com ambos os modelos); baixado uma vez no install e cacheado |
| `better-sqlite3` | Interface SQLite + sqlite-vec | Binário nativo; precisa de build por plataforma |
| `sqlite-vec` | Extensão vetorial do SQLite | Binário nativo; distribuir pre-built para Win/macOS/Linux |
| `@vscode/vsce` | Publicação no Marketplace | Requer conta Publisher ativa + PAT token |
| GitHub Actions | CI build-rag + publish-vscode | Requer secrets: `NPM_TOKEN`, `VSCE_TOKEN`, `GITHUB_TOKEN` |

---

## Configuração de Secrets Necessária (GitHub)

| Secret | Uso |
|--------|-----|
| `NPM_TOKEN` | Publicar pacote `delphi-dev` no npm registry |
| `VSCE_TOKEN` | Publicar extensão no VS Code Marketplace |
| `GITHUB_TOKEN` | Criar GitHub Releases e upload de assets (já disponível no Actions) |
| ~~`ANTHROPIC_API_KEY`~~ | **Não necessário** — toda IA roda localmente via `@xenova/transformers` |

---

## Invariantes do Plugin (não mudam)

- Todo código Delphi gerado usa prefixos `F/A/L/C_/T/I/E`
- Proibido: `with`, `Break`, `Continue`, `Real`, `const` em params ARC
- SQL sempre parametrizado
- Um resource por `try..finally`
- Output bilíngue: pt-BR (padrão) + en-US (detectado automaticamente)
- Templates em pt-BR têm arquivo `.en.md` espelho
- As 4 versões em sync: `plugin.json`, `marketplace.json`, `commands/about.md`, `README.md/README.pt-BR.md`

---

## Fora do Escopo v2.x

- LSP completo para Delphi (requer parser Pascal — escopo separado)
- Diagnósticos inline no VS Code com regex (falsos positivos em strings/comentários — adiado para v3.x)
- Debugger integration no VS Code
- Geração de instaladores `.exe` (Inno Setup é v2.7, não v2.0)
- Suporte a Free Pascal / Lazarus
- Integração com sistemas de CI externos (Jenkins, TeamCity)
