# Governança da base de conhecimento (v4)

## Modelo de confiança

- **canonical** (`knowledge/core/`, `knowledge/fmx/`) — escrito pelo mantenedor. Verdade absoluta.
  Frontmatter opcional.
- **community** (`knowledge/community/`) — contribuições via `/contribute-kb`. Complementa apenas onde
  o canonical é omisso; **nunca** sobrepõe. Frontmatter obrigatório (`title`, `category`, `tags`, `source`).

Não existe mais o tier `local` nem captura automática de sessão.

## Motor

Índice SQLite FTS5 (`node:sqlite`, Node ≥ 22.13) montado localmente a partir dos `.md`, por seção H2,
com `tokenize = 'unicode61 remove_diacritics 2'` e pesos `bm25` title 5, heading 3, body 1, tags 4.
O índice (`~/.delphi-dev/kb.db`) é cache: apagar é seguro.

**Precedência:** resultados com `score ≥ MIN_SCORE` entram; canonical ocupa os slots primeiro,
community só preenche o que sobra; um resultado por arquivo.

Os pisos (`MIN_SCORE`, `STRONG_SCORE`) valem para o hook; a ferramenta `kb_search`, por ser um pedido
explícito do agente, devolve os melhores resultados independentemente do piso (o `limit` limita a saída)
e marca como baixa confiança os que ficam abaixo de `MIN_SCORE`.

## Calibração

| Constante | Valor | Onde |
|---|---|---|
| `MIN_SCORE` | 7.5 | `kb/src/search.ts` |
| `STRONG_SCORE` | 9.5 | `kb/src/search.ts` (hook sem sinal explícito de Delphi) |

Calibrado em 2026-10-15 contra 115 arquivos (recalibrado após o primeiro `/sync-kb`; antes era
6.5 / 8.0 com 40 arquivos): 20/20 consultas pt-BR no top 3 (19 em 1º lugar, uma em 2º); consultas em
inglês: 3/3 (todas em 1º). Tabela completa em `kb/__tests__/calibration.test.ts`
(rode com `--reporter=verbose`).

Medido: o maior score de um prompt sem relação com Delphi (negativo) foi 7.01; o menor acerto
verdadeiro foi 11.61 (consulta em inglês "OnClick not firing on iOS rectangle"). Regra usada: `MIN_SCORE` fica logo acima do teto de ruído (os negativos);
`STRONG_SCORE` fica entre o teto de ruído e o menor acerto verdadeiro.

## Distribuição

1. **Embutida:** os `.md` de `knowledge/` viajam dentro do plugin.
2. **Atualizada:** a CI `build-kb.yml`, a cada merge em `knowledge/**`, publica `kb-manifest.json` no
   release **`kb-latest`** (prerelease, nunca *Latest*). O MCP confere a cada 24 h; o `/update` força.
   Os arquivos vêm de `raw.githubusercontent.com` fixados no commit do manifest, com sha256 conferido.
   `DELPHI_DEV_KB_OFFLINE=1` desliga; `DELPHI_DEV_KB_SOURCE=embedded` usa só a cópia do plugin.

## Entrada de conhecimento

| Origem | Caminho | Gate |
|---|---|---|
| Mantenedor | `/sync-kb` (comando de projeto deste repo) → commit em `core/`/`fmx/` | curadoria |
| Comunidade com `gh` | `/contribute-kb` → fork + PR | `validate-community.yml` (frontmatter, tamanho, **segredos**; parecidos no resumo do job) |
| Comunidade sem `gh` | `/contribute-kb` → issue pré-preenchida → rótulo `kb-aprovado` → `kb-issue-to-pr.yml` | o mesmo, dentro do job |

## Promoção community → canonical (manual)

1. Reescrever na voz canonical. 2. Salvar em `core/` ou `fmx/`. 3. Apagar o original de `community/`.
4. Commit → `build-kb.yml` publica.

## Constantes

| Constante | Valor | Onde |
|---|---|---|
| `MIN_CHARS` / `MAX_CHARS` | 200 / 8000 | `kb/src/validate.ts` |
| `MAX_SECTION_CHARS` | 4000 | `kb/src/chunk.ts` |
| `SNIPPET_MAX` | 400 | `kb/src/search.ts` |
| `CHECK_INTERVAL_MS` | 24 h | `kb/src/update.ts` |
| `HOOK_DEADLINE_MS` | 1000 | `kb/src/hook-inject.ts` |
