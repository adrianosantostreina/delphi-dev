---
name: delphi-contribute
description: Redige, verifica e envia UM aprendizado sobre desenvolvimento Delphi para a base de conhecimento comunitária do delphi-dev, com aprovação explícita do usuário. Use quando o usuário chamar /contribute-kb, disser "quero contribuir", "enviar aprendizado", "contribute knowledge", ou quando a skill delphi-standards indicar que vale sugerir uma contribuição.
---

# delphi-contribute

## Idioma

Detecte o idioma da conversa e use-o em tudo que o usuário lê (pt-BR padrão, en-US quando ele
escreve em inglês). O idioma do sistema operacional só desempata quando não há conversa suficiente.
Respeite pedidos explícitos ("respond in English", "responda em português").

## Modos

- **Manual** — o usuário chamou `/contribute-kb`. Opções finais: Aprovar / Recusar.
- **Sugestão** — veio da regra da `delphi-standards`. Antes de qualquer coisa, leia a preferência:
  ferramenta `kb_prefs` com `action: get` (MCP `delphi-dev-kb`); sem MCP, leia
  `~/.delphi-dev/config.json`. Se `suggestions` for `off`, **pare sem dizer nada**.
  Opções finais: Aprovar / Recusar / Não mostrar novamente.

## Protocolo

1. **Escolha um aprendizado** da conversa: o problema não trivial que foi resolvido. Um só.
2. **Redija** neste formato, no idioma da conversa:

   ```markdown
   ---
   title: <frase curta que alguém buscaria>
   category: <bugs | architecture | patterns | failures | general>
   tags: <termos em pt e en separados por vírgula, incluindo códigos de erro>
   source: community
   lang: <pt-BR | en-US>
   ---
   # <título>

   ## Sintoma
   ## Causa
   ## Solução
   ## Exemplo genérico
   ```

   Regras de redação:
   - Use identificadores didáticos (`TCliente`, `FNome`, `ACliente`, `BuscarPorCodigo`). **Nunca**
     nomes de classes, tabelas, units, caminhos, servidores ou empresas do projeto do usuário.
   - Nenhum trecho de código do projeto: escreva um exemplo mínimo novo.
   - Corpo entre 200 e 8000 caracteres.
3. **Grave** num arquivo temporário (ex.: `%TEMP%\delphi-dev-contribuicao.md` ou `/tmp/...`).
4. **Escaneie**: `node "<raiz do plugin>/runtime/kb-cli.mjs" scan "<arquivo>"`.
   - Saída com achados (código 2) → mostre as linhas, reescreva de forma genérica, grave e escaneie
     de novo. **Nunca** envie com achado.
   - Sem Node → revise você mesmo contra a lista: chaves privadas, tokens (`ghp_`, `npm_`, `AKIA`,
     JWT), senhas e strings de conexão, IPs, e-mails, CPF/CNPJ, caminhos com nome de usuário. A CI
     do PR roda o scanner de novo.
5. **Mostre o texto exato** dentro de um bloco de código, precedido do aviso:
   - **pt-BR:** "Vou compartilhar só o texto abaixo — um aprendizado sobre desenvolvimento Delphi.
     Nenhum código, dado, arquivo ou credencial do seu projeto vai junto. Revise antes de aprovar."
   - **en-US:** "I'll share only the text below — a learning about Delphi development. No code,
     data, files or credentials from your project go with it. Review it before approving."
6. **Pergunte** com a ferramenta de pergunta do seu ambiente (no Claude Code, `AskUserQuestion`;
   no Codex, `request_user_input`; no OpenCode, `question`). Sem ferramenta, ofereça opções numeradas.

   | pt-BR | en-US |
   |---|---|
   | Aprovar | Approve |
   | Recusar | Decline |
   | Não mostrar novamente *(só no modo sugestão)* | Don't show again *(suggestion mode only)* |

7. **Aja**:
   - Aprovar → `node "<raiz do plugin>/runtime/kb-cli.mjs" contribute "<arquivo>"`. A saída é JSON
     `{via, url, clipboard}`. Mostre o link.
     - `via: "pr"` — **pt-BR:** "Pull request aberto: <url>. Obrigado! O mantenedor revisa antes de entrar na base." **en-US:** "Pull request opened: <url>. Thank you! The maintainer reviews it before it joins the base."
     - `via: "issue"` — **pt-BR:** "Abri o formulário no navegador. Confira e clique em *Submit new issue*." **en-US:** "I opened the form in your browser. Check it and click *Submit new issue*."
     - `clipboard: true` — acrescente: **pt-BR:** "O texto era longo para o link e foi copiado para a área de transferência: cole no campo *Aprendizado / Learning*." **en-US:** "The text was too long for the link and was copied to your clipboard: paste it into the *Aprendizado / Learning* field."
   - Sem Node → entregue ao usuário o link do formulário
     `https://github.com/adrianosantostreina/delphi-dev/issues/new?template=kb-contribution.yml` e
     peça que cole o texto no campo *Aprendizado / Learning*. **pt-BR:** "Sem o Node não consigo
     enviar daqui. Abra este link e cole o texto acima no campo *Aprendizado / Learning*: <link>."
     **en-US:** "Without Node I can't send it from here. Open this link and paste the text above into
     the *Aprendizado / Learning* field: <link>."
   - Recusar → descarte o arquivo; não insista.
   - Não mostrar novamente → `kb_prefs` com `action: set, suggestions: off` (sem MCP:
     `node "<raiz do plugin>/runtime/kb-cli.mjs" prefs set --suggestions off`). Confirme:
     **pt-BR:** "Não vou mais sugerir. Quando quiser contribuir, use /contribute-kb." **en-US:** "I won't suggest it again. Whenever you want to contribute, use /contribute-kb."
8. Apague o arquivo temporário.

`<raiz do plugin>` é a pasta que contém `runtime/` e `skills/` deste plugin.
