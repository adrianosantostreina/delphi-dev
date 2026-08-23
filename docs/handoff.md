# Handoff — delphi-dev

> Onde estamos e qual o próximo passo. Atualizado em **2026-08-09**.
> No início de uma nova sessão, ler este arquivo para retomar.

## Ponto de retomada (2026-08-09) — BRAINSTORM `delphi-e2e` EM ANDAMENTO (interrompido) ⏸️

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

- Branch: `master`, sincronizada com `origin/master` (`cec3fa1`).
- Tags `v2.2.1` (e anteriores) pushadas. Release v2.2.1 publicado como `latest`.
