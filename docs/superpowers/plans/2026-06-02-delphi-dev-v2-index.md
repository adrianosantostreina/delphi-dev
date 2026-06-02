# delphi-dev v2.0 — Índice de Planos de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o plugin `delphi-dev` em um harness completo para desenvolvimento Delphi com instalação confiável via npx, RAG vetorial offline, hooks automáticos, KB migrada e extensão VS Code no Marketplace.

**Spec de referência:** `docs/superpowers/specs/2026-06-02-delphi-dev-v2-design.md`

---

## Planos por versão

| Versão | Arquivo | O que entrega | Critério de release |
|--------|---------|---------------|---------------------|
| **v2.0** | [2026-06-02-v2.0-monorepo-installer.md](2026-06-02-v2.0-monorepo-installer.md) | Monorepo + npx installer + VS Code Marketplace | `npx delphi-dev` funciona end-to-end |
| **v2.1** | [2026-06-02-v2.1-rag-hooks.md](2026-06-02-v2.1-rag-hooks.md) | RAG SQLite-vec + hooks + /contribute-kb + CI | UserPromptSubmit injeta contexto real |
| **v2.2** | [2026-06-02-v2.2-knowledge-skills.md](2026-06-02-v2.2-knowledge-skills.md) | KB migrada (38 arquivos) + rules + 8 skills novas | `/new-project` gera scaffold FMX mobile |
| **v2.3** | [2026-06-02-v2.3-encoding-build.md](2026-06-02-v2.3-encoding-build.md) | Hook encoding + delphi-builder + /build | `/build --tests` compila e roda DUnitX |
| **v2.4** | [2026-06-02-v2.4-spring4d-fmx.md](2026-06-02-v2.4-spring4d-fmx.md) | Spring4D + FMX completo + delphi-async | `/write` sugere injeção de interface com Spring4D |
| **v2.5** | [2026-06-02-v2.5-refactor-migrate.md](2026-06-02-v2.5-refactor-migrate.md) | /refactor + /migrate + delphi-migrator + agents | Projeto legado recebe plano via `/migrate` |
| **v2.6** | [2026-06-02-v2.6-vscode-webview.md](2026-06-02-v2.6-vscode-webview.md) | VS Code WebView RAG + status bar + CI Marketplace | Extensão no Marketplace; WebView lista aprendizados |
| **v2.7** | [2026-06-02-v2.7-suggestions.md](2026-06-02-v2.7-suggestions.md) | Sugestões aprovadas (FireDAC, ACBr, livebindings, etc.) | Feature-complete v2 |

---

## Pré-requisitos globais (antes de qualquer plano)

- Node.js ≥ 18 instalado
- Claude Code CLI instalado (`claude --version`)
- VS Code instalado (para planos que tocam `packages/vscode/`)
- Conta npm com `delphi-dev` reservado (para v2.0 publish)
- Conta VS Code Marketplace Publisher `adrianosantos` com PAT token (para v2.0)
- Secrets no GitHub: `NPM_TOKEN`, `VSCE_TOKEN`
- Repo `delphi-dev-vscode` acessível localmente em `D:\2.2 GitHub Adriano Santos\delphi-dev-vscode`

---

## Invariantes que nunca mudam

- Plugin content continua na raiz do repo (`.claude-plugin/`, `skills/`, `agents/`, `commands/`)
- Output bilíngue: pt-BR padrão + en-US detectado automaticamente
- Toda mudança de versão sincroniza: `plugin.json`, `marketplace.json`, `commands/about.md`, `README.md`, `README.pt-BR.md`
- Commits frequentes, um por task significativa
- Zero chamadas a APIs externas no runtime do usuário (tudo offline via `@xenova/transformers`)
