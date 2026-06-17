# Handoff — delphi-dev

> Onde estamos e qual o próximo passo. Atualizado em **2026-06-17**.
> No início de uma nova sessão, ler este arquivo para retomar.

## Estado atual (2026-06-17)

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

1. **Governança do RAG (Abordagem 1)** — spec + implementação (ver seção acima). *Recomendado primeiro.*
2. **Fechar os 2 testes interativos do v2.2** — hook `UserPromptSubmit` injetando `[RELEVANT KNOWLEDGE]` numa sessão real com o plugin instalado; `/contribute-kb` abrindo um PR de verdade (precisa `gh` autenticado).
3. **Continuar roadmap v2.x** (planos em `docs/superpowers/plans/`). As SKILLS de conhecimento foram puxadas para o v2.2, mas faltam os commands/agents/integrações:
   - v2.3: comando `/build` + agent `delphi-builder` (skill `delphi-build` já existe)
   - v2.4: `knowledge/core/spring4d-di.md` + integração Spring4D no `delphi-writer` e `/audit` (skill `delphi-spring4d` já existe)
   - v2.5: `/refactor`, `/migrate` + agent `delphi-migrator`
   - v2.6: VS Code WebView de aprendizados RAG + status bar com versão/RAG
   - v2.7: skills `delphi-doc`, `delphi-mocks`, `delphi-rest-horse`, `delphi-livebindings`
4. **SDD avançado** (em discussão) — `/propose` → `/apply` → `/archive` + spec viva, 2 trilhos (legacy→spec reversa, novo→spec forward). Exige brainstorming antes. Detalhes na memória `project_roadmap.md` (seção "Fase futura — SDD avançado").

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
