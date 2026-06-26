# SPEC — Governança do RAG (Abordagem 1)

> Status: **aprovado** (brainstorming 2026-06-25). Sprint **v3.0** do plugin delphi-dev.
> Próximo passo após este spec: plano de implementação (writing-plans).

## 1. Contexto e problema

A partir do `/contribute-kb`, qualquer dev poderá contribuir conhecimento para a base do
RAG. Sem governança, a base pode: **inchar**, **acumular ruído**, e — o mais grave —
**contradizer o padrão oficial** (ex.: um contribuidor "ensina" indentação de 5 espaços,
mas o canonical é 2). Hoje a busca não tem noção de **autoridade da fonte**: o
`searchSimilar` devolve os mais próximos por embedding, misturados, e a injeção imprime
`[category] conteúdo` sem distinguir origem.

Estado atual do código relevante:

- `scripts/src/db.ts` — tabela `knowledge(path, chunk_index, content, category, agent, created_at)`.
  Sem coluna de origem/autoridade. `rag.db` é **descartável e regenerado** pela CI a cada build
  (não há migração de dados de usuário a preservar).
- `scripts/src/build-rag.ts` — varre `knowledge/` e chama `embedFile` por arquivo. `embedFile`
  hoje **não conhece o diretório-raiz**, então não há como derivar origem do caminho sem mudar a assinatura.
- `scripts/src/embed.ts` — `embedFile(mdPath, dbPath)` grava cada chunk com `agent: null`.
- `scripts/src/search.ts` — `searchSimilar` devolve top-3; `formatSearchResults` imprime
  `[category] conteúdo` dentro do bloco `[RELEVANT KNOWLEDGE]`. A injeção **falha em silêncio**
  por design (o hook nunca pode interromper o prompt do usuário).
- Diretório `knowledge/` tem `core/` (15 arquivos) e `fmx/` (20). **Não existe** `community/` ainda.

### Risco sobre o plugin (baixo) — por quê

1. **Schema** — adicionar a coluna muda o `SCHEMA` em `db.ts`. O `rag.db` é regenerado pela CI a
   cada build e baixado pronto pelo installer; **não há migração de dados de usuário**.
2. **Hook desligado** — desde o hotfix v2.2.2 o bloco `hooks` foi removido do `plugin.json`
   ("Skills ON, hooks OFF até v3.0"). Mudanças em `search.ts` **não afetam usuários instalados hoje**
   — o `search.js` nem é executado. Esta sprint prepara o terreno sem religar nada.
3. **Fail-silent preservado** — `search.ts:46-48` engole qualquer erro. Na pior hipótese o RAG não
   injeta conhecimento, mas o plugin **não quebra**.
4. **Testes** — 11 testes vitest existentes (inclui `search.test.ts`). Mudar a assinatura de
   `searchSimilar`/`formatSearchResults` exige atualizá-los; é onde travamos a não-regressão.

## 2. Modelo de confiança (decisão de produto)

**Community é SEMPRE subordinada ao canonical.**

- `core/` + `fmx/` (escritos pelo Adriano) = **canonical** = verdade absoluta.
- `community/` (contribuições) = **community** = complementa **apenas onde o canonical é omisso**;
  **nunca** sobrepõe. Em conflito, o canonical vence automaticamente.

**Honestidade técnica:** isto **não** faz detecção *semântica* de contradição. Neutraliza por
**precedência de tier** — exatamente o comportamento pedido.

## 3. Arquitetura — as 6 peças

### Peça 1 — Carimbar o tier no build

- `db.ts`: tabela `knowledge` ganha coluna `tier TEXT NOT NULL DEFAULT 'canonical'`.
  `KnowledgeChunk` ganha `tier: 'canonical' | 'community'`. `insertChunk` grava o tier.
  `SearchResult` ganha `tier`. Adicionar índice `idx_knowledge_tier`.
- `embed.ts`: `embedFile(mdPath, dbPath, tier)` — novo parâmetro `tier` (default `'canonical'`),
  repassado ao `insertChunk`.
- `build-rag.ts`: ao listar arquivos, deriva o tier do **primeiro segmento do caminho relativo**
  à raiz de conhecimento:
  - segmento `community` → `'community'`;
  - qualquer outro (`core`, `fmx`, desconhecido) → `'canonical'` (conservador: na dúvida, canonical).

### Peça 2 — Retrieval com precedência por slot + piso de relevância

- `searchSimilar(db, queryEmbedding, topK=3, agentFilter?)` passa a:
  1. Puxar um **pool maior** do scan vec0 (ex.: `max(topK*6, 24)`).
  2. Particionar o pool em `canonical` e `community`, cada lista ordenada por distância.
  3. **Preencher os `topK` slots**: primeiro com canonical cujo `distance <= RELEVANCE_FLOOR`;
     as vagas restantes com community (por distância). Se sobrar vaga e não houver community,
     completar com canonical remanescente (mesmo acima do piso) para não devolver menos que o
     disponível.
  4. O `agentFilter` existente continua valendo (o agent-scoping ocorre **dentro** de cada partição
     ou sobre o pool antes de particionar; ver plano de implementação).
- **`RELEVANCE_FLOOR` (default `1.0`, distância L2):** embeddings são normalizados
  (`embed.ts` usa `normalize:true`), então a distância L2 vai de 0 (idêntico) a ~2 (oposto).
  Um canonical com `distance > 1.0` é "fraco" e cede a vaga a um community melhor. Valor
  **calibrável**, definido como constante nomeada.

### Peça 3 — Rótulo + diretriz na injeção

- `formatSearchResults` passa a rotular cada chunk com `[<tier>/<category>]`
  (ex.: `[canonical/naming]`, `[community/general]`).
- Injeta uma **diretriz fixa** no topo do bloco:
  `Canonical é autoritativo; community é complementar e nunca sobrepõe o canonical.`
- Mantém o contrato fail-silent: lista vazia → string vazia → nada é injetado.

Formato do bloco (exemplo):

```
[RELEVANT KNOWLEDGE FROM DELPHI-DEV RAG]
(Canonical é autoritativo; community é complementar e nunca sobrepõe o canonical.)

[canonical/naming] <conteúdo>

[community/general] <conteúdo>
[/RELEVANT KNOWLEDGE]
```

### Peça 4 — Gate de qualidade no PR (CI)

Novo workflow GitHub Actions, disparado **apenas** quando o PR toca `knowledge/community/**`
(mudanças em `core/`/`fmx/` não passam pelo gate — o autor é a autoridade canonical). Valida
cada arquivo `.md` adicionado/modificado em `community/`:

1. **Frontmatter obrigatório** — campos: `title`, `category`, `tags`, `source`.
   Ausência de qualquer um → falha com mensagem indicando o campo e o arquivo.
   - `category` deve ser um dos valores conhecidos (`bugs|architecture|patterns|failures|general`).
2. **Tamanho** — corpo (sem frontmatter) entre **MIN_CHARS=200** e **MAX_CHARS=8000**.
   Fora da faixa → falha.
3. **Dedup contra a base** — gera embedding do arquivo novo e compara com os chunks já existentes
   no `rag.db` (reconstruído no job); se a menor distância a um chunk existente
   `< DEDUP_THRESHOLD=0.30` → falha (provável duplicata).

Os 3 limites (`MIN_CHARS`, `MAX_CHARS`, `DEDUP_THRESHOLD`) são **calibráveis** e ficam num ponto
único (script de validação reutilizável).

Implementação: um script Node em `scripts/src/` (ex.: `validate-contribution.ts`) testável por
vitest, chamado pelo workflow. Reaproveita `embed.ts`/`db.ts`.

### Peça 5 — Cap de bloat

- `build-rag.ts`, ao final, conta chunks com `tier='community'`. Se `> COMMUNITY_CAP=500`,
  emite **WARNING** visível no log (CI), sinalizando necessidade de curadoria/promoção.
  **Não** quebra o build, **não** descarta nada automaticamente (decisão humana).
- `COMMUNITY_CAP` é constante nomeada, calibrável.

### Peça 6 — Promoção (doc-only)

- Novo doc `docs/rag-governance.md` (pt-BR; en-US opcional posterior) descrevendo o modelo de
  confiança e o **passo-a-passo manual de promoção**:
  1. Reescrever o conteúdo na voz canonical (padrão do autor).
  2. Salvar em `core/` (ou `fmx/`).
  3. Apagar o arquivo de `community/`.
  4. Commit → a CI `build-rag.yml` rebuilda o `rag.db`.
- Sem comando/script novo nesta entrega.

## 4. Estrutura de diretórios

- Criar `knowledge/community/` com `.gitkeep` + `INDEX.md` (placeholder), para o tier existir
  mesmo sem conteúdo. `build-rag.ts` deve lidar com a pasta vazia sem erro
  (`findMarkdownFiles` já ignora `INDEX.md`).

## 5. Constantes de calibração (valores iniciais)

| Constante           | Default | Onde            | Significado                                        |
|---------------------|---------|-----------------|----------------------------------------------------|
| `RELEVANCE_FLOOR`   | `1.0`   | search          | distância L2 máx. p/ canonical ganhar o slot       |
| `DEDUP_THRESHOLD`   | `0.30`  | gate de CI      | distância L2 mín. p/ não ser considerado duplicata |
| `MIN_CHARS`         | `200`   | gate de CI      | tamanho mínimo do corpo do `.md`                   |
| `MAX_CHARS`         | `8000`  | gate de CI      | tamanho máximo do corpo do `.md`                   |
| `COMMUNITY_CAP`     | `500`   | build-rag       | nº de chunks community antes do WARNING            |

Todos calibráveis; ajustar com dados reais após a base community começar a crescer.

## 6. Testes e validação

- **Atualizar** `scripts/__tests__/search.test.ts` para a nova assinatura/retorno
  (`tier` em `SearchResult`, rótulo `[tier/category]`, diretriz no bloco).
- **Novos casos:**
  - precedência por slot: canonical relevante preenche antes; community só nas vagas.
  - piso: canonical fraco (`distance > FLOOR`) cede vaga a community melhor.
  - derivação de tier no build (`core`/`fmx` → canonical; `community` → community; default canonical).
  - cap: contagem de community e emissão do WARNING.
  - gate (`validate-contribution`): frontmatter faltando, tamanho fora da faixa, duplicata detectada.
- Manter os **11 testes existentes verdes** + os novos.
- Comandos:
  - `cd scripts && npx vitest run`
  - `cd scripts && npm run build`
  - `node scripts/dist/build-rag.js ./knowledge ./rag/rag.db`
  - Smoke: `echo '{"prompt":"..."}' | RAG_DB_PATH=./rag/rag.db node scripts/dist/search.js`

## 7. Versionamento e release

- Fecha como **v3.0.0**. Sincronizar:
  - `.claude-plugin/plugin.json` → `version`
  - `.claude-plugin/marketplace.json` → `plugins[0].version` (não simplificar o `source` aninhado)
  - `commands/about.md` → linhas `Versão:`/`Version:`
- **Hooks continuam OFF** (decisão v2.2.2): o `search.js` novo só passa a ser exercido quando o
  hook/MCP voltar (item separado do backlog v3.0). Esta entrega **não religa** hooks.
- Release v3.0.0 deve **anexar o `rag.db`** regenerado (releases que tocam `knowledge/` disparam a
  CI `build-rag.yml`; como criamos `community/`, deve disparar — confirmar mesmo assim).

## 8. Fora de escopo (YAGNI)

- Detecção semântica de contradição (neutralizamos por tier, não por semântica).
- Comando/script de promoção (`/promote-kb`) — fica para depois se a demanda aparecer.
- Eviction automática no cap — só WARNING.
- Religar hooks / servidor MCP local — itens separados do backlog v3.0.
- Versões en-US dos docs de governança — opcional, posterior.

## 9. Garantias de não-quebra (resumo)

- `rag.db` regenerado, não migrado → schema novo é seguro.
- Hook OFF → mudanças no retrieval não afetam instalações atuais.
- Fail-silent preservado no `search.ts`.
- Diretório `community/` vazio não quebra o build.
- 11 testes existentes mantidos verdes; cobertura nova para cada peça.
