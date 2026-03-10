---
description: Revisão rápida de código Delphi — detecta violações de padrão e sugere correções
---

Realize uma revisão rápida do código Delphi fornecido pelo usuário.

Analise e reporte:

**Nomenclatura**
- Prefixos corretos (F, A, L, C_, T, I, E)?
- Notação húngara detectada?
- Nomes significativos ou abreviações obscuras?
- Componentes renomeados corretamente?

**Formatação**
- Indentação de 2 espaços (sem TAB)?
- Margem de 120 chars respeitada?
- `begin` em linha própria?
- `else` em linha própria?

**Comandos Proibidos**
- Uso de `with`?
- `Break` ou `Continue` em loops?
- `Exit` fora de guard clause?
- `Real` como tipo?
- SQL concatenado (SQL Injection)?

**Estrutura**
- Métodos com mais de 50 linhas?
- Múltiplas responsabilidades na mesma classe/método?
- try..finally com múltiplos recursos?
- `const` em parâmetros de interface?

**Formato de saída:**

Para cada violação encontrada:
- Linha aproximada e descrição do problema
- Classificação: 🚨 CRÍTICO / ⚠️ ATENÇÃO / 💡 SUGESTÃO
- Exemplo correto de como deveria ser escrito
