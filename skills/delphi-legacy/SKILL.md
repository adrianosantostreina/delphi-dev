---
name: delphi-legacy
description: >
  Especialista em modernização de código Delphi legado. Auto-ativa quando detectar:
  "legado", "antigo", "modernizar", "migrar", "refatorar sistema", String[N],
  ShortString, AnsiString (em contexto de migração), código com with em todo lugar,
  ausência total de interfaces, SQL concatenado, Delphi 7/2007/2009/XE/XE2.
---

# Delphi Legacy

## Idioma de saída
Detecte o idioma da primeira mensagem. Padrão: pt-BR. Respeite overrides explícitos.

## Protocolo para código legado

Antes de qualquer mudança, leia `rules/legacy.md` integralmente.

## Diagnóstico rápido de nível de legado

| Nível | Características |
|-------|----------------|
| 1 — Moderno | Interfaces, DI, testes, UTF-8 |
| 2 — Razoável | Sem interfaces mas com SOLID, sem testes |
| 3 — Legado | `with` em todo lugar, SQL concatenado, sem separação de camadas |
| 4 — Crítico | `String[N]`, `Real`, ANSI, Delphi 7/2007, zero abstração |
| 5 — Arqueologia | BDE, DBExpress, Paradox, DLL COM sem .pas |

## Estratégia por nível

**Nível 3:** Extrair interfaces → adicionar testes → remover `with` gradualmente

**Nível 4:** Encoding primeiro (UTF-8 BOM) → tipos (Real→Double, String[N]→string) → depois arquitetura

**Nível 5:** Mapeamento completo antes de tocar qualquer coisa. Plano de migração detalhado.

## Não modernize sem ordem

1. Encoding e tipos obsoletos (risco baixo, ganho imediato)
2. SQL seguro (risco médio, segurança imediata)
3. Extração de interfaces (habilita testes)
4. Testes de caracterização (trava o comportamento atual)
5. Refactoring de arquitetura (com testes protegendo)
