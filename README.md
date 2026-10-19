# delphi-dev — Claude Code Plugin

> A Claude Code plugin that turns the assistant into a senior Delphi expert.
> 🇧🇷 [Leia em Português](README.pt-BR.md)

> [!WARNING]
> **BETA — `v4.0.0-beta.2` (pre-release, for testing).** This is a preview of the next major version,
> published so it can be tried on real projects before the final release. **Nothing below changes
> the stable version**: `npx delphi-dev` still installs the stable one, and the beta is only
> installed on purpose, with the commands in [Beta: install, go back, report](#beta-install-go-back-report).
> Do not make it your only setup on a machine you cannot afford to break.

---

## Beta: install, go back, report

**What the beta covers**

- **Claude Code**, as always: the same commands, skills, agents, hooks and knowledge base.
- **Codex** and **OpenCode** (new): skills, commands, subagents, knowledge base (MCP) and hooks, in the terminal and in their VS Code extensions.
- A **multi-agent VS Code extension** (new): runs the Delphi commands on Claude Code, Codex or OpenCode.

**How to install each part** (use ONE method for Claude Code; do not mix them)

| Part | Command |
|---|---|
| Claude Code, via `npx` | `npx delphi-dev@beta` |
| Codex and/or OpenCode | `npx delphi-dev@beta --target codex` (or `opencode`, or `all` — `all` also installs Claude Code) |
| Claude Code, via the plugin marketplace | `/plugin marketplace add adrianosantostreina/delphi-dev#v4.0.0-beta.2` and then `/plugin install delphi-dev@delphi-dev` |
| VS Code extension | download `delphi-dev-vscode-v4.0.0-beta.2.vsix` from the [Releases page](https://github.com/adrianosantostreina/delphi-dev/releases) (the one marked *Pre-release*) and run `code --install-extension delphi-dev-vscode-v4.0.0-beta.2.vsix` |

- `@beta` selects the beta on npm; plain `npx delphi-dev` is still the stable version. In the marketplace command, the `#v4.0.0-beta.2` part is what pins the beta.
- If you already have delphi-dev in Claude Code, remove it first: `/plugin marketplace remove delphi-dev` (this also uninstalls the plugin). Claude Code refuses to add a second marketplace named `delphi-dev` from a different source.
- `npx delphi-dev@beta update` keeps you on the beta; it never silently jumps back to the stable version.
- The beta extension is **not** on the VS Code Marketplace, and the installer does not install it for you.

**Going back to the stable version**

1. Claude Code: `claude plugin uninstall delphi-dev@delphi-dev` and `claude plugin marketplace remove delphi-dev` (or the same `/plugin ...` commands inside a session).
2. If you used `npx`: delete the folders `~/.claude/plugins/delphi-dev` and `~/.delphi-dev/plugin` (on Windows: `%USERPROFILE%\.claude\plugins\delphi-dev` and `%USERPROFILE%\.delphi-dev\plugin`). They are only the installer's own copies of the plugin. The beta leaves them pinned to the beta tag, and the currently published stable installer cannot update a pinned copy.
3. Install the stable version again: `npx delphi-dev` (or `/plugin marketplace add adrianosantostreina/delphi-dev` and `/plugin install delphi-dev@delphi-dev`).
4. Codex/OpenCode: `npx delphi-dev uninstall` removes only what delphi-dev installed there.
5. VS Code extension: `code --uninstall-extension adrianosantos.delphi-dev-vscode`.

**Known limitations**

- **Codex**: commands are skills (`$delphi-cmd-<name>`); from VS Code the extension opens the Codex panel and **copies** the command for you to paste. Hooks (BOM/encoding fix and knowledge injection) only run after you trust them once with `/hooks` in Codex.
- **OpenCode**: from VS Code the command is typed into the terminal where the extension started `opencode --port 4096`. If an `opencode serve`/`web` server without a TUI is already on that port, the command can be lost; use the terminal the extension creates.
- Knowledge search and prompt injection need Node.js 22.13+ (reduced mode otherwise).
- **Antigravity is out of scope** for this beta.
- The knowledge base updates itself from a `kb-latest` release published by the maintainer. Until that release exists, `/about` may show an HTTP 404 for the update check; the embedded base keeps working.

**Reporting a problem** — open an [Issue](https://github.com/adrianosantostreina/delphi-dev/issues) with: your OS, `node -v`, the agent and its version, the exact command you ran, and the output of `npx delphi-dev@beta verify` and `claude plugin list`. For Codex/OpenCode also attach `node ~/.delphi-dev/plugin/runtime/kb-cli.mjs doctor` (on Windows: `node %USERPROFILE%\.delphi-dev\plugin\runtime\kb-cli.mjs doctor`).

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
| **`/contribute-kb`** | Drafts one Delphi learning from the conversation and, with your approval, sends it to the community knowledge base (PR via `gh` or a prefilled issue) |
| **`/update`** | Updates the knowledge base now and checks for a newer plugin version |
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
- Ships the knowledge base inside the plugin (it then updates itself daily)
- Installs the VS Code extension (if VS Code is detected)
- Removes any stale automation hooks left by older versions

**Requirements:** Claude Code CLI and git. `npx delphi-dev` needs Node.js 18+. The BOM hook runs on Node 18+; fast knowledge search, prompt injection and daily updates need Node.js 22.13+. Without it the plugin still works in reduced mode.

> **Knowledge base and hooks (v4).** The plugin ships its Delphi knowledge base and checks once a
> day for updates published by the maintainer — no database download, no native modules. Two
> hooks run automatically: one adds a UTF-8 BOM to `.pas`/`.dpr`/`.dpk`/`.inc` files (never to
> `.dfm`/`.fmx`; it also rewrites accents inside `.dfm`/`.fmx` strings as `#NNN` escapes, the way the
> IDE saves them, and never touches ANSI, UTF-16 or binary files), and one adds up to three short knowledge excerpts to Delphi-related prompts. An
> MCP server (`delphi-dev-kb`) lets the agent search the base on demand. Run `/update` to refresh now.

### Codex and OpenCode

```bash
npx delphi-dev --target codex      # or: opencode, or: all
```

Without `--target`, `npx delphi-dev` installs **only Claude Code**, exactly as before. If it detects
Codex or OpenCode (CLI, config folder or VS Code extension) it just prints the command to run; it
never writes to their config unless you pass `--target codex|opencode|all`. With `--target` it clones
the plugin to `~/.delphi-dev/plugin` and writes:

| | Codex | OpenCode |
|---|---|---|
| Skills | `~/.agents/skills` | `~/.agents/skills` (same folder) |
| Commands | skills `$delphi-cmd-<name>` (e.g. `$delphi-cmd-audit`) | `/delphi-<name>` (e.g. `/delphi-audit`) |
| Subagents | `~/.codex/agents/*.toml` | `~/.config/opencode/agents/*.md` |
| Knowledge base (MCP) | `config.toml` | `opencode.json` |
| Hooks | `hooks.json` (trust once with `/hooks`) | `plugins/delphi-dev.js` |

Restart the agent session after installing. In Codex, type `$delphi-cmd-audit` (or any other
`$delphi-cmd-<name>`) in the terminal or in the VS Code extension; in OpenCode, type `/delphi-audit`
(or any other `/delphi-<name>`). The Delphi knowledge skills load on their own when you work on
Delphi code.

It never overwrites files that are not its own: your config, hooks and other skills are preserved,
and `npx delphi-dev uninstall` removes only what it installed. Use `--dry-run` to preview and
`--scope project --project <dir>` to install skills, commands and subagents inside one repository.
If your agent has no hook support for a file edit, the `delphi-encoding` skill runs
`kb-cli fix-encoding` as a safety net.

Exit codes of `npx delphi-dev --target …` and `kb-cli install`: **0** everything applied; **1** an
execution error; **2** it ran but some items were refused or skipped to protect your files (a
JSONC/invalid config, a conflicting entry, a file you edited) — it prints `N item(ns) não aplicado(s)`
and never reports that as a clean install; **64** wrong usage. Replaced skill folders are backed up
under `~/.delphi-dev/backups/<timestamp>/`, never next to the skills.

Known limitations:

- **Codex hooks need your approval once.** Run `/hooks` in Codex and trust the delphi-dev hooks;
  until then the BOM/encoding fix and the knowledge injection do not fire (the skills and the MCP
  server work regardless).
- **Knowledge search and prompt injection need Node.js 22.13+** (same as on Claude Code); without
  it the skills and commands still work, in reduced mode.
- **Antigravity is not supported yet** (out of scope for now; tracked in issue #9).
- The Claude Code install is unchanged: plugin, hooks, commands and agents work exactly as before.

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
