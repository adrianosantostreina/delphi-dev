# delphi-dev — Plugin para Claude Code

> Plugin para Claude Code que transforma o assistente em um especialista sênior em Delphi.
> 🇺🇸 [Read in English](README.md)

---

## O que é

**delphi-dev** ativa automaticamente sempre que o Claude Code detecta conteúdo relacionado a Delphi — arquivos `.pas`, `.dpr`, `.dfm`, `.dpk`, `.dproj`, ou qualquer menção a Object Pascal, FireMonkey, VCL, FireDAC ou RAD Studio. Uma vez ativo, o Claude aplica o Delphi Style Guide completo, princípios de Clean Code e padrões SOLID sem precisar ser solicitado.

---

## Funcionalidades

| Recurso | Descrição |
|---|---|
| **Modo Delphi Automático** | Ao abrir qualquer arquivo `.pas`, `.dpr` ou `.dfm`, o contexto completo de padrões de codificação é ativado automaticamente |
| **`/delphi-audit`** | Gera laudo técnico profissional completo com score por dimensão e roadmap de modernização priorizado |
| **`/delphi-review`** | Revisão rápida de código — detecta violações e apresenta exemplos corrigidos |
| **`/delphi-write`** | Escreve código novo com todos os padrões aplicados desde o início |
| **`/delphi-new`** | Scaffold de novo projeto com estrutura de pastas em camadas padronizada |

---

## Instalação

**Via marketplace do Claude Code:**
```bash
/plugin install delphi-dev
```

**Via GitHub (antes da aprovação no marketplace):**
```bash
/plugin marketplace add adrianosantostreina/delphi-dev
/plugin install delphi-dev@delphi-dev
```

---

## Padrões Aplicados Automaticamente

### Prefixos
- `F` — fields (atributos privados)
- `A` — parâmetros de métodos
- `L` — variáveis locais
- `C_` — constantes (+ corpo em UPPER_CASE)
- `T` — classes e tipos
- `I` — interfaces
- `E` — exceções

### Formatação
- ✅ Indentação de 2 espaços (sem TAB)
- ✅ Margem máxima de 120 caracteres
- ✅ `begin` e `else` em linhas próprias
- ✅ Uma variável por linha
- ✅ Uma unit por linha na cláusula `uses` (RTL → VCL/FMX → FireDAC → Third-party → Projeto)

### Comandos Proibidos
- ❌ `with` — causa ambiguidade e dificulta depuração
- ❌ `Break` / `Continue` — usar condições do loop
- ❌ `Real` — usar `Double` ou `Currency`
- ⚠️ `Exit` — permitido apenas como guard clause no início do método

### Regras de Segurança
- ✅ Um recurso por bloco `try..finally`
- ✅ Nenhum bloco `except` vazio
- ✅ SQL sempre parametrizado (sem concatenação de strings)
- ✅ `const` nunca aplicado a parâmetros de interface (compatibilidade ARC)
- ✅ Sem variáveis globais — usar `class var`

### Prefixos de Componentes (VCL / FMX)
`btn`, `edt`, `lbl`, `mmo`, `cbx`, `grd`, `qry`, `cnn`, `dts`, `pnl`, `tmr` e mais — veja [`skills/delphi-standards/references/component-prefixes.md`](skills/delphi-standards/references/component-prefixes.md)

---

## Skills Incluídas

| Skill | Ativação |
|---|---|
| `delphi-standards` | Ativada automaticamente ao detectar arquivo/código Delphi |
| `delphi-write` | Ativada ao escrever código Delphi novo |
| `delphi-laudo` | Ativada pelo comando `/delphi-audit` |

---

## Agentes Incluídos

| Agente | Propósito |
|---|---|
| `delphi-auditor` | Auditoria técnica profunda — 8 dimensões, pontuação, laudo com 17 seções |
| `delphi-writer` | Escreve código Delphi completo e pronto para produção seguindo todos os padrões |

---

## Baseado em

- *Normas e Padronização de Codificação Delphi v4.0.1* — Adriano Santos
- *Código Limpo e Boas Práticas em Delphi* — Adriano Santos
- *Clean Code* — Robert C. Martin
- *Delphi Style Guide* — Embarcadero

---

## Licença

MIT © 2026 Adriano Santos

---

## Política de Privacidade

[Ver Política de Privacidade](privacy-policy.md)
