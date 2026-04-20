# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This repo is **not** a Delphi project — it is the source of the **`delphi-dev` Claude Code plugin** (a marketplace plugin that makes Claude a Delphi expert). The "code" is entirely markdown + JSON consumed by the Claude Code harness at install time. There is no build, lint, or test command.

Test changes by installing the plugin from a local checkout (`/plugin marketplace add <path>` then `/plugin install delphi-dev@delphi-dev`) and exercising the affected skill/command/agent in a real session. Changes to `.md` / `.json` files only take effect after re-install.

## Architecture: how the pieces wire together

Three primitives, each loaded by Claude Code differently:

- **Skills** (`skills/<name>/SKILL.md`) — auto-activated when their `description:` frontmatter matches user intent or detected files. They form the always-available knowledge layer. Some skills (`delphi-laudo`, `delphi-spec`, `delphi-standards`, `delphi-testes`) have a `references/` subdirectory the skill loads on demand to keep the base SKILL.md small.
- **Commands** (`commands/<name>.md`) — explicit slash commands (`/audit`, `/write`, etc.). Commands are thin orchestrators that delegate to skills + agents.
- **Agents** (`agents/<name>.md`) — subagents invoked via the Agent tool for heavier, isolated work (deep audit, full code generation, SPEC writing, test generation).

Key invocation flows worth knowing before editing:

- `/write` → `delphi-writer` agent. After delivering a class, `delphi-writer` is expected to **auto-invoke `delphi-tester` in silent mode** to generate `Teste<Class>.pas`. If you change the writer's contract, update the tester contract in the same change.
- `delphi-claudeignore` skill auto-runs when `.dpr`/`.dproj`/`.pas` are detected and creates/maintains `.claudeignore` at the project root. It must **never** ignore `.pas`/`.dfm`/`.dpr`/`.dpk`/`.inc`/`.fmx` — the deny-list of source extensions is enforced in `skills/delphi-claudeignore/SKILL.md`.
- `delphi-laudo` (the audit knowledge skill) and `delphi-auditor` (the agent) duplicate the 8-dimension scoring model. Keep both in sync — the agent has a fallback protocol used when the skill isn't loaded.

## Conventions baked into the plugin contract

### Language (output to user)

The plugin is bilingual: **pt-BR (default) and en-US**. Every skill/agent/command that produces user-facing output carries the same rule block:

> Detect the user's language from the first message; respond in that language. Default pt-BR. Honor explicit overrides ("respond in English" / "responda em português").

The internal prompt text in skill/agent files is in pt-BR — that's fine, Claude reads both. What needs to change with language is the **output**:

- **Report templates have parallel files**: pt-BR keeps the original name, en-US uses a `.en.md` suffix (e.g. `estrutura-laudo.md` ↔ `estrutura-laudo.en.md`, `spec-template.md` ↔ `spec-template.en.md`). The skill picks the file based on detected language. When you add a new template-driven feature, ship both files together or the en-US user gets pt-BR output.
- **Severity / classification labels** are bilingual: pt-BR `🚨 CRÍTICO / ⚠️ ATENÇÃO / 💡 RECOMENDAÇÃO / 🟢 BOM / 🟡 REGULAR / 🟠 CRÍTICO / 🔴 INVIÁVEL` ↔ en-US `🚨 CRITICAL / ⚠️ WARNING / 💡 RECOMMENDATION / 🟢 GOOD / 🟡 FAIR / 🟠 CRITICAL / 🔴 NOT VIABLE`. The mapping table lives at the bottom of `estrutura-laudo.en.md`.
- **User-facing notification strings** in skills/agents (`delphi-claudeignore`, `delphi-testes`, `delphi-tester`) are written as bilingual blocks — both translations live in the file under `**pt-BR:**` and `**en-US:**` headers; Claude picks the matching block at runtime.
- **`commands/about.md`** holds both language blocks; Claude renders only the matching one.

What stays in pt-BR regardless of selected language:

- **Delphi code identifiers in examples** (`FNome`, `ACliente`, `BuscarPorCodigo`) — they teach the naming convention itself.
- **Code prefixes** (`F`, `A`, `L`, `C_`, `T`, `I`, `E`).
- **Test method names** (`Test_<Metodo>_<Cenario>`).
- **SPEC requirement IDs** (`RF-001`, `RNF-001`, `RN-001`, `UC-001`, `US-001`, `AT-001`, `INT-001`).
- **Knowledge references** loaded into Claude's context (e.g. `clean-code-delphi.md`, `code-smells-delphi.md`, `style-guide.md`, `dunitx-patterns.md`, `skills/delphi-standards/references/*`) — these are prompts for Claude, not output for the user.

When adding a new command/skill/agent that produces user-facing output, replicate the language rule block and provide bilingual versions of any rendered template, label, or notification string.

### Coding standards the plugin teaches (user-session rules, not edit-this-repo rules)

Prefixes `F`/`A`/`L`/`C_`/`T`/`I`/`E`, no `with`/`Break`/`Continue`, no `Real`, no `const` on interface params (ARC), one resource per `try..finally`, parameterized SQL only. The canonical short reference lives in `skills/delphi-standards/SKILL.md`; the long-form rules live in its `references/`.

## Versioning — three files must stay in sync

When bumping the plugin version, update **all** of:

1. `.claude-plugin/plugin.json` → `"version"`
2. `.claude-plugin/marketplace.json` → `plugins[0].version`
3. `commands/about.md` → the `Versão:` line
4. `README.md` and `README.pt-BR.md` → "current version should be **X.Y.Z**"

`marketplace.json` uses an unusual nested `source` shape (`"source": {"source": "url", "url": "..."}`) — this was a deliberate fix (see commit `905fe6b`) for Claude Code plugin installation. Don't "simplify" it.

## Editing rules

- Both READMEs (`README.md` and `README.pt-BR.md`) must be updated together when commands, skills, or agents change.
- Skill `description:` frontmatter is the auto-activation trigger — be precise about file extensions and trigger phrases. Vague descriptions cause the skill to either never activate or activate spuriously.
- Don't add a new command without also: (a) listing it in both READMEs' feature table, (b) mentioning it in `commands/about.md`, (c) wiring it to a skill or agent that does the actual work.
