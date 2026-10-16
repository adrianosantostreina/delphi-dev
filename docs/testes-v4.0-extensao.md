# Testes manuais - extensao Delphi-Dev multiagente (3.0.0)

Este roteiro e para voce executar na sua maquina. Cada teste diz: o que abrir, o que clicar, o que deve aparecer
e o que me mandar se falhar. Nao precisa entender de teste: e so seguir e marcar **OK** ou **FALHOU** na coluna
"Resultado" (ou copiar a tabela para um bloco de notas).

## O que a automacao ja provou (e o que nao)

| Parte | Provado por automacao | Depende de voce |
|---|---|---|
| Logica de entrega dos 3 agentes, escolha do agente, aviso de plugin ausente | Sim, 58 testes unitarios (`packages/vscode`) com dependencias **falsas** (nenhum VS Code, rede ou terminal real) | Ver funcionando no VS Code de verdade |
| Lista de comandos igual ao `portable.json`, `package.json` em sincronia | Sim (`npm run check:registry` + testes) | - |
| API HTTP da TUI do OpenCode (`/global/health`, `/tui/append-prompt`, `/tui/submit-prompt`) | Provada contra o OpenCode **1.19.1** (ver `docs/testes-v4.0-codex-opencode.md`) | Conferir que o comando **executa** na TUI aberta pelo VS Code (testes 8 a 11) |
| Codex | **So lido**: nenhum teste conversou com o Codex real. Os comandos `chatgpt.openSidebar` / `chatgpt.newCodexPanel` e o formato `vscode://openai.chatgpt/?prompt=` nao sao documentados | Testes 4 a 7 (o 6 decide o padrao do Codex) |
| Claude Code | Mesmo caminho de envio da extensao antiga (`claude-vscode.primaryEditor.open` e URI de reserva), coberto por teste unitario | Testes 1 a 3 e 15 |
| Pacote `.vsix` | Gerado e conferido localmente: `dist/extension.js`, README, CHANGELOG, LICENSE, icone e snippets entram; `src/`, testes e `node_modules` nao | Instalar o `.vsix` (opcao B abaixo) |
| Publicacao no Marketplace | **Nada** foi publicado. O workflow foi corrigido e validado so como YAML | Criar o segredo `VSCE_TOKEN` e decidir quando publicar |

## Como carregar a extensao para testar

Escolha **uma** das duas opcoes. A opcao A nao mexe no seu VS Code normal.

### Opcao A - Extension Development Host (recomendada)

1. Abra um terminal na raiz do repositorio `delphi-dev` e rode:

   ```bash
   cd packages/vscode
   npm install
   npm run build
   ```

   Deve terminar com `Build complete.`

2. Abra o VS Code **ja com a extensao de desenvolvimento**, apontando para uma pasta de projeto Delphi
   (troque o caminho final pelo seu projeto):

   ```bash
   code --extensionDevelopmentPath="D:\2.2 GitHub Adriano Santos\delphi-dev\packages\vscode" "D:\caminho\do\seu\projeto-delphi"
   ```

   Abre uma janela nova (e o "Extension Development Host"). Ela precisa ter arquivos `.pas`, `.dpr` ou `.dfm`
   na pasta, senao a extensao nao ativa.

   Alternativa pelo VS Code: abra a pasta `packages/vscode`, tecle **F5** e, se perguntar o ambiente, escolha
   "VS Code Extension Development". (Nao ha `launch.json` no repositorio; a linha de comando acima e mais simples.)

3. Na janela nova: na barra lateral esquerda aparece um icone **Delphi Dev**. Clique nele: a lista de comandos
   deve aparecer (Auditar projeto, Revisar codigo, Escrever codigo, ... 11 itens). Na barra de baixo aparece
   **Delphi Dev**, com o nome do agente depois do ponto quando ele for conhecido.

   Se nada disso aparecer: **me mande** o texto de `Ctrl+Shift+P` > "Developer: Show Running Extensions" e de
   `Ctrl+Shift+U` (painel Output) > escolha "Extension Host".

### Opcao B - Instalar o `.vsix` local (testa o pacote de verdade)

```bash
cd packages/vscode
npm install
npx vsce package --no-dependencies --out "%TEMP%\delphi-dev-vscode-3.0.0.vsix"
code --install-extension "%TEMP%\delphi-dev-vscode-3.0.0.vsix"
```

No PowerShell troque `%TEMP%` por `$env:TEMP`. Salvar fora do repositorio evita um arquivo `.vsix` solto no Git.
**Nao use `vsce publish`.** Isto **substitui** a versao instalada (a sua e a 0.1.0). Para voltar atras:
`code --uninstall-extension adrianosantos.delphi-dev-vscode` e instale a versao antiga de novo.
Feche e abra o VS Code depois de instalar.

## Antes de comecar

- Tenha um projeto Delphi aberto (pasta com `.pas`/`.dpr`).
- Para cada agente que for testar, tenha o **plugin instalado** nele: `npx delphi-dev --target claude|codex|opencode`
  (ou, do checkout: `node runtime/kb-cli.mjs install --target all`).
- Para alternar de agente use o seletor da barra de baixo ou a configuracao `delphiDev.agent`
  (`Ctrl+,` > procure "delphiDev").
- Sempre que um teste falhar, anote: o numero do teste, o que voce clicou, a mensagem que apareceu (print ajuda)
  e o conteudo de `Ctrl+Shift+U` > Output > "Extension Host".

## Matriz

| # | Agente | O que fazer | O que deve aparecer | Se falhar, me mande | Resultado |
|---|---|---|---|---|---|
| 1 | Claude | Em `delphiDev.agent` escolha `claude`. Clique em **Auditar projeto** na barra lateral | O painel do Claude Code abre e ja traz `/audit` (em geral enviado sozinho) | Print do painel + Output "Extension Host" | |
| 2 | Claude | Abra um `.pas`, selecione algumas linhas, clique com o botao direito > **Delphi Dev: Review code** | O Claude recebe `/review @caminho\arquivo.pas:inicio-fim` (com as linhas selecionadas) | O texto que chegou no Claude | |
| 3 | Claude | Desative (ou rode numa janela sem) a extensao do Claude Code e clique num comando | Aviso de erro "Extensao do Claude Code nao encontrada" com o botao **Instalar Claude Code** | Print do aviso | |
| 4 | Codex | `delphiDev.agent` = `codex`. Clique em **Auditar projeto** | O painel do Codex abre e aparece o aviso "Comando copiado: `$delphi-cmd-audit` - cole no Codex e tecle Enter." | Print + Output "Extension Host" | |
| 5 | Codex | Cole (`Ctrl+V`) na caixa do Codex e tecle Enter | O Codex roda o roteiro do `/audit` (ele deve reconhecer `$delphi-cmd-audit` como skill) | Resposta do Codex (ou que ele nao achou a skill) | |
| 6 | Codex | **Teste informativo.** Num terminal: `code --open-url "vscode://openai.chatgpt/?prompt=%24delphi-cmd-audit"` | **Anotar:** a caixa do Codex fica preenchida? O comando e enviado sozinho? Isso decide se o padrao `delphiDev.codexPromptUri` pode ser ligado | Anotacao: "preenche: sim/nao; envia sozinho: sim/nao" | |
| 7 | Codex | Teste numa maquina/conta sem o plugin no Codex (ou renomeie temporariamente `~/.agents/skills/delphi-cmd-audit`) e clique num comando | Aviso "O plugin delphi-dev ainda nao esta instalado para Codex. Rode: `npx delphi-dev --target codex`" com o botao **Copiar comando** | Print do aviso | |
| 8 | OpenCode | `delphiDev.agent` = `opencode`, **sem nenhum OpenCode rodando**. Clique em **Auditar projeto** | Abre o terminal "OpenCode - Delphi Dev", roda `opencode --port 4096`, a TUI sobe e o comando `/delphi-audit` entra e executa sozinho (pode levar uns segundos) | Print do terminal + Output "Extension Host" | |
| 9 | OpenCode | Com esse terminal ainda aberto, clique em outro comando (ex.: **Revisar codigo**) | Reaproveita o terminal; **nao** digita `opencode --port` outra vez; o comando executa na TUI | O que apareceu no terminal | |
| 10 | OpenCode | Feche tudo. Em um terminal seu rode `opencode --port 4096` (a TUI abre), volte ao VS Code e clique num comando | Usa o servidor que voce abriu: nenhum terminal extra e criado; o comando executa na TUI | Print | |
| 11 | OpenCode | Com a TUI aberta (teste 8 ou 10), confira o que ela fez com `/delphi-audit` | Executou como **comando** (nao ficou como texto cru na caixa) | Print da TUI | |
| 12 | Todos | Deixe dois agentes instalados e `delphiDev.agent` = `auto`. Clique num comando | Pergunta **uma vez** "Qual agente deve receber os comandos do Delphi Dev?"; nos cliques seguintes ja usa o escolhido sem perguntar | Print da pergunta e se perguntou de novo | |
| 13 | Todos | Clique no item **Delphi Dev** da barra de baixo | QuickPick com Claude Code / Codex / OpenCode; depois de escolher, o nome na barra de baixo muda | Print | |
| 14 | Todos | Troque o idioma do VS Code (`Ctrl+Shift+P` > "Configure Display Language") entre portugues e ingles e reinicie | Os rotulos da lista lateral acompanham o idioma (ex.: "Auditar projeto" / "Audit project") | Print da lista | |
| 15 | Claude | Abra uma pasta Delphi **sem** `.claudeignore` | A oferta de criar `.claudeignore` aparece **so** se a extensao do Claude Code estiver instalada | Se apareceu sem o Claude ou deixou de aparecer com ele | |
| 16 | OpenCode | **Ressalva conhecida.** Suba `opencode serve` (ou `opencode web`) na porta 4096 **sem** abrir a TUI e clique num comando | Pode aparecer como enviado sem que nada aconteca, porque a API responde 200 mesmo sem TUI. Se acontecer, pare esse servidor (ou mude `delphiDev.opencodePort`) e use o terminal da extensao | Confirmar se reproduziu | |

## Antes de dar o teste por encerrado

- Claude Code **sem regressao**: os testes 1, 2, 3 e 15 sao os mais importantes. Se algum falhar, pare e me avise
  antes de qualquer release.
- Os testes 6 e 11 decidem o padrao do Codex e a confiabilidade do OpenCode.

## Pontos que dependem de confirmacao

- Segredo `VSCE_TOKEN` **nao existe** neste repositorio: precisa ser criado antes de qualquer publicacao
  (Settings > Secrets and variables > Actions). O workflow so roda em `master` e so quando a versao do
  `packages/vscode/package.json` muda (ou manualmente, pelo `workflow_dispatch`).
- O `package.json` da extensao estava em **2.0.0** (o CHANGELOG antigo so registrava a 0.1.0) e agora esta em
  **3.0.0**: confira qual versao o Marketplace serve. A 3.0.0 so sai quando o mantenedor decidir.
- A extensao deixou de exigir a extensao do Claude Code (`extensionDependencies`). Usuarios so de Codex/OpenCode
  conseguem instalar; o Claude e oferecido quando e o agente escolhido.
- Aviso no repositorio antigo `delphi-dev-vscode` (aponta para o novo local em `packages/vscode`): ainda por fazer.
