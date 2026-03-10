# delphi-dev — Claude Code Plugin

> 🇧🇷 [Português](#português) | 🇺🇸 [English](#english)

---

## Português

### O que é

Plugin para Claude Code que transforma o assistente em um especialista sênior
em Delphi. Ao detectar código Delphi, o Claude aplica automaticamente os padrões
do Delphi Style Guide, Clean Code e boas práticas — sem precisar ser solicitado.

### Funcionalidades

| Recurso | Descrição |
|---|---|
| **Modo Delphi Automático** | Ao abrir qualquer `.pas`, `.dpr` ou `.dfm`, o Claude já conhece e aplica todos os padrões |
| **`/delphi-audit`** | Gera laudo técnico profissional completo com score e recomendações |
| **`/delphi-review`** | Revisão rápida de código — detecta violações e sugere correções |
| **`/delphi-write`** | Escreve código novo com todos os padrões aplicados automaticamente |
| **`/delphi-new`** | Scaffold de novo projeto com estrutura de pastas padronizada |

### Instalação

**Via GitHub (antes do marketplace):**
```bash
/plugin install delphi-dev@github:adrianosantostreina/delphi-dev
```

**Via marketplace Claude Code (quando disponível):**
```bash
/plugin install delphi-dev
```

### Padrões Aplicados

- ✅ Prefixos obrigatórios: `F` (fields), `A` (params), `L` (locals), `C_` (constantes)
- ✅ Prefixos de tipo: `T` (classes), `I` (interfaces), `E` (exceções)
- ✅ CamelCase em todos os identificadores
- ✅ Indentação de 2 espaços, margem de 120 caracteres
- ✅ `begin` e `else` em linhas próprias
- ✅ Comandos proibidos: `with`, `Break`, `Continue`, `Real`
- ✅ `Exit` apenas em guard clauses
- ✅ `const` correto (nunca em interfaces — ARC)
- ✅ try..finally por recurso (nunca dois recursos no mesmo bloco)
- ✅ SQL sempre parametrizado
- ✅ Prefixos de componentes: `btn`, `edt`, `lbl`, `grd`, `qry`, etc.
- ✅ Uses organizada: RTL → VCL/FMX → Third-party → Projeto

### Baseado em

- Normas e Padronização de Codificação Delphi v4.0.1 — Adriano Santos
- Código Limpo e Boas Práticas em Delphi — Adriano Santos
- Clean Code — Robert C. Martin
- Delphi Style Guide — Embarcadero

### Licença

MIT © 2026 Adriano Santos

---

## English

### What is it

A Claude Code plugin that turns the assistant into a senior Delphi expert.
When Delphi code is detected, Claude automatically applies the Delphi Style Guide,
Clean Code principles, and best practices — without being asked.

### Features

| Feature | Description |
|---|---|
| **Auto Delphi Mode** | Opening any `.pas`, `.dpr`, or `.dfm` file activates full coding standards context |
| **`/delphi-audit`** | Generates a complete professional technical audit with scoring and recommendations |
| **`/delphi-review`** | Quick code review — detects violations and suggests corrections |
| **`/delphi-write`** | Writes new code with all standards automatically applied |
| **`/delphi-new`** | Scaffolds a new project with standardized folder structure |

### Installation

**Via GitHub (before marketplace):**
```bash
/plugin install delphi-dev@github:adrianosantostreina/delphi-dev
```

**Via Claude Code marketplace (when available):**
```bash
/plugin install delphi-dev
```

### Standards Applied

- ✅ Mandatory prefixes: `F` (fields), `A` (params), `L` (locals), `C_` (constants)
- ✅ Type prefixes: `T` (classes), `I` (interfaces), `E` (exceptions)
- ✅ CamelCase for all identifiers
- ✅ 2-space indentation, 120-character margin
- ✅ `begin` and `else` on their own lines
- ✅ Prohibited commands: `with`, `Break`, `Continue`, `Real`
- ✅ `Exit` only as guard clauses
- ✅ Correct `const` usage (never on interfaces — ARC)
- ✅ One resource per try..finally block
- ✅ Always parameterized SQL (no string concatenation)
- ✅ Component prefixes: `btn`, `edt`, `lbl`, `grd`, `qry`, etc.
- ✅ Organized uses clause: RTL → VCL/FMX → Third-party → Project

### Based on

- Delphi Coding Standards v4.0.1 — Adriano Santos
- Clean Code and Best Practices in Delphi — Adriano Santos
- Clean Code — Robert C. Martin
- Delphi Style Guide — Embarcadero

### License

MIT © 2026 Adriano Santos
