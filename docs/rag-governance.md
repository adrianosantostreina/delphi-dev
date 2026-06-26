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
