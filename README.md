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
| **`/e2e`** | Runs end-to-end scenarios against a running Delphi desktop app — builds it, opens the `.exe`, drives the screens and reports a verdict per scenario |
| **`/contribute-kb`** | Packages local learnings captured by the hooks and opens a PR to the community knowledge base *(needs hooks, currently disabled — see Installation)* |
| **`/dashboard`** | Displays GitHub repository metrics — stars, forks, issues, PRs, commits, releases, contributors |
| **`/about`** | Displays plugin info, version, and available commands |

---

## End-to-end testing with `/e2e` <sub>new in 3.2.0</sub>

Think of it as **Playwright for Delphi desktop apps**. You describe test scenarios in plain
language; the plugin builds the project, opens the `.exe`, drives the real screens, and returns
a **verdict per scenario** — correlated with your app's log.

```
/e2e login: blank password, wrong password, correct password
```

Without arguments, `/e2e` derives an "opens without error" scenario for each screen of the
main menu.

### Four verdicts, not two

The distinction is what separates a useful report from noise:

| Verdict | Meaning |
|---|---|
| ✅ PASS | Ran and matched the expectation |
| ❌ FAIL | Ran and diverged — **the app is wrong** |
| ⛔ BLOCKED | Couldn't run — **I don't know whether the app is wrong** |
| ⏭️ SKIPPED | Writes data and wasn't authorized at the gate |

A report that blames a bug where there was only state contamination is worse than no report.
So when a scenario can't be returned to its starting point, it comes back **⛔ BLOCKED, never
❌ FAIL**.

### It never steals focus

Clicks go through `PostMessage`, text through `WM_CHAR`, screenshots through `PrintWindow` —
so the plugin **never grabs your keyboard and never moves your cursor**. Screenshots work even
with the window fully covered, and `WM_CHAR` is immune to the dead-key problem of ABNT
keyboards that breaks `SendKeys`.

By default the app runs in the foreground so you can watch. Pass `--background` and it runs
behind your other windows without interrupting you.

### It stops and asks before touching your data

Before the first click, `/e2e` presents the scenarios it intends to run, **which ones write
data and what they write**, and waits. It never writes on its own initiative — it explores,
captures, and leaves through Cancel/Back.

### It reads your app's log

Delivery is not effect: a message can reach the window and still do nothing if the control
isn't in the expected state. That's why `/e2e` reads your log in parallel — it's the difference
between ⛔ BLOCKED and ❌ FAIL. If your app has no log, the plugin **offers** (never imposes)
either a minimal logging unit or a headless `--selftest` mode, and generates it following the
plugin's own coding standards.

> **Requirements:** Windows, and RAD Studio for the build step. FireMonkey is validated;
> VCL is a declared fallback. Android is out of scope by design.

---

## Installation

```bash
npx delphi-dev
```

This single command:
- Installs the Claude Code plugin
- Downloads the RAG knowledge base
- Installs the VS Code extension (if VS Code is detected)
- Removes any stale automation hooks left by older versions

**Requirements:** Node.js 18+, Claude Code CLI, git

> **Automation hooks are disabled since v2.2.2.** They depended on native modules
> that broke clean installs on Windows. The knowledge base still ships and the
> skills, commands and agents all work — what is currently off is the automatic
> per-prompt knowledge injection and session capture. They return with the local
> MCP server. **Do not register them by hand:** on v3.0.0 and earlier the capture
> path writes session noise into the index tagged as authoritative.

> **Nothing to do about the knowledge base right now.** The curated corpus ships as
> `rag.db` on each release and `npx delphi-dev` downloads it for you. It is currently
> **read by nothing**, because the only consumer is the per-prompt injection hook, which
> is off — so an install without it behaves identically. When the local MCP server lands,
> `npx delphi-dev update` will bring both the corpus and the code that reads it.

### Update

```bash
npx delphi-dev update
```

### Verify installation

```bash
npx delphi-dev verify
```

### Clean reinstall (upgrading from v1.x)

If you already had an old version (v1.x) installed and want to move to the new version from scratch, **first remove the old installation inside Claude Code**, then reinstall.

**1. Remove the old version** — commands run inside Claude Code:

```text
/plugin list                            # see what is installed
/plugin uninstall delphi-dev@delphi-dev # uninstall the plugin
/plugin marketplace remove delphi-dev   # remove the old marketplace
```

> Removing the marketplace also uninstalls plugins that came from it. Short forms `/plugin market` and `rm` are accepted.

**2. (Optional) clear the plugin cache** if anything gets stuck:

```bash
rm -rf ~/.claude/plugins/cache
```

**3. Clean install** — in the terminal:

```bash
npx delphi-dev
```

**4. Reload** — restart Claude Code or run `/reload-plugins` to load the new version.

#### Local install (development / testing)

To test from a local checkout of the repository — useful when developing the plugin itself:

```text
/plugin marketplace add <checkout-path>
/plugin install delphi-dev@delphi-dev
```

Changes to `.md` / `.json` files only take effect after reinstalling. To repeat the test cycle from a clean state, uninstall and re-add:

```text
/plugin uninstall delphi-dev@delphi-dev
/plugin marketplace remove delphi-dev
/plugin marketplace add <checkout-path>
/plugin install delphi-dev@delphi-dev
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
| `delphi-tests` | Activated by the `/tdd` command or automatically after `delphi-write` |
| `delphi-claudeignore` | Auto-activated on Delphi project detection to optimize token usage |
| `delphi-encoding` | Auto-activated on encoding/BOM/mojibake issues in Delphi files |
| `delphi-fmx` | Auto-activated for FireMonkey and Android/iOS mobile development |
| `delphi-firedac` | Auto-activated for FireDAC data-access code |
| `delphi-acbr` | Auto-activated for ACBr fiscal components (NFe/NFCe/boleto) |
| `delphi-async` | Auto-activated for async/threading (TTask, TThread, Synchronize) |
| `delphi-build` | Auto-activated for command-line build/compilation and build errors |
| `delphi-spring4d` | Auto-activated for Spring4D DI container and collections |
| `delphi-legacy` | Auto-activated for legacy code modernization/migration |
| `delphi-e2e` | Activated by the `/e2e` command — Windows only |

---

## Included Agents

| Agent | Purpose |
|---|---|
| `delphi-auditor` | Deep technical audit — 8 dimensions, scoring, 17-section report |
| `delphi-writer` | Writes complete, production-ready Delphi code following all standards |
| `delphi-spec-writer` | Generates the SPEC document from source code analysis |
| `delphi-tester` | Creates DUnitX unit test suites for Delphi classes |

---

## Roadmap

See [ROADMAP.md](ROADMAP.md) for what is planned and how to influence priorities. Phases under discussion include automatic encoding handling (UTF-8/BOM), mobile FMX scaffolding, Spring4D dependency injection, and a build/validation pipeline that lets Claude actually compile and verify the code it generates.

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
