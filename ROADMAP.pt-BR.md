# Roadmap — delphi-dev

> 🇺🇸 [Read in English](ROADMAP.md)

Este documento descreve a evolução planejada do plugin **delphi-dev**. Ele existe para que contribuidores e usuários possam ver o que está por vir, votar em prioridades (via issues no GitHub) e propor novas direções.

**Legenda de status:**
- ⏸️ Planejado — combinado, ainda não iniciado
- 🔨 Em andamento — sendo implementado
- ✅ Pronto — entregue em release
- 💭 Ideia — em discussão, ainda não decidido

**Última atualização:** 2026-04-29

---

## Visão

Tornar o Claude Code um parceiro real e opinativo de desenvolvimento Delphi — um que:

1. **Conhece a linguagem e o ecossistema.** Idiomas Object Pascal, VCL/FMX, FireDAC, Spring4D, versões do RAD Studio, nuances da RTL.
2. **Valida a própria saída.** Código gerado pelo plugin deve compilar e passar nos testes automaticamente — não apenas parecer correto.
3. **Fala o idioma do usuário.** Bilíngue (pt-BR / en-US) por padrão, com paridade em templates, labels e notificações.
4. **Sai do caminho até ser útil.** Auto-ativação somente em arquivos Delphi; nunca em projetos sem relação.

---

## Matriz de prioridade

| # | Item | Versão alvo | Status |
|---|---|---|---|
| 1 | Encoding UTF-8 ↔ ANSI (hook automático) | v1.6.0 | ⏸️ Planejado |
| 2 | Mobile FMX em `/new-project` + skill `delphi-fmx` | v1.7.0 | ⏸️ Planejado |
| 3 | Spring4D (skill + integração com `/write` e `/audit`) | v1.8.0 | ⏸️ Planejado |
| 4 | Build & Validação (skill `delphi-build` + agente `delphi-builder` + `/build`) | v1.9.0 (ou antes) | ⏸️ Planejado |

> A ordem entre a Fase 4 e as Fases 2/3 está **em aberto** — a Fase 4 (build) é forte candidata a subir para v1.6.x porque destrava validação real de tudo que é gerado por `/write`, `/tdd` e `/new-project`.

---

## Fase 1 — Encoding UTF-8/ANSI (v1.6.0)

### Problema
O Claude Code escreve arquivos `.pas` / `.dfm` / `.dpr` / `.inc` / `.fmx` como **UTF-8 sem BOM**. Versões pré-XE2 do Delphi tratam esses arquivos como ANSI/CP1252 e produzem mojibake (`Ã¡`, `Ã§`). RAD Studio moderno usa detecção heurística, que falha em arquivos com poucos caracteres acentuados.

### Solução
Hook `PostToolUse` que injeta um BOM UTF-8 (`EF BB BF`) nos arquivos Delphi assim que o Claude escreve ou edita. Modo legado opcional converte para CP1252 em projetos pré-XE2.

### Entregáveis
- Hooks multiplataforma: `hooks/fix-delphi-encoding.ps1` (Windows) e `hooks/fix-delphi-encoding.sh` (Linux/macOS)
- Nova skill `delphi-encoding` explicando BOM, `{$CODEPAGE}` e comportamento de encoding em `LoadFromFile`/`SaveToFile`
- Arquivo de configuração `.delphi-dev.json` com `encoding_mode: "utf8-bom" | "cp1252"`
- Registro do hook no `plugin.json`

### Questões em aberto
- Modo padrão: `utf8-bom` (recomendado para XE2+) ou auto-detecção a partir dos arquivos existentes?

---

## Fase 2 — Mobile FMX em `/new-project` + skill `delphi-fmx` (v1.7.0)

### Parte A — Skill `delphi-fmx`
Hoje, a base de conhecimento FireMonkey (notação de cores, dimensões mobile, deployment, registro de drivers FireDAC, IMEI/device ID, SSL/TLS no Android, etc.) vive somente na máquina do mantenedor. A Fase 2A leva esse conhecimento para o plugin para que todos os usuários se beneficiem.

### Parte B — Sincronização da base
Um script `scripts/sync-fmx-kb.ps1` copia os arquivos canônicos da base FMX para `skills/delphi-fmx/references/` antes de cada release. A base local permanece como source of truth; o plugin publica um snapshot.

### Parte C — Suporte mobile em `/new-project`
Estender `/new-project` para perguntar:
- Plataformas alvo (Windows / Android / iOS / macOS / Linux)
- Para mobile: orientação, banco local (SQLite + FireDAC), permissões, push notifications, splash e ícones
- Gerar forms com `ClientWidth = 400` / `ClientHeight = 750` corretos
- Nomes de unit sem pontos (requisito do `ld.lld` no Android)
- DataModule com registro explícito de drivers FireDAC + `ConsoleUI.Wait`
- Deployment pré-configurado para assets (Android `.\assets\internal\`, iOS `StartUp\Documents\`)

### Entregáveis
- `skills/delphi-fmx/SKILL.md` + 13 arquivos de referência (bilíngues: 26 arquivos)
- `scripts/sync-fmx-kb.ps1` com `--dry-run`
- Fluxo estendido de `/new-project` para FMX mobile

---

## Fase 3 — Spring4D (v1.8.0)

### Objetivo
Ensinar o Claude a reconhecer e gerar código que usa **Spring4D** para Inversão de Controle / Injeção de Dependência — registro, lifetimes, constructor injection, resolução lazy, registros nomeados.

### Entregáveis
- `skills/delphi-spring4d/SKILL.md` + documentos de referência cobrindo o ciclo Register → Build → Resolve, lifetimes (Singleton, Transient, SingletonPerThread), injeção via construtor vs `[Inject]`, `Lazy<T>`, registros nomeados e anti-padrões (ex.: evitar `GlobalContainer`)
- Atualizações no `delphi-writer` (services e repositories sugerem registro em `Bootstrap.pas`)
- Nova dimensão de auditoria no `delphi-auditor`: **Inversão de Controle**
- Atualização do `delphi-tester` com padrões de mock baseados em container

---

## Fase 4 — Build & Validação (v1.9.0, candidata a antecipação)

### Problema
Hoje o plugin gera código Delphi, mas não consegue **validar que o código compila**. Capturar `stdout` do `msbuild` / `dcc32` direto pelo Bash ou PowerShell é frágil em Windows: encoding misto, buffer truncado, `cmd.exe /c` não herda o cwd.

### Solução
Três componentes coordenados:

#### A) Skill `delphi-build`
Auto-ativa em `.dproj` / `.dpr` / `.dpk`. A base de conhecimento cobre versões do RAD Studio (Studio 22.0 / 23.0 / 37.0 → Delphi 11 / 12 / 13), o mecanismo do `rsvars.bat`, trade-offs entre `msbuild` e `dcc32`, o template `.bat` que redireciona saída para log, e um catálogo de erros do compilador mapeado para units faltando no `uses`.

#### B) Agente `delphi-builder`
1. Detecta Studios instalados (varre `C:\Program Files (x86)\Embarcadero\Studio\*\bin\rsvars.bat`)
2. Escolhe o correto (ou honra `studio` em `.delphi-dev.json`)
3. Gera `build.bat` se ausente (template da skill)
4. Executa via `cmd.exe /c '"<abs>\build.bat" 2>&1'`
5. Lê `build_log.txt` com a tool `Read` (não confia no `stdout`)
6. Parseia erros de compilação (`E2003`, `E2065`, `F2613`)
7. Sugere fix do catálogo de erros ou abrindo o arquivo problemático
8. Loop opcional `--auto-fix`: aplica, recompila, repete até sucesso ou limite

#### C) Comando `/build`
```
/build                    # Debug / Win32, repo atual
/build --release          # Config=Release
/build --plat=Android64   # cross-compile mobile
/build --auto-fix         # delega ao agente com correção automática
/build --tests            # compila + roda suite DUnitX
```

### Integração com features existentes
- `/write` — pré-validação opcional antes de devolver código ao usuário
- `/tdd` — efetivamente compilar e rodar os testes gerados
- `/audit` — nova dimensão "Compilabilidade"
- `delphi-claudeignore` — adicionar `build_log.txt` / `test_log.txt` automaticamente ao deny-list

### Questões em aberto
- Detectar Studio automaticamente e perguntar se houver múltiplas versões, ou exigir `.delphi-dev.json` declarado? (Proposta padrão: auto-detectar, perguntar somente em caso de conflito)
- Entregar `--auto-fix` na primeira release ou em release seguinte?

---

## Ideias adicionais — aprovadas, prioridade a definir

| Skill / Comando | Por que vale | Esforço |
|---|---|---|
| `delphi-firedac` | Dor universal — memory leak em TFDQuery, params, transações, BulkInsert | Médio |
| `delphi-acbr` | Audiência BR massiva — NFe, NFCe, boletos, CTe | Médio |
| `delphi-async` | Delphi moderno depende de TTask/ITask/TParallel; cancelamento, Synchronize/Queue | Baixo-médio |
| `/refactor` | Refactor consciente de Pascal: extract method, rename respeitando prefixos, remoção de `with` | Médio |
| `delphi-doc` | Comentários HelpInsight em interfaces e métodos públicos (em lote ou por arquivo) | Baixo |
| `delphi-mocks` | Integra `Delphi.Mocks` com `delphi-tester` (combina com Spring4D) | Baixo |
| `delphi-migrate` | Modernização: ANSI→Unicode, `String[N]`→`string`, `Real`→`Double`, RAD2007→11/12 | Alto |
| `/installer` | Gera scripts Inno Setup a partir do `.dproj` (saídas, DLLs, BPLs) | Médio |
| `delphi-livebindings` | Padrões LiveBindings FMX (listas, BindSourceDB, navigator) — combina com Fase 2 | Médio |
| `delphi-rest-horse` | Scaffold REST API com Horse (rotas, middleware, JWT, JSON) — audiência BR | Médio |

### Top 3 sugeridos pós-Fases 1–4
1. `delphi-firedac` — universal, ROI altíssimo
2. `delphi-async` — Delphi moderno é assíncrono
3. `delphi-acbr` — diferencial competitivo para usuários BR

---

## Como contribuir

Aceitamos:

- **Solicitações de feature** — abra uma issue descrevendo o caso de uso
- **Contribuições de conhecimento** — se você conhece uma armadilha do Delphi que merece estar na base de conhecimento do plugin, proponha via PR
- **Traduções** — ajude a manter paridade pt-BR / en-US nas referências de skills e templates
- **Reports de bug** — especialmente em torno de ativação do plugin, comportamento de hooks ou auto-detecção

Issues e discussão: https://github.com/adrianosantostreina/delphi-dev/issues

---

## Fora de escopo

Estes itens foram considerados e explicitamente **rejeitados** para manter o plugin focado:

- Suporte a dialetos Pascal além do Object Pascal (Free Pascal/Lazarus **não** é alvo — convenções divergem em pontos críticos)
- Integração com IDE além do que o sistema de plugins do Claude Code oferece (sem plugin para o RAD Studio)
- Refatoração automática de projetos legados (o comando `/audit` produz um **relatório**, não mutações autônomas)
- Geração de código que ignora o style guide Delphi (o valor do plugin é a disciplina; um "modo off" anularia isso)
