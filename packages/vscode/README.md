# Delphi Dev

VS Code extension that integrates the [delphi-dev](https://github.com/adrianosantostreina/delphi-dev) plugin with Visual Studio Code. It works with **Claude Code, Codex and OpenCode**.

Transform Claude Code into a **senior Delphi expert** with code review, technical audit, TDD, SPEC generation, and coding standards enforcement — all accessible from the VS Code UI.

## Requirements

- At least one supported agent (see [Supported agents](#supported-agents)); for Claude Code, the [Claude Code VS Code Extension](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code)
- The [delphi-dev](https://github.com/adrianosantostreina/delphi-dev) plugin installed for that agent (`npx delphi-dev`)

## Features

### Sidebar Commands

Access all delphi-dev commands from the activity bar:

| Command | Description |
|---------|-------------|
| **Write Code** | Create new Delphi code with all standards applied |
| **Review Code** | Quick code review detecting style violations |
| **Audit Project** | Generate a complete technical audit report |
| **Generate Spec** | Auto-generate SPEC document from source code |
| **Generate Tests (TDD)** | Generate DUnitX test suite |
| **New Project** | Scaffold a new Delphi project with standard structure |
| **E2E Test** | End-to-end scenarios on the running desktop app |
| **Dashboard** | GitHub repository metrics |
| **Update Knowledge Base** | Update the knowledge base and check the plugin |

### Context Menu

Right-click any Delphi file (`.pas`, `.dpr`, `.dfm`, `.dpk`, `.inc`, `.fmx`) in the editor or explorer to access Review, Audit, and TDD commands.

### Status Bar

A "Delphi Dev" indicator appears in the status bar when a Delphi project is detected in the workspace.

### Auto .claudeignore

When a Delphi project is detected, the extension offers to create a `.claudeignore` file that excludes binaries, compiled files, and IDE configuration — optimizing Claude Code's token usage.

### Delphi Code Snippets

12 code snippets following delphi-dev coding standards:

| Prefix | Description |
|--------|-------------|
| `dclass` | Class with strict private, constructor, destructor |
| `dintf` | Interface with GUID |
| `dservice` | Service class with constructor injection |
| `drepo` | Repository class skeleton |
| `dtry` | Try..finally block for resource management |
| `dconst` | Constant with `C_` prefix |
| `dprop` | Property with F field and A parameter |
| `dmethod` | Method with A-prefixed params, L-prefixed locals |
| `denum` | Enumerated type with mnemonic prefix |
| `dunit` | Complete unit file skeleton |
| `dtest` | DUnitX test fixture skeleton |
| `dform` | Form unit skeleton |

### Editor Defaults

Automatically configures Pascal/ObjectPascal files with:
- 2-space indentation (spaces, not tabs)
- 120-character ruler
- Word wrap off

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `delphiDev.autoCreateClaudeignore` | `true` | Offer to create .claudeignore for Delphi projects |
| `delphiDev.showStatusBar` | `true` | Show status bar indicator |
| `delphiDev.language` | `pt-BR` | Language for prompts sent to Claude Code |
| `delphiDev.agent` | `auto` | Agent that receives the commands: `auto`, `claude`, `codex` or `opencode` |
| `delphiDev.opencodePort` | `4096` | Port of the OpenCode server (`opencode --port`); a server already listening there is reused |
| `delphiDev.codexPromptUri` | `false` | Experimental: try to prefill the Codex composer through its prompt URI |

## How It Works

The extension acts as a **graphical front-end** for the delphi-dev plugin. When you click a command, it hands the matching command (e.g., `/review @file.pas`) to the chosen agent. The delphi-dev plugin handles all the AI-powered analysis.

## Supported agents

| Agent | How commands are delivered |
|---|---|
| Claude Code | Sent straight to the Claude Code panel |
| Codex | Opens the Codex panel and copies `$delphi-cmd-<name>`; paste and press Enter |
| OpenCode | Runs `opencode --port 4096` in a terminal and submits `/delphi-<name>` through its API |

Install the plugin for your agent with `npx delphi-dev` (it detects Claude Code, Codex and OpenCode).
Choose the agent in the status bar or with the `delphiDev.agent` setting.

**OpenCode caveat:** if an `opencode serve` / `opencode web` server is already running on the configured port
without a TUI attached, the command may not reach anything (the API answers 200 even with no TUI connected).
In that case use the terminal created by the extension (stop the other server, or change `delphiDev.opencodePort`).
## Author

**Adriano Santos** — [adrianosantospro@gmail.com](mailto:adrianosantospro@gmail.com)

## License

MIT
