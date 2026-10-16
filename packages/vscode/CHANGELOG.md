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
