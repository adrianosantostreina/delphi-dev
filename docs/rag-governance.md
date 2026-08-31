# Governança do RAG (Abordagem 1)

## Modelo de confiança

- **canonical** (`knowledge/core/`, `knowledge/fmx/`) — escrito pelo mantenedor. Verdade absoluta.
- **community** (`knowledge/community/`) — contribuições via `/contribute-kb`. Complementa
  apenas onde o canonical é omisso; **nunca** sobrepõe. Em conflito, o canonical vence.

A precedência é aplicada no retrieval por **slot**: canonical relevante (distância ≤
`RELEVANCE_FLOOR`) ocupa os slots primeiro; community só preenche o que sobra. A injeção
rotula cada trecho (`[canonical/...]` / `[community/...]`) e declara a diretriz fixa de
precedência. Isto neutraliza contradições por **tier**, não por análise semântica.

## Gate de qualidade (CI)

PRs que tocam `knowledge/community/**` passam por `.github/workflows/validate-community.yml`:
frontmatter obrigatório (`title`, `category`, `tags`, `source`), tamanho do corpo entre
`MIN_CHARS` e `MAX_CHARS`, e (primitivo de) dedup. Mudanças em `core/`/`fmx/` não passam pelo gate.

## Cap de bloat

`build-rag` emite WARNING quando o tier community ultrapassa `COMMUNITY_CAP` chunks. O build
não é bloqueado e nada é removido automaticamente — sinaliza necessidade de curadoria/promoção.

## Promoção de community → canonical (manual)

Quando um aprendizado community se prova bom e geral:

1. Reescrever o conteúdo na **voz canonical** (padrão do mantenedor).
2. Salvar em `knowledge/core/` (ou `knowledge/fmx/` se for FireMonkey).
3. Apagar o arquivo original de `knowledge/community/`.
4. Commit → a CI `build-rag.yml` rebuilda o `rag.db` automaticamente.

Promoção é um ato editorial do mantenedor — não há comando automatizado.

## Constantes de calibração (defaults)

| Constante         | Default | Onde                       |
|-------------------|---------|----------------------------|
| `RELEVANCE_FLOOR` | `1.0`   | `scripts/src/db.ts`        |
| `DEDUP_THRESHOLD` | `0.30`  | `scripts/src/validate-contribution.ts` |
| `MIN_CHARS`       | `200`   | `scripts/src/validate-contribution.ts` |
| `MAX_CHARS`       | `8000`  | `scripts/src/validate-contribution.ts` |
| `COMMUNITY_CAP`   | `500`   | `scripts/src/build-rag.ts` |

## Tiers (atualizado 2026-08-31)

| Tier | Origem | Gate | Precedência |
|---|---|---|---|
| `canonical` | `knowledge/core/`, `knowledge/fmx/` | curadoria do mantenedor | 1º (quando `distance <= RELEVANCE_FLOOR`) |
| `community` | `knowledge/community/` | CI `validate-community.yml` | 2º |
| `local` | captura de sessão na máquina do usuário | **nenhum** | 3º |

O tier `local` foi criado ao corrigir um defeito da v3.0.0: `capture.ts` chamava
`embedFile()` sem passar tier, e o **default do parâmetro era `canonical`** — todo chunk
capturado de sessão entrava como verdade absoluta, anulando a precedência. O parâmetro `tier`
de `embedFile` passou a ser **obrigatório**; não voltar a dar default a ele.

## Corte absoluto de relevância

`RELEVANCE_FLOOR` **ordena**, não descarta. O descarte é do `applyDistanceCutoff`, aplicado
**depois** do `selectByTier`: qualquer resultado com `distance > DEFAULT_MAX_DISTANCE` é
removido, e devolver **lista vazia é resultado válido** — `formatSearchResults` produz `''` e o
hook não injeta nada.

| Constante | Default | Env | Onde |
|---|---|---|---|
| `RELEVANCE_FLOOR` | `1.0` | — | `scripts/src/db.ts` |
| `DEFAULT_MAX_DISTANCE` | `1.1` | `DELPHI_RAG_MAX_DISTANCE` | `scripts/src/db.ts` |

> **Nenhum dos dois foi calibrado contra um corpus real.** O `1.1` é um ponto de partida
> conservador (embeddings normalizados: `distance` 1.0 ≈ cosseno 0.5). Calibrar com base de
> usuário real antes de tratar como definitivo.

## Distribuição do `rag.db`

`rag/rag.db` **não é versionado**. Ele é construído pela CI e anexado ao GitHub Release; o
`npx delphi-dev` baixa esse asset. **A instalação via marketplace (`git clone`) chega sem
banco** — e o `capture` então cria um vazio via `CREATE TABLE IF NOT EXISTS` e o preenche só
com tier `local`. Quem instala por esse caminho precisa rodar `npx delphi-dev sync-kb`.
`ragHealth()` em `db.ts` reporta a composição por tier e sinaliza `curatedMissing`.
