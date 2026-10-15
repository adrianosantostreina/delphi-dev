---
description: (mantenedor) Sincroniza ~/.claude/shared/delphi-knowledge/ com knowledge/core|fmx deste repositório
---

Comando do mantenedor do delphi-dev. Só funciona dentro do checkout deste repositório.

1. Rode o dry-run e mostre a tabela: `node runtime/kb-cli.mjs sync`
2. Para cada linha `conflict`, mostre o diff entre `~/.claude/shared/delphi-knowledge/<nome>` e
   `knowledge/<dest>/<nome>` e pergunte o que fazer: manter o do plugin, trazer o da base
   compartilhada (copiar à mão e rodar de novo) ou editar. **Nunca** sobrescreva conflito sozinho.
3. Mostre o resumo (`novos`, `alterados`, `conflitos`, `só no plugin`) e peça confirmação.
4. Confirmado: `node runtime/kb-cli.mjs sync --apply`.
5. `git status` → mostre os arquivos e proponha o commit
   `kb: sincroniza base compartilhada (<N> novos, <M> alterados)`. Commit **com confirmação**.
6. Push **só com confirmação**. Depois do push, a CI `build-kb.yml` publica o `kb-latest`.
