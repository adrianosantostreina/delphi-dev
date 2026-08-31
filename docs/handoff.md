# Handoff — delphi-dev

> Onde estamos e qual o próximo passo. Atualizado em **2026-08-30**.
> No início de uma nova sessão, ler este arquivo para retomar.

## Ponto de retomada (2026-08-30) — BRAINSTORM `delphi-e2e`: §5 APROVADA, §6 EM CURSO ⏸️

**Continuação direta do ponto de 2026-08-09.** O brainstorm do `/e2e` avançou: as seções 5.1–5.3
do design foram **aprovadas** e as 6.1–6.3 **aceitas**. Ainda não há código — só docs.

- **ESTADO COMPLETO em [`docs/superpowers/specs/2026-08-09-delphi-e2e-design.md`](superpowers/specs/2026-08-09-delphi-e2e-design.md)**
  (agora com §9 = cronologia desta sessão). **Ler por inteiro antes de retomar.**
  São **14 decisões travadas** na §4 — **não refazer as perguntas.**

- **Três decisões novas desta sessão:**
  - **12 — Agente CORTADO.** Entrega = **skill + command + entrada no RAG**, sem agente novo.
    A decisão 8 (execução no contexto principal) esvaziava o agente executor. **Substitui
    formalmente a decisão 7** ("skill + agente + comando"), que era pré-reframe.
  - **13 — Quatro vereditos:** ✅ PASSOU · ❌ FALHOU (o app está errado) · ⛔ BLOQUEADO (não deu
    para executar) · ⏭️ PULADO (grava dados, não autorizado no gate). O ⛔ existe para não
    acusar bug onde só houve contaminação de estado entre cenários.
  - **15 — Janela em primeiro plano é PARÂMETRO** (default: primeiro plano; flag para rodar ao
    fundo). Sai barato porque, com `PostMessage`/`WM_CHAR`, a automação **nunca precisou de
    foco** — trazer a janela à frente é ato puramente cosmético, um `SetWindowPos` a mais.
    Um só caminho de código, e nenhum dos dois modos rouba digitação.
  - **14 — Isolamento entre cenários:** navegar de volta pela UI (`Cancelar`/`Voltar`/`Esc`),
    conferindo pelo screenshot; após **2 tentativas** sem sucesso, **matar o processo e reabrir
    o `.exe`**. Reiniciar sempre foi descartado (custo de splash/banco + perde estado de sessão).

- **§6.1–6.3 aceitas:** descoberta do log (usuário → `config.ini` → `*.log` no dir do `.exe` →
  degrada para veredito visual **declarado**), delta por byte offset, instrumentação **oferecida
  e nunca imposta**, e as 7 regras de segurança reescritas (a chave: *nunca gravar por
  iniciativa própria* — a regra original inviabilizava "testa se a venda finaliza").

- **PRÓXIMO PASSO CONCRETO:**
  1. Apresentar **§6.4–6.7** (armadilhas técnicas herdadas, relatório bilíngue, guarda
     Windows-only, versionamento 3.0.0 → 3.1.0). São mecânicas — cabem num bloco só.
  2. Decidir **§6.8** — persistência de cenários em `docs/e2e/*.md` como suíte de regressão.
     Única pergunta de escopo que resta. Proposta original: fora do v1.
  3. Promover o design a spec aprovada, auto-revisão, revisão do usuário.
  4. **Só então** invocar `writing-plans`. É o terminal do `superpowers:brainstorming` —
     nenhuma outra skill de implementação antes disso.

- **IDEIA NOVA registrada (fora do `/e2e`):** **métricas de adoção de IA no time** →
  [`docs/ideas/2026-08-30-ai-adoption-metrics.md`](ideas/2026-08-30-ai-adoption-metrics.md).
  Ver item 6 do backlog abaixo.

- **Sem alterações de código.** `master` **4 commits à frente do origin** — push segurado por
  política da sessão, o usuário decide quando.

## Ponto anterior (2026-08-09) — brainstorm `delphi-e2e` iniciado (interrompido)

**Nova capacidade em desenho: `/e2e` — Playwright para desktop Delphi.** Executor de cenários
de teste end-to-end que builda, abre o `.exe` e opera as telas, com veredito por cenário e
correlação com o log do app. Nenhum código escrito ainda — só design.

- **ESTADO COMPLETO EM [`docs/superpowers/specs/2026-08-09-delphi-e2e-design.md`](superpowers/specs/2026-08-09-delphi-e2e-design.md).**
  Ler esse arquivo por inteiro antes de retomar — ele tem as 11 decisões já travadas com o
  usuário, o design apresentado, os achados de validação e o que falta. **Não refazer as
  perguntas**, elas já foram respondidas.
- **Onde parou:** brainstorming (`superpowers:brainstorming`) interrompido na aprovação das
  seções 1–3 do design. O usuário reiniciou a sessão antes de responder.
- **Próximo passo:** reapresentar §5.1–5.3 do design (com destaque para o **corte do agente** e
  os **quatro vereditos**), seguir para §6, promover a spec, e só então invocar `writing-plans`.
- **Fontes externas do conhecimento** (fora deste repo, ler ao retomar):
  - `D:\1. Exemplos Cursos\PDV Android\docs\automacao-ui-delphi-fmx.md` — documento completo (726 linhas)
  - `C:\Users\User\.claude\shared\delphi-knowledge\fmx-win32-janela-automacao-externa.md` — versão condensada
- **Correções de rota importantes desta sessão:** o propósito **não** é smoke test com galeria
  de screenshots (era o que o documento-fonte propunha) — é execução de cenários com veredito.
  E hooks continuam **OFF**, então entrada no RAG não injeta em sessão hoje; o que entrega
  capacidade é a skill + o command.
- **Sem alterações de código.** Só docs. `master` em `67970e2`, **2 commits à frente do origin** — push segurado por política da sessão, você decide quando.

## Ponto anterior (2026-07-01) — v3.0.0 ESTÁVEL PUBLICADA (push + release + rag.db) ✅

- **`master` PUSHADO** para `origin` (`84f3676`). A CI `build-rag.yml` rodou com sucesso (gatilho `knowledge/community/**`) e **criou o release `v3.0.0` como Latest** (não-draft, não-prerelease) **com `rag.db` anexado (1.73 MB)**. Instalações via `npx delphi-dev@latest` já pegam a KB nova. Estado verificado: 30 testes scripts + 10 testes installer verdes, builds limpos, versões do plugin sincronizadas em 3.0.0.
- **NÃO republicado no npm** (por design): o installer (`installer/package.json`) segue em **2.2.2** — a governança de RAG mexeu em `scripts/`, não no installer, e o `npx@2.2.2` baixa o `rag.db` do release `latest`. Só bumpar/republicar o installer se quiser que o `npx` anuncie 3.0.0.

- **PRÓXIMO PASSO ao retomar (escolher):**
  1. **Dedup completo no CI (Task 7b)** — follow-up natural do item 1 (`nearestDistance` pronto/testado; falta ligar contra o `rag.db` no PR). Ver backlog v3.0 abaixo.
  2. **Segurança pendente:** rotacionar o Granular Access Token do npm colado no chat (hotfix v2.2.2).

## Ponto anterior (2026-06-28) — v3.0 item 1 (Governança do RAG) FECHADO e MERGEADO (local, sem push)

- **Sprint v3.0, item 1 = Governança do RAG (Abordagem 1): CONCLUÍDO.** Brainstorm → spec → plano → implementação (subagent-driven, 9 tasks TDD) → revisão whole-branch (READY TO MERGE) → **merge `--no-ff` em `master`** (merge commit `97239d0`). Branch `feature/v3.0-rag-governance` já deletada. **30 testes verdes, build limpo, v3.0.0** sincronizada (plugin.json, marketplace.json, about.md). Hooks continuam **OFF**.
  - Spec: `docs/superpowers/specs/2026-06-25-rag-governance-design.md`. Plano: `docs/superpowers/plans/2026-06-25-v3.0-rag-governance.md`. Doc de governança: `docs/rag-governance.md`.
  - O que mudou no código: coluna `tier` no schema (`scripts/src/db.ts`); `tierForPath` no build deriva canonical(core/fmx)/community; `selectByTier` faz precedência por slot + piso `RELEVANCE_FLOOR=1.0`; `formatSearchResults` rotula `[tier/category]` + diretriz fixa; `scripts/src/validate-contribution.ts` (validadores frontmatter/tamanho + primitivo `nearestDistance`); workflow `.github/workflows/validate-community.yml`; WARNING de cap `COMMUNITY_CAP=500` no build; `knowledge/community/` criada (`.gitkeep` + `INDEX.md`).
  - **Segurança:** o review automático de commit pegou um **GitHub Actions injection (HIGH)** na workflow (paths de PR interpolados em `run:`). Corrigido antes do merge (commit `0c45e7a`): SHAs/lista via env vars + allowlist regex `^knowledge/community/[A-Za-z0-9._/-]+\.md$`.

- **PRÓXIMO PASSO CONCRETO ao retomar (em ordem):**
  1. **Push do `master`** (está só local — segura-se push por política da sessão; usuário decide quando). O push dispara a CI `build-rag.yml` porque `knowledge/community/` foi criada.
  2. **Após o push: confirmar o release v3.0.0** — a CI deve criar o release e anexar o `rag.db` (spec §7). Sem o asset, `npx delphi-dev` quebra. Verificar via `gh release list`.
  3. Decidir os demais itens da v3.0 (ver backlog abaixo) — recomendação: **dedup completo no CI (Task 7b)** é o follow-up natural do item 1.

- **Pendências que NÃO bloqueiam, mas seguem abertas:**
  - **Dedup no CI (Task 7b, deferido por design):** o primitivo `nearestDistance` está pronto e testado, mas ligá-lo contra o `rag.db` no PR (baixar rag.db do release + comparar embeddings) ficou para depois. Spec §8 / Task 7 do plano documentam.
  - **Higiene:** `scripts/dist/`, `hooks/dist/`, `package-lock.json` continuam untracked por design (candidatos a `.gitignore`).
  - **Segurança (do hotfix v2.2.2):** revogar/rotacionar o Granular Access Token do npm colado no chat — npmjs.com → Access Tokens.

## Estado atual (2026-06-22) — Bug da extensão VS Code: "Unknown language" (correção fica em OUTRO repo)

- **Sintoma:** usuário instalou a versão nova da extensão "Delphi Dev for Claude Code" e o Runtime Status do VS Code exibe 2 erros na ativação:
  ```
  Unknown language in contributes.delphi-dev-vscode.language. Provided value: pascal
  Unknown language in contributes.delphi-dev-vscode.language. Provided value: objectpascal
  ```
- **Causa raiz (diagnosticada nesta sessão):** o `package.json` da extensão **referencia** os language IDs `pascal` e `objectpascal` em 3 lugares — `activationEvents` (`onLanguage:pascal`/`objectpascal`), `contributes.snippets` e `contributes.configurationDefaults` (`[pascal]`/`[objectpascal]`) — mas **nunca os declara** via `contributes.languages`. No VS Code um language ID só existe se alguma extensão o registrar; sem extensão Pascal instalada, o VS Code emite "Unknown language". **Erros inofensivos** (não quebram a integração Claude Code), mas poluem o Runtime Status e impedem a associação de menus/snippets aos `.pas`.
- **Onde corrigir:** NÃO neste repo. A cópia em `packages/vscode/package.json` é só espelho; o **repositório dedicado da extensão** (`delphi-dev-vscode`, https://github.com/AdrianosantosTreina/delphi-dev-vscode) é o fonte de verdade. O usuário vai rodar a correção lá, em outra sessão.
- **Solução (a aplicar no repo da extensão):**
  1. Adicionar bloco `contributes.languages` declarando `pascal` (com `extensions: [.pas,.dpr,.dpk,.dfm,.fmx,.inc]` + `configuration: ./language-configuration.json`) e `objectpascal` **sem `extensions`** (evita dupla associação dos mesmos arquivos). Sem conflito se a extensão do alefragnani estiver instalada junto.
  2. Criar `language-configuration.json` (comentários `//` e `{ }`/`(* *)`, brackets, auto-closing de `'`).
  3. Bump de versão (patch) da extensão + CHANGELOG.
  4. Validar com `vsce package` / modo dev → Runtime Status sem os erros.
- **Status:** apenas diagnóstico + **prompt pronto** entregue ao usuário para colar na sessão do repo da extensão. Nenhuma alteração de código feita nesta sessão. O usuário pausou para **atualizar o VS Code**.
- **Próximo passo:** rodar o prompt no repo `delphi-dev-vscode`; depois, opcionalmente, sincronizar a mesma correção no espelho `packages/vscode/package.json` deste repo para não divergir.
- **Nota de versão:** a extensão tem versionamento próprio (`packages/vscode/package.json` → `2.0.0`), independente do plugin (`2.2.2`). Não confundir os dois ao bumpar.

## Estado anterior (2026-06-18) — HOTFIX v2.2.2 (instalação limpa no Windows)

- **v2.2.2 — patch de urgência, RELEASED (2026-06-18).** Usuários relataram falha de instalação no v2.x no Windows ("registro + hooks sem build"). Investigado e corrigido. **Commitado, pushado, release publicado e npm publicado** — ciclo completo.
  - Commit `73b9025` em `master` (pushado).
  - GitHub Release `v2.2.2` (latest) com `rag.db` anexado: https://github.com/adrianosantostreina/delphi-dev/releases/tag/v2.2.2
  - **npm: `delphi-dev@2.2.2` publicado como `latest`** (confirmado via `npm view delphi-dev version` → 2.2.2). `npx delphi-dev@latest` agora pega a versão corrigida.
  - **Detalhe do publish:** a conta exige 2FA; tokens clássicos/read-only davam E403. Resolvido com **Granular Access Token (read+write, bypass 2FA)** em `~/.npmrc`. **AÇÃO PENDENTE DE SEGURANÇA:** o token foi colado no chat durante a sessão — **revogar/rotacionar** em npmjs.com → Access Tokens.
- **Causa raiz (2 bugs, só no Windows / instalação limpa):**
  1. **Registro falha.** `installer/src/plugin.ts` usava `spawnSync('claude', …, {shell:false})`. No Windows o `claude` é shim `.cmd`/`.ps1`, não `.exe` → `CreateProcess` ignora PATHEXT → `ENOENT` → `marketplace add`/`install` falham.
  2. **Hooks sem build.** Tanto `plugin.json` quanto `installer/src/hooks.ts` apontavam para `scripts/search.js`, `scripts/capture.js`, `hooks/fix-encoding.js`, mas o `tsconfig` compila em `outDir: ./dist` (paths reais `scripts/dist/…`, `hooks/dist/…`). Pior: `dist/` **não é versionado** e o instalador faz `git clone --depth=1` **sem rodar `npm install`/`npm run build`** → os `.js` não existem no ambiente do usuário, e ainda dependem de libs nativas pesadas (`better-sqlite3`, `@xenova/transformers`, `sqlite-vec`). O bloco `hooks` do `plugin.json` é auto-carregado pelo Claude Code → erro a cada prompt.
- **Correção aplicada (decisão: "Skills ON, hooks OFF" até o v3.0):**
  - `.claude-plugin/plugin.json` — **removido o bloco `hooks`** inteiro (mata os erros por-prompt na instalação via marketplace). Bump 2.2.1→2.2.2.
  - `installer/src/plugin.ts` — `shell: process.platform === 'win32'` + trata `result.error` (ENOENT).
  - `installer/src/index.ts` — versão 2.0.5→**2.2.2**; header "v2.0"→"v2.2"; passo de hooks trocado de `registerHooks()` para **`removeHooks()`** (limpa hooks quebrados que instalações v2.x anteriores deixaram em `settings.json`); removidas as linhas "Hooks registered" dos summaries; `allOk` do `verify` agora = claude+plugin+vscode (não exige rag/hooks).
  - Versão sincronizada: `marketplace.json`, `commands/about.md` (2 linhas), `installer/package.json` (estava em 2.0.5!).
  - `installer/src/hooks.ts` mantido intacto (`registerHooks`/`removeHooks` ainda existem; os 3 testes de hooks passam).
- **Validação:** `cd installer && npm run build && npm test` → **build OK, 10/10 testes passam**.
- **MCP local fica para v3.0+** (decisão do usuário). É a correção definitiva (expõe a KB sem depender de hooks com libs nativas no ambiente do usuário).

### Próximo passo concreto (publicar o hotfix)

1. **Commitar** as mudanças em `master` (plugin.json, marketplace.json, about.md, installer/src/{plugin,index}.ts, installer/package.json, handoff).
2. **Publicar novo npx no npmjs** — o `npx delphi-dev` É a pasta `installer/` (`bin`). NÃO há CI de publish npm (só `build-rag.yml` e `publish-vscode.yml`). Fluxo manual:
   ```
   cd installer
   npm run build        # gera dist/ (prepublishOnly também roda build+test)
   npm publish          # precisa estar logado: npm whoami / npm login
   ```
   `files: ["dist/"]` → publica só o compilado. Confirmar que o publish saiu como **2.2.2**.
3. **Criar release/tag `v2.2.2`** no GitHub e **anexar o `rag.db`** (release que não toca `knowledge/` NÃO dispara a CI; sem o asset, `latest` quebra `npx … install` — pegar o `rag.db` do release v2.2.1 e reanexar, é byte-idêntico).
4. Verificar instalação limpa no Windows: `npx delphi-dev@latest` sem erro de registro e sem erro por-prompt.

### Armadilha específica do hotfix
- **Não re-registrar hooks** nem recolocar o bloco `hooks` no `plugin.json` até existir pipeline de build (commitar `dist/` + `node_modules` de prod, OU MCP local no v3.0). Hooks voltam no v3.0.

## Estado anterior (2026-06-17)

- **v2.2.1 RELEASED** — patch doc-only. Commit `cec3fa1` em `master`, tag `v2.2.1` pushada, release publicado com `rag.db` anexado.
  - O que entrou: seção **"Reinstalação limpa / Clean reinstall"** nos dois READMEs (desinstalar versão antiga via `/plugin uninstall` + `/plugin marketplace remove`, limpar cache, instalação limpa, e o loop de instalação local para dev/testes). Bump de versão em `plugin.json`, `marketplace.json`, `about.md` (2 linhas).
  - **Verificação crítica:** o installer baixa o `rag.db` de `GET /releases/latest` (installer/src/rag.ts:15). Confirmado que `latest` resolve para **v2.2.1 com o asset `rag.db` presente** — instalação nova via `npx delphi-dev` não quebrou. O `rag.db` do v2.2.1 é byte-idêntico ao do v2.2.0 (KB não mudou; baixei o asset de produção do v2.2.0 e reanexei, em vez de rebuildar).
  - **Importante para releases doc-only/code-only:** a CI `build-rag.yml` só dispara em mudanças sob `knowledge/{core,fmx,community}/**`. Releases que não tocam `knowledge/` **não** disparam a CI — é preciso criar o release manualmente E anexar o `rag.db` (senão `latest` fica sem asset e quebra toda instalação). Candidato a melhoria: adicionar `workflow_dispatch` ao workflow.

- **v2.1.0 / v2.2.0** — RELEASED antes desta sessão (RAG+hooks; KB migrada, 6 rules, 8 skills novas). Ver `session_checkpoint.md` na memória.

## Decisão de produto desta sessão — Governança do RAG (Abordagem 1)

**Problema levantado pelo usuário:** com milhares de devs contribuindo via `/contribute-kb`, o RAG pode (a) inchar, (b) acumular ruído, (c) conter contradições, (d) não saber qual fonte tem autoridade (ex.: um dev "ensina" 5 espaços de indentação, mas o padrão é 2).

**Modelo de confiança escolhido:** **community SEMPRE subordinada** ao canonical. O `core/`+`fmx/` (escrito pelo Adriano) é verdade absoluta; community só complementa onde o core é omisso e **nunca** sobrepõe — em conflito, o canonical vence automaticamente.

**Abordagem aprovada (1 — tier em tempo de retrieval):**
- `build-rag.ts` carimba cada chunk com `tier` (`canonical` para core/fmx, `community` para community/) conforme o diretório de origem.
- `search.ts` busca canonical e community separadamente; se houver hit canonical relevante para o tópico, **suprime** o community sobreposto; community só preenche o que sobra.
- `formatSearchResults` marca cada chunk — `[canonical/naming]` vs `[community/…]` — e injeta diretriz fixa: *"Canonical é autoritativo; community é complementar e nunca sobrepõe o canonical."*
- **Gate de qualidade no PR** (CI): valida frontmatter, tamanho mínimo, sem duplicação — barra sujeira na entrada.
- **Cap de bloat**: limite de chunks community + dedup por similaridade de embedding.
- Caminho leve de **promoção** (emprestado da Abordagem 3): quando um aprendizado community se prova bom, o Adriano funde no core (reescrito na voz dele).

**Honestidade técnica registrada:** isto não faz detecção *semântica* de contradição; neutraliza por precedência de tier — que é exatamente o que o usuário pediu.

**Pendente:** escrever o spec (`docs/superpowers/specs/AAAA-MM-DD-rag-governance-design.md`) e o plano de implementação. **NÃO iniciado** — guardado para a sprint v3.0.

## Próxima sprint = v3.0 (decisão do usuário: "guarde tudo para a próxima sprint, será a versão 3.0")

Backlog priorizado. **Recomendação:** começar pela Governança do RAG (item 1) — é a preocupação central do usuário, já tem desenho aprovado, e blinda o pipeline antes da base de usuários crescer.

1. ~~**Governança do RAG (Abordagem 1)** — spec + implementação.~~ **✅ CONCLUÍDO e mergeado em `master` (2026-06-28, merge `97239d0`).** Ver "Ponto de retomada (2026-06-28)" no topo. Follow-up restante: dedup completo no CI (Task 7b).
2. **Fechar os 2 testes interativos do v2.2** — hook `UserPromptSubmit` injetando `[RELEVANT KNOWLEDGE]` numa sessão real com o plugin instalado; `/contribute-kb` abrindo um PR de verdade (precisa `gh` autenticado).
3. **Continuar roadmap v2.x** (planos em `docs/superpowers/plans/`). As SKILLS de conhecimento foram puxadas para o v2.2, mas faltam os commands/agents/integrações:
   - v2.3: comando `/build` + agent `delphi-builder` (skill `delphi-build` já existe)
   - v2.4: `knowledge/core/spring4d-di.md` + integração Spring4D no `delphi-writer` e `/audit` (skill `delphi-spring4d` já existe)
   - v2.5: `/refactor`, `/migrate` + agent `delphi-migrator`
   - v2.6: VS Code WebView de aprendizados RAG + status bar com versão/RAG
   - v2.7: skills `delphi-doc`, `delphi-mocks`, `delphi-rest-horse`, `delphi-livebindings`
4. **SDD avançado** (em discussão) — `/propose` → `/apply` → `/archive` + spec viva, 2 trilhos (legacy→spec reversa, novo→spec forward). Exige brainstorming antes. Detalhes na memória `project_roadmap.md` (seção "Fase futura — SDD avançado").
5. **Servidor MCP local (brainstorm)** — criar um MCP server local que exponha a base de conhecimento (RAG) e outros recursos do plugin que fizerem sentido como tools/resources MCP, deixando a KB acessível de forma agnóstica ao cliente (além do hook `UserPromptSubmit` atual). **Exige brainstorm antes** — escopo a definir: quais recursos expor (busca na KB, `/contribute-kb`, padrões, templates de laudo/spec?), transporte (stdio local), como versionar/distribuir junto do plugin, relação com a Governança do RAG (item 1).

6. **Métricas de adoção de IA no time (ideia nova, 2026-08-30)** — relatório de "quantas horas
   de IA" e "% de código produzido com IA" num período, para o Adriano acompanhar a adoção pelo
   time que ele lidera. **Ideia registrada, não desenhada** → [`docs/ideas/2026-08-30-ai-adoption-metrics.md`](ideas/2026-08-30-ai-adoption-metrics.md).
   **Exige `superpowers:brainstorming` do zero** — as 4 perguntas em aberto (§7 do doc) nunca
   foram feitas. Achados que já mudam o desenho:
   - **O dado já existe local, verificado nesta máquina:** `~/.claude/projects/**/*.jsonl`
     (651 sessões, 820 MB — com `timestamp`, `cwd`, `gitBranch`, tool_use de Edit/Write com
     `file_path` e conteúdo, `usage`, `attributionSkill`), `~/.claude/history.jsonl`,
     `~/.claude/file-history/`, e o `usage-log.txt` do hook próprio do usuário.
   - **Logo, o v1 pode ser analisador post-hoc read-only — NÃO depende de hooks voltarem.**
     Isso contorna o bloqueio dos hooks OFF (item 5 deste backlog).
   - **Riscos que precisam entrar no desenho:** Goodhart/vigilância (recomendação forte:
     agregado de time por padrão, per-dev só com opt-in), cobertura parcial (só vê Claude Code
     na máquina com coletor), privacidade (digest exportado **nunca** carrega conteúdo, só
     contagens), retenção (transcript expira — coleta tem que ser incremental).
   - **⚠️ VALIDADO em 2026-08-30 — a recomendação MUDOU (ver §10 do doc).** A Anthropic já
     entrega nativamente as duas métricas. O dashboard Team/Enterprise
     (`claude.ai/analytics/claude-code`) dá "PRs with Claude Code (%)", linhas com CC,
     leaderboard por usuário e export CSV — com atribuição por PR feita melhor do que faríamos
     (janela de 21 dias, descarta código reescrito em >20%, exclui lockfile/gerado/`dist/`). E o
     OpenTelemetry (`CLAUDE_CODE_ENABLE_TELEMETRY=1`, **qualquer plano**) exporta
     **`claude_code.active_time.total`** — a métrica de horas pronta, já sem ociosidade — com
     atribuição per-dev nativa (`user.email`, `organization.id`).
   - **Logo: hook próprio virou o PIOR caminho.** Recomendação revisada — **Caminho 1:** ligar o
     dashboard nativo (custo zero) se houver Team/Enterprise. **Caminho 2 (provável):**
     `/ai-metrics on` **configura OTel** em vez de contar sozinho, apontando para um collector
     no VPS Hostinger que o usuário já opera. **Caminho 3** (hook próprio): só sem
     Team/Enterprise e sem apetite para collector.
   - **✅ ENQUADRAMENTO CORRIGIDO pelo usuário (§11 do doc) — recomendação FINAL.** Eu estava
     desenhando para o time do Adriano; **o plugin roda para qualquer dev do mundo**. Logo o
     plano **não é entrada de design, é variável de runtime**: `/ai-metrics on` **detecta o
     ambiente e degrada com elegância**. Escada: (1) dashboard nativo — só Team/Enterprise +
     GitHub App + Owner; (2) OTel → collector — exige ter onde mandar; (3) **ledger local via
     hook — sem requisito nenhum**.
   - **O nível 3 é o PADRÃO**, não o último recurso: é o único que funciona para todos os
     usuários do plugin (dev solo não tem org no claude.ai nem collector). O *"nem precisa ser
     exato"* do usuário é o que torna isso aceitável.
   - **⚠️ Isso REPROMOVE a restrição do hook a requisito de 1ª ordem:** se ele roda na máquina de
     todo usuário, é o mesmo público que a v2.2.2 quebrou. **Um único `.js` sem dependência,
     commitado, fora de `dist/`, só append em JSONL.** Repetir o erro quebra todo mundo de novo.
   - **Onde o plugin ganha do nativo:** alcance (dev solo), **recorte Delphi** (`.pas`/`.dfm`/
     `.dpr` + correlação com as skills via `attributionSkill`, que já está no transcript), sem
     privilégio administrativo, e funciona fora do GitHub.
   - **Pergunta sobre o plano do time: RETIRADA.** Não há o que descobrir — virou requisito de
     detecção em runtime.
   - **Decisões do usuário (2026-08-30):** relatório **per-dev**; persistência **global com
     override por projeto**; **parte do `delphi-dev`** (não plugin separado); e *"nem precisa ser
     exato"* — o que reforça o Caminho 2.
   - **Nome já decidido: `/ai-metrics`** (skill `delphi-ai-metrics`). Superfície proposta:
     `on` / `off` / `status` / `report <período>`.
   - **O comando NÃO pode ser o contador** — slash command roda dentro do turno e morre com
     ele. Ele **arma um hook**. `registerHooks`/`removeHooks` já existem e são testados em
     `installer/src/hooks.ts`.
   - **Restrição dura (postmortem da v2.2.2):** o hook do relógio tem que ser **um único `.js`
     sem dependência, commitado** (não compilado, fora de `dist/`), fazendo só append em JSONL.
     Os hooks do RAG morreram por apontar para `scripts/dist/` (não versionado, installer não
     roda build) e por exigir `better-sqlite3` + `transformers`. Por isso o `/ai-metrics` pode
     voltar **antes** do MCP local.
   - **Ativação é marcador, não pré-requisito:** os transcripts já têm o histórico, então
     `report` responde retroativamente sobre período anterior ao `on`.
   - **Conflito de escopo em aberto:** isto é métrica de processo, não conhecimento Delphi —
     pode fazer mais sentido como plugin separado do `delphi-dev`. Verificar também colisão de
     gatilho com o `/dashboard` que já existe.

7. **Comando owner-only de sincronização da KB (`/sync-kb`) — NOVO, 2026-08-30.** O mantenedor
   **não deve usar `/contribute-kb`** para publicar o próprio conhecimento. Quatro motivos
   concretos, todos verificados no repo:
   - **Tier errado.** `commands/contribute-kb.md` grava em `knowledge/community/`, que por
     desenho da governança (`docs/rag-governance.md`) é **subordinado e nunca sobrepõe o
     canonical**. O conhecimento do Adriano **é** o canonical — publicá-lo como community faz o
     retrieval suprimi-lo sempre que o core cobrir o tema. É exatamente ao contrário.
   - **Fonte errada.** O `/contribute-kb` lê `knowledge/local/` (saída dos hooks). Os **hooks
     estão OFF** desde a v2.2.2 e `knowledge/local/` está **vazio** — o comando não acharia nada.
     A base do Adriano vive em `~/.claude/shared/delphi-knowledge/`.
   - **Mecanismo errado.** Sanitização + PR + gate de CI existem para entrada **não confiável**.
     O dono commita direto, e a governança diz explicitamente que *"mudanças em core/fmx não
     passam pelo gate"*.
   - **Falta a transformação.** Os arquivos da KB compartilhada têm formato próprio; `knowledge/`
     exige frontmatter (`title`, `category`, `tags`, `source`) e decisão `core/` vs `fmx/`.
   **Portanto: criar comando separado**, só na máquina do mantenedor. Faz diff entre
   `~/.claude/shared/delphi-knowledge/` e `knowledge/core|fmx/`, converte formato, classifica o
   destino, commita direto em `master` e deixa a CI `build-rag.yml` rebuildar o `rag.db`.
   **Exige brainstorming** — nome, dry-run, e como decidir core vs fmx.

8. **Importar o backlog da KB compartilhada — 41 arquivos fora do plugin (2026-08-30).**
   Inventário: **74** arquivos em `~/.claude/shared/delphi-knowledge/` contra **34** em
   `knowledge/core` + `knowledge/fmx`. Faltam **41**, sendo **9 de hoje**:
   `json-null-e-iso8601-delphi`, `fmx-defeitos-que-so-aparecem-rodando`, `rodar-app-mobile-no-desktop`, `fmx-automacao-windows-sem-foco`, `router4delphi-animation-hook-sksvg`, `w1036-recurso-adquirido-dentro-do-try`, `delphi-pastas-especiais-desktop`, `delphi13-horse-webwebconst-shadow`, `horse-conexao-por-requisicao`.
   Os outros **32**: `acbr-posprinter-escpos`, `android-jdk-keytool-path-obsoleto`, `brcc32-resinator-delphi13-bug`, `comentario-chave-fecha-bloco`, `compilerversion-tabela-condicional`, `dcc32-unit-nome-pontuado-conflito-search-path`, `dfm-fmx-sem-bom`, `dproj-projectguid-valido`, `firedac-persistent-fields-colunas-extras`, `firedac-sqlite-mobile-beforeconnect`, `fmx-android-edge-to-edge-safe-area`, `fmx-camera-lifecycle-scanner`, `fmx-flowlayout-posicao-diverge-versoes`, `fmx-gridpanellayout-controlcollection`, `fmx-progresso-sync-por-registro-anr`, `fmx-propriedade-nao-publicada-streaming`, `fmx-scaledlayout-design-fixo-tablet`, `fmx-skia-fontes-customizadas-svg-icones`, `fmx-stylebook-resourcesbin-versao`, `fmx-svg-pathdata-numeros-colados`, `fmx-win32-janela-automacao-externa`, `for-in-array-constructor-e2001`, `horse-gbswagger-rotas-jwt`, `horse-linux-docker-firebird`, `indy-openssl-android`, `indy-readtimeout-streaming`, `indy-tls-client-passthrough`, `program-name-colide-var-global-e2029`, `router4delphi-has-fmx-define`, `string-literal-255-limite`, `vcl-messagedlg-botoes-em-ingles`, `writeln-sem-console-runtime-error-217`.
   (Único só no plugin, sem contrapartida na base compartilhada: `delphi-async.md`.)
   Este é o trabalho que o item 7 automatiza — fazer o 7 antes evita importar 41 arquivos à mão.

9. **IMPACTO NO `/e2e` (ação imediata, não é backlog).** Entre os 9 de hoje está
   **`fmx-automacao-windows-sem-foco.md`**, que **substitui o mecanismo em que o design do
   `/e2e` foi baseado**. Sai `SetForegroundWindow` + `SetCursorPos` + `mouse_event` (rouba foco,
   sequestra cursor — sintoma real: o texto que a pessoa digitava vazou para o campo do app);
   entra **`PostMessage`** de `WM_LBUTTONDOWN`/`UP` para clique, **`WM_CHAR`** para texto (imune
   a acento morto de teclado ABNT) e **`PrintWindow` com flag 2** para screenshot (captura até
   com a janela coberta). **Invalida as armadilhas 3.2 e 3.5 e as regras 4 e 5 da §6.3** do
   design. Detalhes na **§10** de
   [`docs/superpowers/specs/2026-08-09-delphi-e2e-design.md`](superpowers/specs/2026-08-09-delphi-e2e-design.md).
   **Ler esse arquivo por inteiro antes de apresentar a §6.4.**

10. **Absorver a inteligência do Delphi-RAG-Lint (NOVO, 2026-08-30).** O usuário quer trazer a
    inteligência de <https://github.com/Alexl-git/Delphi-RAG-Lint> (autor: Alexl-git) para
    dentro do `delphi-dev`, **sem dependência nem vínculo com o repo dele**.
    - **Licença: MIT.** Permite copiar, modificar e redistribuir até em obra maior, **desde que
      preservados o aviso de copyright e o texto da licença**. Absorver é legal — só exige
      crédito se o material for copiado.
    - **O que aquele projeto é:** ferramenta **Delphi nativa** (binários Object Pascal +
      tree-sitter DLLs) que faz parsing AST do fonte, indexa símbolos em SQLite (call graph,
      hierarquia de tipos), e expõe LSP, plugin do RAD Studio 13 e **um MCP server com 15 tools
      para Claude/Cursor**. Tem **174 regras de lint em 16 categorias** (119 built-in + 54
      externas `.scm`; 149 ligadas por padrão, 22 com auto-fix). Exemplos: `god-class`,
      `with-statement`, `circular-uses`, `unused-public-symbol`, `type-name-prefix`,
      `string-equality-comparison`, `writeln-in-source`, `goto-statement`, `missing-doc`,
      `doc-drift`. Catálogo autoritativo via `drag-lint rules`.
    - **⚠️ São TRÊS inteligências diferentes, com transferibilidade muito diferente:**
      1. **O catálogo de 174 regras — ALTAMENTE transferível e de alto valor.** Mapeia direto no
         `/audit`, no `/review` e nas 8 dimensões do `delphi-laudo`, cujo catálogo hoje é menor
         e em prosa. **É aqui que está o ganho real.**
      2. **O motor de análise estática (tree-sitter + índice SQLite + call graph) — NÃO
         transferível.** São binários Object Pascal; o `delphi-dev` não tem runtime que os
         execute, e reescrever em TypeScript seria projeto de meses duplicando algo que já
         existe e funciona. **É aqui que "trazer toda a inteligência" quebra.**
      3. **O MCP server deles** — ironia registrada: **já é exatamente o item 5 deste backlog**
         (MCP local). Mas usá-lo seria "vinculado ao repositório dele", que é justamente o que o
         usuário não quer.
    - **Insight que resolve o impasse: o `delphi-dev` não precisa do parser deles porque
      *o Claude É o parser*.** O que falta ao plugin não é capacidade de analisar código —
      Claude já lê `.pas` — e sim **o checklist do que procurar**. O catálogo de regras é esse
      checklist.
    - **✅ RECOMENDAÇÃO ACEITA PELO USUÁRIO (2026-08-30).** Absorver **(1)** como conhecimento — regras viram critérios de auditoria
      em `knowledge/core/` e no `delphi-laudo`, **reescritas na voz canonical do Adriano**, que
      é o que a própria governança (`docs/rag-governance.md`) já exige para material promovido.
      Reescrever também dispensa obrigação de licença (aprender uma taxonomia não é copiar) —
      mas **creditar mesmo assim** é barato e correto. **NÃO** tentar absorver (2).
    - **Exige brainstorming** — quantas das 174 regras entram, como mapear nas 8 dimensões do
      laudo, e se vira `knowledge/core/` ou `references/` do `delphi-laudo`.
    - **Achado lateral:** existe <https://github.com/GabrielOnDelphi/Awesome-AI-For-Delphi>,
      lista de ferramentas/MCPs para usar Claude Code com Delphi. Candidato a divulgação do
      `delphi-dev`.

11. **~~Corrigir o `/new-project`~~ — ✅ FEITO em 2026-08-31 (commits `40faa44` + `994c522`).**
    O projeto real foi **corrigido, compilado (`Build OK`) e executado**: a API sobe em ~2s,
    `/health` 200, Swagger 200 em `/swagger/doc/html`, e o JWT devolve 401 (não 500) para token
    ausente, inválido e expirado. **5 aprendizados foram para a KB e para o plugin.**
    - **`commands/new-project.md`:** REGRA ZERO ("só entrega se compilar") + Passo 4 de build
      obrigatório via `delphi-build`, iterando até `Build OK`; se não puder buildar, **declarar**
      em vez de fingir sucesso (bloco bilíngue). Mais: seção de armadilhas conhecidas, princípio
      de **ler a API real em `modules/` após `boss install`**, consulta à KB estendida a todos os
      tipos de projeto, e fechamento (runtime ao lado do `.exe`, banner correto, sem vazar erro
      interno).
    - **`knowledge/core/` +5:** `dproj-dcc-debuginformation-nao-booleano.md` (NOVO),
      `class-var-vaza-para-campos-de-instancia.md` (NOVO),
      `console-writeln-sem-flush-nao-loga.md` (NOVO), `horse-gbswagger-rotas-jwt.md` (importado
      e ampliado com a superfície real da API) e `dproj-projectguid-valido.md` (importado).
      **Reduz o item 8 de 41 para 37 pendentes.**
    - **PENDÊNCIA:** bump de versão do plugin (3.0.0 → 3.1.0?) é decisão sua — não bumpei.
    - **IMPACTO NO `/e2e`:** o aprendizado do `Flush(Output)` mostra que **app console Delphi sem
      arquivo de log próprio não deixa rastro nenhum**. A §6.1 do design do `/e2e` (descoberta e
      leitura de log) precisa contar com isso, e o achado reforça a §6.2 (oferecer instrumentação).
    - Achados que **não** corrigi, por serem de ambiente ou decisão sua: `fbclient.dll` **x86**
      ausente bloqueia toda rota de dados (o build é Win32); o segredo JWT default é idêntico no
      `.ini` e como fallback literal no `.pas`; respostas 401 saem em `text/html` e não JSON; a
      app faz bind em `0.0.0.0`, expondo-se na rede local.
    - Backups `.bak` dos 4 arquivos alterados ficaram na pasta do projeto.

11b. **Diagnóstico original (histórico) — `/new-project` não buildava (2026-08-30).** Reportado pelo
    usuário após teste real. **Diagnóstico completo em
    [`docs/ideas/2026-08-30-new-project-gaps.md`](ideas/2026-08-30-new-project-gaps.md).**
    - **✅ DIAGNOSTICADO EMPIRICAMENTE em 2026-08-30 — compilei um scaffold real** (`ApiGT004`,
      API Horse em `D:\Temp\Projeto Novo com Delphi-Dev`, RAD Studio 37.0 / Delphi 13).
      **São TRÊS defeitos independentes, não um.** Ver §7 do doc.
      1. **`DCC_DebugInformation` booleano** → `F1026: File not found: 'true.dpr'`, **antes de
         compilar qualquer linha**. A propriedade é enum numérico no Delphi moderno (a IDE emite
         `0` e usa `DCC_DebugInfoInExe` para o booleano); o valor `true` vaza como token solto na
         linha do `dcc32`, que o toma pelo arquivo-fonte.
      2. **`class var` vazando para os campos de instância** → 6× `E2356` na 1ª unit. `class var`
         abre seção que **linha em branco não fecha** — todos os campos viraram variáveis de
         classe e as propriedades de instância não podem lê-las.
      3. **API de terceiros alucinada** → `E2003`/`E2066`/`E2250` + `W1074`. O gerador escreveu
         `Swagger.Title(...)` (o `Title` vive em `IGBSwaggerInfo`) e `Horse.GBSwagger.Middleware`
         (o real é `HorseSwagger`), contra versões que o `boss` instalou e cujo **fonte está em
         `modules/`**. Princípio a incorporar: **após `boss install`, ler a API real em
         `modules/`** antes de escrever código de framework.
    - **⚠️ DUAS AFIRMAÇÕES MINHAS ANTERIORES ESTAVAM ERRADAS** (feitas por leitura do comando, sem
      artefato): o `.dproj` **é** gerado, com GUID válido e `DCCReference`; e o
      `DCC_UnitSearchPath` **existe** — as 11 units de `src/` compilam. A estrutura em camadas
      funciona. Ver §7.0.
    - **✅ CONFIRMADO e reforçado:** o comando **nunca compila o que gerou**. Um laço "buildar até
      `Build OK`" teria pego os defeitos 1 e 2 sozinho.
    - **2 aprendizados novos para a KB** (nenhum existe hoje): `DCC_DebugInformation` numérico e
      o vazamento de `class var`.
    - ~~**Causa raiz: o `.dproj` nunca é gerado.**~~ (superado pela §7) A árvore do comando mostra `NomeProjeto.dproj`,
      mas o Passo 3 só manda gerar `.dpr` + units. `.dpr` ≠ `.dproj` — sem o arquivo MSBuild o
      msbuild não tem o que construir. Isto sozinho explica o sintoma.
    - **Segunda causa: sem `DCC_UnitSearchPath`.** O scaffold espalha units por `src/model`,
      `src/service`, `src/repository`… e o `dcc32` só as acha via search path no `.dproj`.
      Resultado: `E2003` para cada unit.
    - **Maior retorno pelo menor esforço: o comando nunca compila o que gerou.** Não há passo de
      validação, embora existam a **skill `delphi-build`** e o **agent `delphi-build`**. Fechar o
      comando com "buildar e iterar até `Build OK`" converte defeitos de geração em correção
      automática — inclusive os que não anteciparmos.
    - Outras lacunas: forms sem `.dfm`/`.fmx`, sem `.res`, consulta à KB só no ramo FMX (VCL /
      REST / Library geram às cegas), `tests/` criado vazio, `.claudeignore` não invocado.
    - **⚠️ DEPENDÊNCIA DE ORDEM — fazer o item 8 ANTES deste.** Quatro dos 41 arquivos ausentes
      são exatamente sobre por que um projeto novo não builda, e um deles cita o caso ao pé da
      letra (*"ao criar um `.dproj` à mão — ex.: agente gerando o projeto"*):
      `dproj-projectguid-valido`, `program-name-colide-var-global-e2029`,
      `dcc32-unit-nome-pontuado-conflito-search-path`, `brcc32-resinator-delphi13-bug`.
      **A cura já está escrita na KB do Adriano — só não foi importada para o plugin.**
    - **Exige brainstorming:** `.dproj` à mão vs templates versionados por versão do Delphi; se o
      build obrigatório bloqueia a entrega quando falha (o dev pode não ter RAD Studio — o
      plugin é público); e qual versão do Delphi o scaffold assume.

12. **~~DEFEITOS NO RAG~~ — ✅ CORRIGIDOS em 2026-08-31 (commit `ec835c7`).** 47 testes verdes
    (30 + 17 novos), build limpo em `scripts/` e `installer/`. Os 5 pontos foram implementados na
    ordem recomendada. **Pendem:** calibrar `DEFAULT_MAX_DISTANCE`/`RELEVANCE_FLOOR` contra corpus
    real (o `1.1` é chute conservador, não medido); **migrar bancos já contaminados** (quem rodou
    v3.0.0 com hooks tem chunks `local` gravados como `canonical` — o tier está no banco, não no
    caminho); expor `ragHealth()` num comando (candidato: `/dashboard`); e o bump de versão.
    Detalhe do diagnóstico original abaixo.

12b. **Diagnóstico original (histórico) — relatório de cliente verificado.**
    Cliente rodando v3.0.0 **com hooks registrados** reportou 3 problemas; verifiquei todos contra
    o código e **achei um 4º, pior**. Análise completa em
    [`docs/ideas/2026-08-31-rag-defeitos-relatorio-cliente.md`](ideas/2026-08-31-rag-defeitos-relatorio-cliente.md).
    - **(4) NÃO RELATADO, o mais grave:** `capture.ts:106` chama `embedFile(path)` **sem tier**, e
      o default de `embed.ts:50` é **`'canonical'`**. Todo chunk capturado de sessão entra como
      **verdade absoluta**, disputando slot de igual para igual com o acervo do Adriano.
      **A governança da v3.0 foi implementada só na leitura** — o caminho de escrita a ignora.
      Correção: passar tier explícito (`community`, ou um `local` novo subordinado aos dois) e
      **remover o default** do parâmetro, que foi a causa silenciosa.
    - **(1) CONFIRMADO:** `capture.ts:99-106` indexa o **payload JSON do hook**, não a conversa —
      nunca abre o `transcript_path`. Prova da assimetria: `search.ts:33-38` faz o parse certo do
      próprio payload. Cliente mediu 251/646 chunks (39%) com `session_id`+`transcript_path`.
    - **(2) SINTOMA REAL, CAUSA ERRADA.** Não é que "nada roda o `build-rag`" — a CI roda e anexa
      o `rag.db` ao release, e o `npx` baixa. A causa real: **`rag/rag.db` é gitignored**, então
      quem instala pelo **marketplace** (git clone) recebe **sem banco**; o `capture` cria um
      vazio (`CREATE TABLE IF NOT EXISTS`) e só enche de ruído. Correção diferente da proposta:
      fazer o caminho marketplace baixar o asset do release, **e** avisar quando
      `COUNT(*) WHERE tier='canonical'` = 0 em vez de degradar calado.
    - **(3) CONCLUSÃO CERTA, citação de código pré-v3.0.** O `RELEVANCE_FLOOR=1.0` da v3.0
      **prioriza, não filtra** — `weakCanonical` é explicitamente *"last fallback so we never
      return fewer results"*. Não existe corte absoluto: sempre injeta `topK`. Correção:
      `maxDistance` real **depois** do `selectByTier`, exposto como `DELPHI_RAG_MAX_DISTANCE`.
    - **(5) COLATERAL:** os **dois READMEs (linha 41) ainda anunciam que a instalação "registra
      hooks de automação"**, mas desde a v2.2.2 o `plugin.json` não tem bloco `hooks` e o
      installer chama `removeHooks()`. A doc conduz o usuário à configuração que expõe os 4
      defeitos. Para quem instala sem mexer, o RAG está **inerte** — o que mascara tudo isso e
      explica por que só este cliente reportou.
    - **Ordem recomendada:** 4 → 1 → 2 → 3 → 5. O 4 vem antes do 1 porque corrigir a captura sem
      corrigir o tier apenas troca ruído de envelope por ruído de conversa, ainda carimbado como
      verdade absoluta.
    - **Aceitar a oferta do cliente** de testar patch e mandar estatísticas: a base dele é um caso
      adverso melhor que qualquer fixture, e serve para calibrar o `maxDistance` (o 0.6 sugerido é
      chute, e o `RELEVANCE_FLOOR=1.0` também nunca foi calibrado contra base real).

> Nota: ao definir a v3.0, perguntar ao usuário a ordem exata — ele pediu para eu reapresentar as opções "mais tarde, quando ele pedir". As 4 opções acima são o conjunto a reapresentar.

## Armadilhas / o que não fazer

- **Não commitar** `scripts/dist/`, `hooks/dist/`, `package-lock.json` — são build output/untracked por design (a CI roda `npm run build`; o pacote installer faz o wiring no ambiente do usuário). Considerar adicioná-los ao `.gitignore` para parar o ruído no `git status`.
- **Não simplificar** o shape aninhado de `source` em `marketplace.json` (`"source": {"source": "url", "url": "..."}`) — foi fix deliberado (commit `905fe6b`).
- Ao bumpar versão, sincronizar `plugin.json` + `marketplace.json` + `about.md` (2 linhas: Version/Versão). Os READMEs **não** têm string de versão (a menção no CLAUDE.md está desatualizada).
- Release que não toca `knowledge/` não dispara a CI — criar manualmente com `rag.db` anexado (ver seção do v2.2.1).

## Como rodar / validar

- Testes: `cd scripts && npx vitest run` (11 testes)
- Build scripts: `cd scripts && npm run build`
- Build RAG: `node scripts/dist/build-rag.js ./knowledge ./rag/rag.db`
- Smoke test RAG: `echo '{"prompt":"..."}' | RAG_DB_PATH=./rag/rag.db node scripts/dist/search.js`
- Testar o plugin: instalação local via `/plugin marketplace add <checkout>` + `/plugin install delphi-dev@delphi-dev` (mudanças em `.md`/`.json` só valem após reinstalar).

## Branch / sincronização

- Branch: `master`. **4 commits à frente de `origin/master`** (2026-08-30) — todos doc-only
  (design do `/e2e` + ideia de métricas). Push segurado por política da sessão.
- Última sincronização real com o origin: `84f3676` (v3.0.0). Release `v3.0.0` publicado como
  `latest` com `rag.db` anexado.
- Tags `v2.2.1` (e anteriores) pushadas.
