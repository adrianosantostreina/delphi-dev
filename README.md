# delphi-dev — Claude Code Plugin

> A Claude Code plugin that turns the assistant into a senior Delphi expert.
> 🇧🇷 [Leia em Português](README.pt-BR.md)

---

## What is it

**delphi-dev** activates automatically whenever Claude Code detects Delphi-related content — `.pas`, `.dpr`, `.dfm`, `.dpk`, `.dproj` files, or any mention of Object Pascal, FireMonkey, VCL, FireDAC, or RAD Studio. Once active, Claude applies the full Delphi Style Guide, Clean Code principles, and SOLID patterns without being asked.

---

## Features

| Command | Description |
|---|---|
| **Auto Delphi Mode** | Opening any `.pas`, `.dpr` or `.dfm` file activates the full coding standards context automatically |
| **`/audit`** | Generates a complete professional technical audit with per-dimension scoring and a prioritized modernization roadmap |
| **`/review`** | Quick code review — detects violations and provides corrected examples |
| **`/write`** | Writes new code with all standards applied from the start |
| **`/new-project`** | Scaffolds a new project with standardized layered folder structure |
| **`/spec`** | Analyzes the current project source code and auto-generates a complete `SPEC.md` |
| **`/tdd`** | Generates a complete DUnitX unit test suite for the project |
| **`/about`** | Displays plugin info, version, and available commands |

---

## Installation

**In Claude Code (VS Code, Cursor, Windsurf, etc.):**
```bash
/plugin marketplace add adrianosantostreina/delphi-dev
/plugin install delphi-dev@delphi-dev
```

**Via terminal (CLI):**
```bash
claude plugin marketplace add adrianosantostreina/delphi-dev
claude plugin install delphi-dev@delphi-dev
```

### After installation

After running the install command, a menu will appear asking for the installation scope:

| Option | When to use |
|---|---|
| **Install for you (user scope)** | Recommended for individual developers — available in all projects on your machine |
| **Install for all collaborators (project scope)** | Adds the plugin to `.claude/settings.json` so everyone who clones the repo gets it |
| **Install for you, in this repo only (local scope)** | Available only in the current project, gitignored |

> **Note:** After confirming the installation in the menu, the plugin will be installed silently — no confirmation message is shown.

**Verify the installed version:**
```
/about
```
The current version should be **1.4.0**.

> **Tip (Windows):** If you get a "Host key verification failed" error, run this once in your terminal before installing:
> ```powershell
> git config --global url."https://github.com/".insteadOf git@github.com:
> ```

### Updating

To update to the latest version, uninstall and reinstall:
```bash
/plugin uninstall delphi-dev
/plugin install delphi-dev@delphi-dev
```

### Uninstalling

```bash
/plugin uninstall delphi-dev
/plugin marketplace remove delphi-dev
```

Or via CLI:
```bash
claude plugin uninstall delphi-dev
claude plugin marketplace remove delphi-dev
```

---

## Output Language

**delphi-dev** supports both **pt-BR** (default) and **en-US** for everything it shows you — audit reports, SPEC documents, code reviews, prompts, and notifications.

The plugin auto-detects the language of your **first message** in a session and responds in that language. You can switch any time with an explicit override:

- `respond in English` / `in English please` / `switch to English` → en-US
- `responda em português` / `em português por favor` → pt-BR

What changes with the language selection:

- **Report templates** — `/audit` loads `estrutura-laudo.en.md` for English, `estrutura-laudo.md` for Portuguese; `/spec` does the same with `spec-template[.en].md`.
- **Severity / classification labels** — e.g. `🟢 GOOD / 🟡 FAIR / 🟠 CRITICAL / 🔴 NOT VIABLE` (en-US) vs. `🟢 BOM / 🟡 REGULAR / 🟠 CRÍTICO / 🔴 INVIÁVEL` (pt-BR).
- **Notifications** — e.g. `✅ Tests created in TestePedidoService.pas — 7 test cases` vs. the pt-BR equivalent.
- **All explanatory prose** in `/review`, `/write`, `/new-project`, `/tdd`, and `/about`.

What does **not** change with language:

- **Delphi identifiers in example code** (`FNome`, `ACliente`, `BuscarPorCodigo`) — these illustrate the naming convention itself.
- **Code prefixes** (`F`, `A`, `L`, `C_`, `T`, `I`, `E`).
- **Test method names** (`Test_<Method>_<Scenario>`).
- **Requirement IDs in SPECs** (`RF-001`, `RNF-001`, `RN-001`, `UC-001`).

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

| Skill | Activation |
|---|---|
| `delphi-standards` | Auto-activated on Delphi file/code detection |
| `delphi-write` | Activated when writing new Delphi code |
| `delphi-laudo` | Activated by the `/audit` command |
| `delphi-spec` | Activated by the `/spec` command |
| `delphi-testes` | Activated by the `/tdd` command or automatically after `delphi-write` |
| `delphi-claudeignore` | Auto-activated on Delphi project detection to optimize token usage |

---

## Included Agents

| Agent | Purpose |
|---|---|
| `delphi-auditor` | Deep technical audit — 8 dimensions, scoring, 17-section report |
| `delphi-writer` | Writes complete, production-ready Delphi code following all standards |
| `delphi-spec-writer` | Generates the SPEC document from source code analysis |
| `delphi-tester` | Creates DUnitX unit test suites for Delphi classes |

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
