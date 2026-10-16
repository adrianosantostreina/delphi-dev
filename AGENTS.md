# AGENTS.md

Instruções para agentes de IA (Codex, OpenCode e outros) que trabalham **neste repositório**.
A versão completa e canônica é o [CLAUDE.md](CLAUDE.md); abaixo está o essencial.

## O que este repositório é

Fonte do plugin **`delphi-dev`** (um especialista em Delphi para agentes de IA). Não é um projeto
Delphi: o "código" é Markdown + JSON, mais o runtime TypeScript da base de conhecimento em `kb/`.

## Estrutura

- `skills/<nome>/SKILL.md` — conhecimento e protocolos; `references/` carrega sob demanda.
- `commands/*.md` — comandos de usuário; cada um tem entrada em `portable.json`.
- `agents/*.md` — subagentes.
- `knowledge/{core,fmx,community}/` — base de conhecimento (`core`/`fmx` canônicos; `community` subordinado).
- `kb/` (fonte) → `runtime/*.mjs` (bundles **commitados**). Depois de mudar `kb/src`, rode
  `cd kb && npm run build:runtime` e commite os bundles junto.
- `portable.json` — registro de comandos e exceções por agente.

## Regras que não podem ser quebradas

1. Idioma de saída: pt-BR (padrão) e en-US, conforme a conversa. Templates têm par `.en.md`.
2. Texto de skills/commands/agents é **neutro de ferramenta** (nada de "Agent tool", "Edit tool",
   `AskUserQuestion`). O lint cobra: `node runtime/kb-cli.mjs lint --root .`.
3. Skills são autossuficientes: referência a outra skill é **por nome**; arquivos da base usam `kb:<tier>/<arquivo>.md`.
4. Nada que roda na máquina do usuário pode exigir `npm install`, build local ou módulo nativo.
5. Arquivos `.dfm`/`.fmx` **nunca** levam BOM; fontes `.pas/.dpr/.dpk/.inc` levam.
6. Versão: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` e as linhas `Versão:` de
   `commands/about.md` andam juntas (o lint confere).
7. Não "simplifique" o `source` aninhado de `marketplace.json`.

## Como validar

```
cd kb && npm test && npx tsc --noEmit
node runtime/kb-cli.mjs lint --root .
```

Os arquivos de Codex e OpenCode são **gerados** por `kb-cli install` a partir do conteúdo acima;
não os edite à mão.
