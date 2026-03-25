# delphi-dev — Claude Code Plugin

> A Claude Code plugin that turns the assistant into a senior Delphi expert.
> 🇧🇷 [Leia em Português](README.pt-BR.md)

---

## What is it

**delphi-dev** automatically activates whenever Claude Code detects Delphi-related content — `.pas`, `.dpr`, `.dfm`, `.dpk`, `.dproj` files, or any mention of Object Pascal, FireMonkey, VCL, FireDAC, or RAD Studio. Once active, Claude applies the full Delphi Style Guide, Clean Code principles, and SOLID patterns without being asked.

---

## Features

| Feature | Description |
|---|---|
| **Auto Delphi Mode** | Opening any `.pas`, `.dpr`, or `.dfm` file activates the full coding standards context automatically |
| **`/delphi-audit`** | Generates a complete professional technical audit with per-dimension scoring and a prioritized modernization roadmap |
| **`/delphi-review`** | Quick code review — detects violations and provides corrected examples |
| **`/delphi-write`** | Writes new code with all standards applied from the start |
| **`/delphi-new`** | Scaffolds a new project with standardized layered folder structure |

---

## Installation

**Via Claude Code marketplace:**
```bash
/plugin install delphi-dev
```

**Via GitHub (before marketplace approval):**
```bash
/plugin marketplace add adrianosantostreina/delphi-dev
/plugin install delphi-dev@delphi-dev
```

---

## Standards Applied Automatically

### Prefixes
- `F` — fields (private attributes)
- `A` — method parameters
- `L` — local variables
- `C_` — constants (+ UPPER_CASE body)
- `T` — classes and types
- `I` — interfaces
- `E` — exceptions

### Formatting
- ✅ 2-space indentation (no tabs)
- ✅ 120-character line limit
- ✅ `begin` and `else` on their own lines
- ✅ One variable per line
- ✅ One unit per line in `uses` clause (RTL → VCL/FMX → FireDAC → Third-party → Project)

### Prohibited Commands
- ❌ `with` — causes ambiguity and debugging issues
- ❌ `Break` / `Continue` — use loop conditions instead
- ❌ `Real` — use `Double` or `Currency`
- ⚠️ `Exit` — allowed only as guard clauses at the top of a method

### Safety Rules
- ✅ One resource per `try..finally` block
- ✅ No empty `except` blocks
- ✅ SQL always parameterized (no string concatenation)
- ✅ `const` never applied to interface parameters (ARC compatibility)
- ✅ No global variables — use `class var` instead

### Component Prefixes (VCL / FMX)
`btn`, `edt`, `lbl`, `mmo`, `cbx`, `grd`, `qry`, `cnn`, `dts`, `pnl`, `tmr`, and more — see [`skills/delphi-standards/references/component-prefixes.md`](skills/delphi-standards/references/component-prefixes.md)

---

## Included Skills

| Skill | Trigger |
|---|---|
| `delphi-standards` | Auto-activated on Delphi file/code detection |
| `delphi-write` | Activated when writing new Delphi code |
| `delphi-laudo` | Activated by `/delphi-audit` command |

---

## Included Agents

| Agent | Purpose |
|---|---|
| `delphi-auditor` | Deep technical audit — 8 dimensions, scoring, 17-section report |
| `delphi-writer` | Writes complete, production-ready Delphi code following all standards |

---

## Based on

- *Delphi Coding Standards v4.0.1* — Adriano Santos
- *Clean Code and Best Practices in Delphi* — Adriano Santos
- *Clean Code* — Robert C. Martin
- *Delphi Style Guide* — Embarcadero

---

## License

MIT © 2026 Adriano Santos

---

## Privacy Policy

[View Privacy Policy](privacy-policy.md)
