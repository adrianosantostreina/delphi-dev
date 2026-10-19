---
description: Information about the delphi-dev plugin — author, version, and features
---

Detect the user's language from the first message and display the matching block below.
Default: pt-BR. Supported: pt-BR, en-US.

Honor explicit overrides:
- "respond in English" / "in English please" → en-US
- "responda em português" → pt-BR

---

## en-US — display this block when the user's language is English

**delphi-dev** — Claude Code Plugin

- **Version:** 4.0.0-beta.2
- **Author:** Adriano Santos
- **Email:** adrianosantospro@gmail.com
- **GitHub:** https://github.com/adrianosantostreina/delphi-dev
- **License:** MIT © 2026 Adriano Santos

**Status** — call the `kb_health` tool of the `delphi-dev-kb` MCP server and fill in:

- **Agent:** the agent you are running in (Claude Code, Codex or OpenCode)
- **Node:** `node` (append "— fast search unavailable, install Node 22.13+" when `indexSupported` is false)
- **Knowledge base:** `source` (embedded / updated), commit `commit` (first 7 chars), `counts.canonical` canonical + `counts.community` community files, last check `lastCheck`
- **Newer plugin available:** show `remotePluginVersion` only when it is greater than the version above

Without the MCP server, show "Knowledge base: reduced mode — run /update for details".

---

**What this plugin does:**

Turns Claude into a senior Delphi expert. When Delphi code is detected, it automatically
applies the Delphi Style Guide, Clean Code, and SOLID patterns — without being asked.

---

**Output language:** pt-BR (default) or en-US. The plugin detects the language of the
user's first message and responds in that language. Switch any time with
"respond in English" or "responda em português".

---

**Available commands:**

| Command | Description |
|---|---|
| `/audit` | Generates a complete professional technical audit with score and recommendations |
| `/review` | Quick code review — detects violations and suggests fixes |
| `/write` | Writes new code with all standards applied automatically |
| `/new-project` | Scaffolds a new project with a standardized folder structure |
| `/spec` | Generates a software specification document (SPEC) for the project or module |
| `/tdd` | Generates a complete DUnitX unit test suite for the project |
| `/e2e` | Runs end-to-end scenarios against a running Delphi desktop app — builds it, opens the `.exe`, drives the screens and reports a verdict per scenario (Windows only) |
| `/contribute-kb` | Drafts one Delphi learning from the current conversation and, with your approval, sends it to the community knowledge base |
| `/update` | Updates the knowledge base now and checks for a newer plugin version |
| `/dashboard` | Shows GitHub repository metrics (stars, forks, issues, PRs, commits, releases) |
| `/about` | Shows this information |

---

**Based on:**
- Delphi Coding Standards v4.0.1 — Adriano Santos
- Clean Code and Best Practices in Delphi — Adriano Santos
- Clean Code — Robert C. Martin
- Delphi Style Guide — Embarcadero

---

## pt-BR — exiba este bloco quando o idioma do usuário for português

**delphi-dev** — Claude Code Plugin

- **Versão:** 4.0.0-beta.2
- **Autor:** Adriano Santos
- **Email:** adrianosantospro@gmail.com
- **GitHub:** https://github.com/adrianosantostreina/delphi-dev
- **Licença:** MIT © 2026 Adriano Santos

**Status** — chame a ferramenta `kb_health` do MCP `delphi-dev-kb` e preencha:

- **Agente:** o agente em que você está rodando (Claude Code, Codex ou OpenCode)
- **Node:** `node` (acrescente "— busca rápida indisponível, instale o Node 22.13+" quando `indexSupported` for false)
- **Base de conhecimento:** `source` (embutida / atualizada), commit `commit` (7 primeiros caracteres), `counts.canonical` arquivos canonical + `counts.community` community, última checagem `lastCheck`
- **Versão nova do plugin:** mostre `remotePluginVersion` só quando for maior que a versão acima

Sem o MCP, mostre "Base de conhecimento: modo reduzido — use /update para detalhes".

---

**O que este plugin faz:**

Transforma o Claude em um especialista sênior em Delphi. Ao detectar código Delphi,
aplica automaticamente o Delphi Style Guide, Clean Code e padrões SOLID — sem precisar ser solicitado.

---

**Idioma de saída:** pt-BR (padrão) ou en-US. O plugin detecta o idioma da primeira
mensagem do usuário e responde nesse idioma. Troque a qualquer momento com
"responda em português" ou "respond in English".

---

**Comandos disponíveis:**

| Comando | Descrição |
|---|---|
| `/audit` | Gera laudo técnico profissional completo com score e recomendações |
| `/review` | Revisão rápida de código — detecta violações e sugere correções |
| `/write` | Escreve código novo com todos os padrões aplicados automaticamente |
| `/new-project` | Scaffold de novo projeto com estrutura de pastas padronizada |
| `/spec` | Cria documento de especificação de software (SPEC) do projeto ou módulo |
| `/tdd` | Gera suite completa de testes unitários DUnitX para o projeto |
| `/e2e` | Executa cenários end-to-end num app Delphi desktop em execução — builda, abre o `.exe`, opera as telas e devolve um veredito por cenário (somente Windows) |
| `/contribute-kb` | Redige um aprendizado de Delphi a partir da conversa e, com sua aprovação, envia para a base comunitária |
| `/update` | Atualiza a base de conhecimento agora e verifica se há versão nova do plugin |
| `/dashboard` | Exibe métricas do repositório GitHub (estrelas, forks, issues, PRs, commits, releases) |
| `/about` | Exibe estas informações |

---

**Baseado em:**
- Normas e Padronização de Codificação Delphi v4.0.1 — Adriano Santos
- Código Limpo e Boas Práticas em Delphi — Adriano Santos
- Clean Code — Robert C. Martin
- Delphi Style Guide — Embarcadero

## Dica: extensão Delphi-Dev para o VS Code / Tip: Delphi-Dev VS Code extension

Se o comando `code` existir e `code --list-extensions` **não** listar `adrianosantos.delphi-dev-vscode`,
termine com **uma** linha, no idioma do usuário:

- **pt-BR:** "Dica: instale a extensão Delphi-Dev do VS Code (controle remoto destes comandos):
  `code --install-extension adrianosantos.delphi-dev-vscode`."
- **en-US:** "Tip: install the Delphi-Dev VS Code extension (remote control for these commands):
  `code --install-extension adrianosantos.delphi-dev-vscode`."

Nunca instale sozinho. Não mostre a dica se a extensão já estiver instalada ou se `code` não existir.
A checagem é opcional e silenciosa: se `code` não existir, se o comando falhar ou não responder, não mostre a dica, não mostre erro e não interrompa o restante do comando.
