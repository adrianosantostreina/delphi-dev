# Changelog

## [3.0.0] - 2026-10-15

### Added
- Controls **Claude Code, Codex and OpenCode** from the same sidebar, menus and command palette.
- Agent selection: setting `delphiDev.agent` (auto / claude / codex / opencode), a status bar picker and
  a one-time question when several agents are installed.
- OpenCode: starts `opencode --port` in its own terminal and sends the command through the TUI API.
- Codex: opens the panel and copies the command (experimental prompt URI behind `delphiDev.codexPromptUri`).
- Warns when the delphi-dev plugin is not installed for the chosen agent and offers the install command.
- Command list now comes from the plugin registry (`portable.json`): adds Dashboard, E2E test and Update
  knowledge base; sidebar labels follow the VS Code UI language (pt-BR / en).

### Fixed
- Executables (`opencode`) are now looked up on `PATH` with the file system; nothing is executed to detect an agent.
- Activation no longer fails when `delphiDev.agent` holds an invalid value (it reads as `auto`).
- OpenCode: a missing install is reported (with the install command) instead of opening a terminal and waiting;
  a stuck or foreign "OpenCode - Delphi Dev" terminal is replaced; a draft in the prompt is cleared before the
  command is appended; only the step that failed is retried.
- Dismissing the agent picker is silent (no "no agent found" error).
- "Choose Agent" lists only installed agents and no longer stores a pointless choice when there is just one.
- Claude Code: without the extension the install offer is shown instead of trying a `vscode://` link that may
  have no handler.
- The "plugin not installed" warning and the "command copied" toast no longer delay the command.

### Security
- Workspace Trust: `delphiDev.agent`, `delphiDev.opencodePort` and `delphiDev.codexPromptUri` are ignored from the
  workspace in Restricted Mode (`untrustedWorkspaces: limited`); virtual workspaces are not supported.

### Removed
- Build, Refactor and Migrate entries (the plugin never shipped those commands).
- Hard dependency on the Claude Code extension (`extensionDependencies`): Codex and OpenCode users no longer
  need it. The extension is offered only when Claude Code is the chosen agent.

### Changed
- The .claudeignore offer only appears when Claude Code is installed.
- Display name is now "Delphi Dev"; the repository link points to the monorepo (`packages/vscode`).

## [0.1.0] - 2026-04-04

### Added
- Sidebar with Delphi Dev commands (Write, Review, Audit, Spec, TDD, New Project)
- Context menu integration for Delphi files (.pas, .dpr, .dfm, .dpk, .inc, .fmx)
- Status bar indicator for Delphi projects
- Automatic .claudeignore creation for Delphi projects
- 12 Delphi code snippets following delphi-dev coding standards
- Editor defaults for Pascal files (2-space indent, 120-char ruler)
- Claude Code integration via URI handler
- Command palette support for all delphi-dev commands
