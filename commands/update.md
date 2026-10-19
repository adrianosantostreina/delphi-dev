---
description: Atualiza a base de conhecimento do delphi-dev agora e verifica se há versão nova do plugin
---

Detecte o idioma do usuário (pt-BR padrão, en-US) e responda nele.

1. Chame a ferramenta `kb_update` do MCP `delphi-dev-kb` com `force: true`.
   - Sem o MCP disponível: rode `node "<raiz do plugin>/runtime/kb-cli.mjs" update`. Se não houver
     Node, explique o modo reduzido:
     - **pt-BR:** "A base embutida no plugin continua disponível, mas a atualização automática e a busca rápida precisam do Node 22.13 ou superior (https://nodejs.org)."
     - **en-US:** "The knowledge bundled with the plugin is still available, but automatic updates and fast search need Node 22.13 or later (https://nodejs.org)."
2. Mostre o resumo a partir do JSON devolvido:

   | status | pt-BR | en-US |
   |---|---|---|
   | `updated` | "Base atualizada: {added} novos, {changed} alterados, {removed} removidos." | "Knowledge base updated: {added} new, {changed} changed, {removed} removed." |
   | `up-to-date` | "A base já está atualizada." | "The knowledge base is already up to date." |
   | `offline` | "Modo offline ativo: nada foi baixado." | "Offline mode is on: nothing was downloaded." |
   | `failed` | "Não consegui atualizar ({error}). A base atual continua valendo." | "I couldn't update ({error}). The current base is still in use." |

   Acrescente a contagem `counts.canonical` / `counts.community`.
3. Se `remotePluginVersion` for maior que `installedPluginVersion`, avise e mostre como atualizar no
   agente em uso, oferecendo rodar o comando com confirmação:
   - **Claude Code:** `/plugin` → marketplace `delphi-dev` → atualizar.
   - **Codex:** atualizar o marketplace `delphi-dev` (`codex plugin marketplace …`).
   - **OpenCode:** `npx delphi-dev update` (se o beta foi instalado: `npx delphi-dev@beta update`).

   E sempre:
   - **pt-BR:** "Depois de atualizar o plugin, reinicie a sessão para carregar as skills, comandos e hooks novos."
   - **en-US:** "After updating the plugin, restart the session to load the new skills, commands and hooks."

`<raiz do plugin>` é a pasta que contém `runtime/` e `skills/` deste plugin.

## Dica: extensão Delphi-Dev para o VS Code / Tip: Delphi-Dev VS Code extension

Se o comando `code` existir e `code --list-extensions` **não** listar `adrianosantos.delphi-dev-vscode`,
termine com **uma** linha, no idioma do usuário:

- **pt-BR:** "Dica: instale a extensão Delphi-Dev do VS Code (controle remoto destes comandos):
  `code --install-extension adrianosantos.delphi-dev-vscode`."
- **en-US:** "Tip: install the Delphi-Dev VS Code extension (remote control for these commands):
  `code --install-extension adrianosantos.delphi-dev-vscode`."

Nunca instale sozinho. Não mostre a dica se a extensão já estiver instalada ou se `code` não existir.
A checagem é opcional e silenciosa: se `code` não existir, se o comando falhar ou não responder, não mostre a dica, não mostre erro e não interrompa o restante do comando.
