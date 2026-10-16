# Testes v4.0 - Codex e OpenCode

## Validacao automatica com os CLIs reais

Executada por `kb/scripts/validate-targets.mjs` (nao roda no CI: precisa dos CLIs na maquina). Tudo acontece em
pastas temporarias fora do perfil do usuario (`HOME`, `USERPROFILE`, `CODEX_HOME`, `XDG_*_HOME` e `DELPHI_DEV_DATA`
apontam para dentro da pasta de trabalho; variaveis com cara de credencial sao removidas do ambiente dos processos).

- Data: 2026-10-16, Windows 11 (10.0.26300), Node v24.18.0
- OpenCode: `1.19.1` (npm, `opencode.cmd`)
- Codex: `codex-cli 0.162.0-alpha.17.2` (`codex.exe` da extensao do VS Code `openai.chatgpt-26.1007.21434-win32-x64`)
- Autenticacao: nenhuma. Nada foi logado; nenhum modelo do Codex foi chamado.

Comando:

```bash
node kb/scripts/validate-targets.mjs   --codex "$HOME/.vscode/extensions/openai.chatgpt-26.1007.21434-win32-x64/bin/windows-x86_64/codex.exe"   --live-opencode --work D:/Temp/dd-validate
```

Sem `--live-opencode` tudo e offline. Com a flag, o script envia UM prompt curto ("responda apenas: ok") ao modelo
gratuito anonimo do OpenCode, so para provar que o OpenCode real carrega o plugin gerado e dispara seus hooks (nenhum log
nem comando `opencode debug` informa o carregamento de plugins). O plugin usado nesse passo aponta para um checkout falso
(so um marcador), nao para o `hook-inject` real; o `hook-inject` real e exercitado, sem rede, no passo anterior.

### Saida da ultima execucao

```text
delphi-dev validate-targets  2026-10-16T16:37:46.080Z  node v24.18.0  win32
checkout: D:\2.2 GitHub Adriano Santos\delphi-dev
INFO  opencode  cli version                                                                                        1.19.1
PASS  opencode  isolation: config/data folders are inside the work folder                                          home D:\Temp\dd-validate\opencode\home data D:\Temp\dd-validate\opencode\xdg\data\opencode bin D:\Temp\dd-validate\opencode\xdg\cache\opencode\bin log D:\Temp\d
PASS  opencode  kb-cli install exits 0 with 0 warnings                                                             32 gravado(s), 0 removido(s), 0 sem mudanca, 0 ignorado(s), 0 aviso(s)
PASS  opencode  kb-cli doctor exits 0                                                                              ok   opencode instalado: 15 pasta(s) de skill, 16 arquivo(s) | ok   opencode arquivos presentes: ok | ok   opencode sem alteracao manual: ok | ok   opencode mcp configurado: D:\Temp\dd-validate\opencode\xdg\config\openco
PASS  opencode  second install changes nothing (idempotent)                                                        0 gravado(s), 0 removido(s), 32 sem mudanca, 0 ignorado(s), 0 aviso(s)
PASS  opencode  15 knowledge skills discovered from ~/.agents/skills                                               15 found
PASS  opencode  delphi-claudeignore is NOT installed                                                               
PASS  opencode  no skill came from outside the work folder (isolation)                                             ok
PASS  opencode  opencode.json accepted (debug config resolves to valid JSON)                                       ok
PASS  opencode  11 /delphi-* commands resolved                                                                     delphi-about, delphi-audit, delphi-contribute-kb, delphi-dashboard, delphi-e2e, delphi-new-project, delphi-review, delphi-spec, delphi-tdd, delphi-update, delphi-write
PASS  opencode  4 delphi-* agents resolved                                                                         delphi-auditor, delphi-spec-writer, delphi-tester, delphi-writer
PASS  opencode  mcp delphi-dev-kb declared (local, enabled)                                                        {"type":"local","command":["node","D:/2.2 GitHub Adriano Santos/delphi-dev/runtime/kb-mcp.mjs"],"enabled":true}
PASS  opencode  user mcp entry preserved by the merge                                                              mcp.user-own
PASS  opencode  plugin delphi-dev.js registered from the config folder                                             file:///D:/Temp/dd-validate/opencode/xdg/config/opencode/plugins/delphi-dev.js
PASS  opencode  opencode agent list shows the delphi agents                                                        delphi-auditor, delphi-spec-writer, delphi-tester, delphi-writer
PASS  opencode  mcp delphi-dev-kb connected                                                                        ┌ MCP Servers │ ● ○ user-own disabled │ node -e │ ● ✓ delphi-dev-kb connected │ node D:/2.2 GitHub Adriano Santos/delphi-dev/runtime/kb-mcp.
PASS  opencode  plugin imports and exposes chat.message, system.transform, tool.execute.after                      chat.message, experimental.chat.system.transform, tool.execute.after
PASS  opencode  plugin injects knowledge into the system prompt (real hook-inject)                                 system entries: 2, injected chars: 1499
PASS  opencode  live: generated plugin has a ROOT line to point at the stub                                        
PASS  opencode  live: real opencode loaded the plugin and fired its prompt hooks                                   hook payload: {"prompt":"\"responda apenas: ok\"","cwd":"D:\\Temp\\dd-validate\\opencode\\proj"}
PASS  opencode  live: the hook payload carries the project folder as cwd                                           D:\Temp\dd-validate\opencode\proj
PASS  opencode  kb-cli uninstall exits 0 with 0 warnings                                                           0 gravado(s), 32 removido(s), 0 sem mudanca, 0 ignorado(s), 0 aviso(s)
PASS  opencode  uninstall leaves no delphi files                                                                   clean
PASS  opencode  uninstall restored the user config (own entries kept, delphi-dev-kb gone)                          {"user-own":{"type":"local","command":["node","-e",""],"enabled":false}}
PASS  opencode  uninstall removed the manifest                                                                     
PASS  opencode  doctor fails after uninstall (nothing registered)                                                  FAIL opencode instalado: nada registrado no manifesto
PASS  opencode  opencode no longer lists delphi-dev-kb after uninstall                                             ┌ MCP Servers │ ● ○ user-own disabled │ node -e │ └ 1 server(s)
INFO  codex     cli version                                                                                        codex-cli 0.162.0-alpha.17.2
PASS  codex     kb-cli install (project scope) exits 0 with 0 warnings                                             30 gravado(s), 0 removido(s), 0 sem mudanca, 0 ignorado(s), 0 aviso(s)
PASS  codex     kb-cli install (user scope) exits 0 with 0 warnings                                                32 gravado(s), 0 removido(s), 0 sem mudanca, 0 ignorado(s), 0 aviso(s)
PASS  codex     kb-cli doctor exits 0                                                                              ok   codex instalado: 52 pasta(s) de skill, 8 arquivo(s) | ok   codex arquivos presentes: ok | ok   codex sem alteracao manual: ok | ok   codex mcp configurado: D:\Temp\dd-validate\codex\codex-home\config.toml
PASS  codex     second install changes nothing (idempotent)                                                        0 gravado(s), 0 removido(s), 32 sem mudanca, 0 ignorado(s), 0 aviso(s)
PASS  codex     app-server --strict-config starts with the generated config.toml                                   CODEX_HOME=D:\Temp\dd-validate\codex\codex-home
PASS  codex     isolation: Codex runs with the temporary CODEX_HOME                                                D:\Temp\dd-validate\codex\codex-home
PASS  codex     15 knowledge skills discovered (project .agents/skills)                                            15 found
PASS  codex     11 delphi-cmd-* skills discovered                                                                  11 found
PASS  codex     delphi-claudeignore is NOT installed                                                               
PASS  codex     skills/list reports no load errors                                                                 []
PASS  codex     hooks.json accepted: postToolUse + userPromptSubmit registered                                     postToolUse, userPromptSubmit
PASS  codex     hooks report no warnings/errors                                                                    
INFO  codex     hooks trust status                                                                                 untrusted (hooks only fire after /hooks trust; manual)
PASS  codex     mcp delphi-dev-kb connects (initialize + tools/list)                                               server delphi-dev-kb 3.2.0; tools: kb_prefs, kb_health, kb_search, kb_update, kb_get
PASS  codex     mcp exposes kb_search                                                                              
PASS  codex     agents/*.toml loaded with no "malformed agent role" warning                                        4 files in D:\Temp\dd-validate\codex\codex-home\agents
PASS  codex     4 agent TOML files installed                                                                       delphi-auditor.toml, delphi-spec-writer.toml, delphi-tester.toml, delphi-writer.toml
PASS  codex     control: Codex does warn about a malformed agent TOML (so the clean result above means something)  warning observed
PASS  codex     control: --strict-config rejects an unknown key (so the clean start above means something)         {"error":{"message":"process exited"}}Error: D:\Temp\dd-validate\codex-control\codex-home\config.toml:3:1: unknown configuration field `mcp_servers.x.bogus_key`
PASS  codex     knowledge skills are in the model-visible list                                                     15/15
PASS  codex     delphi-claudeignore is NOT in the model-visible list                                               
INFO  codex     delphi-cmd-* in the model-visible list                                                             hidden (allow_implicit_invocation=false); explicit $delphi-cmd-<name> still works
PASS  codex     codex mcp get delphi-dev-kb is stdio with kb-mcp.mjs                                               delphi-dev-kb enabled: true transport: stdio command: node args: D:/2.2 GitHub Adriano Santos/delphi-dev/runtime/kb-mcp.mjs cwd: - env: - remove: codex mcp remo
INFO  codex     mcp_servers.<name>.cwd accepted by --strict-config and applied to the server process               yes (server saw cwd=D:\Temp\dd-validate\codex-cwd\target)
INFO  codex     hooks fire                                                                                         manual: Codex asks to trust the hooks (/hooks) and the model must edit a file (docs/testes-v4.0-codex-opencode.md)
INFO  codex     project-scope agents (.codex/agents)                                                               only load once the project is trusted; not exercised here
PASS  codex     kb-cli uninstall exits 0 with 0 warnings                                                           0 gravado(s), 62 removido(s), 0 sem mudanca, 0 ignorado(s), 0 aviso(s)
PASS  codex     uninstall leaves no delphi files                                                                   clean
PASS  codex     uninstall restored config.toml (user content kept, managed block gone)                             # user config model_reasoning_effort = "low"
PASS  codex     uninstall removed hooks.json entries                                                               
PASS  codex     uninstall removed the manifest                                                                     
PASS  codex     doctor fails after uninstall (nothing registered)                                                  FAIL codex instalado: nada registrado no manifesto
PASS  codex     Codex no longer lists delphi-dev-kb after uninstall                                                []

54 PASS, 0 FAIL, 0 SKIP, 7 INFO
pasta de trabalho: D:\Temp\dd-validate
```

### O que a execucao prova e o que nao prova

- Codex: o `config.toml` gerado e aceito por `codex app-server --strict-config` (campo desconhecido vira erro; o controle
  negativo no proprio script confirma isso). `skills/list`, `hooks/list` e `mcpServerStatus/list` sao respostas do proprio
  Codex: 15 skills de conhecimento e 11 `delphi-cmd-*` descobertas, os dois hooks registrados, MCP `delphi-dev-kb` inicializa
  e lista as ferramentas. Os 4 agentes `.toml` carregam sem aviso (o controle negativo prova que o Codex avisa quando um
  agente e malformado). Nao ha comando que liste os agentes carregados; a prova dos agentes e por ausencia de aviso.
- OpenCode: `debug config`, `debug skill`, `agent list` e `mcp list` (conectado) respondem pelo proprio OpenCode.
  O plugin e carregado pelo OpenCode real (passo `--live-opencode`) e o payload do hook chega com o `cwd` do projeto.
- Ciclo `install` -> `doctor` -> reinstalacao idempotente -> `uninstall` -> `doctor` (falha esperada) limpo nos dois
  alvos, preservando o conteudo que o usuario ja tinha em `config.toml` e `opencode.json`.

### Limitacoes e o que so um humano testa

- Os hooks do Codex so disparam depois que o usuario confia neles (`/hooks`; o `hooks/list` mostra `untrusted`) e que o
  modelo edita um arquivo. Nao verificavel offline.
- O hook `tool.execute.after` (corrige encoding apos edicao) do plugin do OpenCode nao foi disparado por uma edicao real
  (depende de o modelo chamar uma ferramenta de edicao).
- Agentes de escopo de projeto do Codex (`.codex/agents`) so carregam com o projeto confiavel; nao exercitado.
- Isolamento no Windows: o `codex.exe` resolve a raiz de skills do usuario pelo perfil do SO (ignora `USERPROFILE`/`HOME`),
  entao as skills do escopo de usuario nao sao redirecionaveis; por isso a descoberta de skills do Codex e validada no
  escopo de projeto (`<projeto>/.agents/skills`). O OpenCode, por sua vez, sobe a arvore de pastas a partir do projeto
  procurando `.claude/skills` e `.agents/skills`: a pasta de trabalho precisa ficar fora do perfil (o script recusa
  `--work` dentro do perfil). Tambem e preciso limpar `PWD` herdado do shell: o OpenCode usa `PWD` como diretorio do
  projeto (o script define `PWD` para o `cwd` de cada processo).
- `mcp_servers.<nome>.cwd` existe no Codex 0.162 e e aplicado ao processo do servidor MCP (probe do script com um MCP de
  teste). Isso permitiria rodar o `kb-mcp.mjs` a partir do checkout confiavel em vez da pasta do projeto. O OpenCode nao
  foi investigado quanto a isso.

## O que foi verificado automaticamente e o que NAO foi

Resumo honesto, para saber o que ainda depende de voce:

| Ponto | Verificado sozinho? | Como |
|---|---|---|
| Instalar, reinstalar (idempotente), desinstalar e `doctor`, para Codex e OpenCode | Sim | `validate-targets.mjs` com os CLIs reais (secao acima) |
| Config do Codex (`config.toml`, `hooks.json`, 4 agentes `.toml`) aceita pelo Codex real | Sim | `codex app-server --strict-config`, `skills/list`, `hooks/list` |
| Servidor MCP `delphi-dev-kb` sobe e lista `kb_search` nos dois | Sim | `mcpServerStatus/list` (Codex), `opencode mcp list` (OpenCode) |
| 15 skills de conhecimento e 11 comandos descobertos nos dois | Sim | `skills/list`, `opencode debug skill` e `agent list` |
| OpenCode carrega o plugin gerado e dispara o hook de prompt, com a pasta do projeto | Sim | passo `--live-opencode` (plugin de teste, nao o `hook-inject` real) |
| O que o `hook-inject` real devolve (injecao da base no prompt) | Sim, sem o agente | chamado direto pelo script |
| O plugin do Claude Code continua intacto (lista de comandos, agentes, skills, hooks) | Sim | `claude-surface.mjs --check --validate` + suite do `kb` |
| **Hooks do Codex disparando** (BOM/encoding apos editar arquivo, injecao no prompt) | **NAO** | exige voce confiar neles em `/hooks` e o modelo editar um arquivo |
| **`tool.execute.after` do OpenCode** (BOM apos o modelo usar a ferramenta de edicao) | **NAO** | depende do modelo chamar a ferramenta de edicao |
| **Comandos `$delphi-cmd-<nome>` no Codex** (terminal e VS Code) realmente executando o roteiro | **NAO** | so a descoberta foi provada; chamar de verdade exige o modelo |
| **Comandos `/delphi-<nome>` no OpenCode** (terminal e VS Code) realmente executando o roteiro | **NAO** | idem |
| Subagentes (`@delphi-writer` etc.) respondendo de verdade | **NAO** | no Codex, so "carregou sem aviso"; no OpenCode, so "esta na lista" |
| Extensoes do VS Code (Codex e OpenCode) | **NAO** | nenhum teste automatico abre o VS Code |
| Claude Code instalado de verdade (`/plugin`, `/delphi-dev:about`, `/audit`) | **NAO** | so a superficie do plugin e comparada; a sessao real e manual |

## Matriz manual (para voce executar)

Voce nao precisa entender de teste. Cada item diz o que **Fazer** e o que **Deve aparecer**. Marque `[x]` quando passar, `[F]` quando falhar, e anote a data.
**Se falhar**, me mande: o numero do item, o texto que apareceu na tela (print tambem serve) e o que voce esperava.

Terminal e VS Code devem se comportar igual. Faca primeiro tudo no terminal; depois repita so os itens
marcados "(VS Code)".

### Preparacao (uma vez)

1. Abra o PowerShell e instale a partir da sua copia do repositorio (o `npx delphi-dev` publicado ainda e a
   versao antiga; a publicacao so acontece no fim):

   ```powershell
   cd "D:\2.2 GitHub Adriano Santos\delphi-dev"
   node runtime\kb-cli.mjs install --target all
   node runtime\kb-cli.mjs doctor --target all
   ```

   Deve aparecer: no `install`, a linha final com `0 aviso(s)`; no `doctor`, tudo com `ok` (nenhuma linha `FAIL`).
   Se falhar: me mande a saida inteira dos dois comandos.

2. Crie uma pasta de teste vazia, por exemplo `D:\Temp\teste-delphi`. Os testes abaixo usam essa pasta.
3. Feche e abra de novo o Codex e o OpenCode (a sessao so le a instalacao ao iniciar).

Isto grava de verdade na sua maquina (`~/.agents`, `~/.codex`, `~/.config/opencode`). Para desfazer no final:
`node runtime\kb-cli.mjs uninstall --target all` (so remove o que o delphi-dev instalou).

### Bloco A - Codex, terminal

Abra o PowerShell em `D:\Temp\teste-delphi` e rode `codex`.

| # | Faca | Deve aparecer | Resultado |
|---|---|---|---|
| A1 | Digite `$delphi-` (so isso, sem Enter) | uma lista com `delphi-standards`, `delphi-write`... (as skills de conhecimento). Os `delphi-cmd-*` podem **nao** aparecer na lista; e esperado (ficam escondidos de proposito) | |
| A2 | Digite `$delphi-cmd-about` e Enter | o Codex responde com informacoes do plugin delphi-dev (versao, comandos). Se pedir confirmacao de algo, aceite | |
| A3 | Digite `/hooks` | uma tela listando hooks do delphi-dev (um de "prompt" e um de "apos editar"). **Confie neles** (siga a tela). Depois feche e abra o `codex` de novo | |
| A4 | Peca: `Crie o arquivo Teste.pas com uma unit vazia chamada Teste e um comentario com a palavra Opção.` Depois, **em outro PowerShell**, rode o comando de BOM (abaixo) | os 3 primeiros bytes sao `EF BB BF` (isso e o BOM) | |
| A5 | Peca: `Crie o arquivo Teste.dfm com um form Delphi simples cujo Caption seja 'Serviço'.` Depois rode o comando de BOM no `Teste.dfm` e o comando do `#231` (abaixo) | os 3 primeiros bytes **nao** sao `EF BB BF`, e o `Select-String` acha `#231` (o "ç" virou `#231`) | |
| A6 | Pergunte: `Dei o erro E2356 em uma class var. Antes de responder, me diga se voce recebeu algum trecho marcado [DELPHI-DEV KNOWLEDGE] nesta conversa e copie-o.` | ele mostra um trecho `[DELPHI-DEV KNOWLEDGE]` sobre `class var`/E2356. (Teste indireto: o modelo pode se recusar a copiar; se recusar, me avise, ainda nao conta como falha do plugin) | |
| A7 | Peca: `Use a ferramenta kb_search para procurar "E2356 class var" e me mostre os resultados.` | resultados com caminhos tipo `[canonical/...]` ou `[core/...]` | |
| A8 | Peca: `Use o subagente delphi-writer para criar uma classe simples TCliente.` | ele delega (ou diz que usaria) o agente `delphi-writer` e escreve codigo Delphi com prefixos `F`/`A`/`L` | |

Comandos de conferencia (rode em **outro** PowerShell, nao dentro do Codex):

```powershell
Format-Hex -Path D:\Temp\teste-delphi\Teste.pas -Count 3
Format-Hex -Path D:\Temp\teste-delphi\Teste.dfm -Count 3
Select-String -Path D:\Temp\teste-delphi\Teste.dfm -Pattern '#231'
```

Se A4 ou A5 falharem: confira antes se fez o A3 (sem confiar nos hooks o BOM **nao** e aplicado; isso nao e
bug do plugin, e regra do Codex). Se mesmo apos confiar falhar, me mande o resultado do `Format-Hex` e o texto
de `/hooks`.

### Bloco B - Codex, extensao do VS Code (VS Code)

Abra `D:\Temp\teste-delphi` no VS Code e abra o painel do Codex.

| # | Faca | Deve aparecer | Resultado |
|---|---|---|---|
| B1 | Repita A1 e A2 no painel do Codex | igual ao terminal | |
| B2 | Procure como confiar nos hooks no painel (o `/hooks` pode nao existir ai). Se nao achar, use o terminal uma vez (A3) e veja se a confianca vale no painel | anote **como** confiou | |
| B3 | Repita A4 e A5 | igual ao terminal | |

Se o painel nao tiver `/hooks` e a confianca do terminal nao valer no VS Code, me avise: e uma pergunta em
aberto que preciso fechar.

### Bloco C - OpenCode, terminal

No PowerShell, em `D:\Temp\teste-delphi`, rode `opencode`. (Apague o `Teste.pas`/`Teste.dfm` do bloco A antes,
para o teste ser valido.)

| # | Faca | Deve aparecer | Resultado |
|---|---|---|---|
| C1 | Digite `/` (so isso) | a lista de comandos inclui `/delphi-audit`, `/delphi-review`, `/delphi-write`, `/delphi-about`... (11 comandos `delphi-*`) | |
| C2 | Digite `/delphi-about` e Enter | o OpenCode responde com informacoes do plugin delphi-dev | |
| C3 | Peca: `Crie o arquivo Teste.pas com uma unit vazia chamada Teste e um comentario com a palavra Opção.` Depois confira o BOM como no bloco A | `EF BB BF` nos 3 primeiros bytes (o plugin do OpenCode aplicou o BOM apos a ferramenta de edicao) | |
| C4 | Peca: `Crie o arquivo Teste.dfm com um form Delphi simples cujo Caption seja 'Serviço'.` e confira como no A5 | sem BOM e com `#231` | |
| C5 | Pergunte como no A6 | trecho `[DELPHI-DEV KNOWLEDGE]` sobre E2356 | |
| C6 | Peca: `Use a ferramenta kb_search para procurar "E2356 class var".` | resultados da base | |
| C7 | Digite `@delphi-writer crie uma classe simples TCliente` | o subagente responde seguindo os padroes Delphi (prefixos `F`/`A`/`L`) | |
| C8 | Digite `/delphi-audit` (a pasta de teste precisa ter ao menos um `.pas`) | o OpenCode segue o roteiro de auditoria (pergunta o projeto / comeca o laudo) | |

### Bloco D - OpenCode, extensao do VS Code (VS Code)

Abra `D:\Temp\teste-delphi` no VS Code com a extensao do OpenCode.

| # | Faca | Deve aparecer | Resultado |
|---|---|---|---|
| D1 | Repita C1 e C2 | igual ao terminal | |
| D2 | Repita C3 e C4 | igual ao terminal | |

### Bloco E - Claude Code continua intacto

**Esta e a mais importante: o plugin nao pode ter quebrado no Claude Code.**

Antes (opcional, 1 minuto, nao precisa de Claude): no PowerShell, na pasta do repositorio,

```powershell
node kb\scripts\claude-surface.mjs --check --validate
```

Deve terminar sem erro. Isso compara a lista de comandos/agentes/skills/hooks com a referencia salva.

Agora, de verdade, no Claude Code (terminal ou VS Code):

| # | Faca | Deve aparecer | Resultado |
|---|---|---|---|
| E1 | Digite `/plugin` | `delphi-dev` na lista de instalados e habilitado | |
| E2 | Digite `/delphi-dev:about` | a tela "Sobre" do plugin, com versao e status da base | |
| E3 | Digite `/mcp` | `plugin:delphi-dev:delphi-dev-kb` conectado | |
| E4 | Numa pasta com projeto Delphi (ou com um `.pas`), digite `/audit` | ele comeca o laudo (pode interromper depois das primeiras perguntas) | |
| E5 | Peca: `Crie o arquivo Teste.pas com uma unit vazia e um comentario com a palavra Opção.` e confira o BOM como no bloco A | `EF BB BF` | |
| E6 | Pergunte: `erro E2356 em class var` e aperte Ctrl+O | aparece o trecho `[DELPHI-DEV KNOWLEDGE]` | |

Se qualquer item do bloco E falhar, **pare tudo e me avise primeiro**: e o que mais pesa.

### Bloco F - Casos de borda

| # | Faca | Deve aparecer | Resultado |
|---|---|---|---|
| F1 | No PowerShell, na pasta do repositorio: `node runtime\kb-cli.mjs install --target all` **de novo** | `0 gravado(s)` (nada mudou na segunda vez) | |
| F2 | Sem Node no PATH (comandos abaixo, numa janela nova do PowerShell). Nessa mesma janela rode `codex`, mande um prompt qualquer; depois repita com `opencode` | nenhuma mensagem de erro de hook a cada prompt (o agente funciona normal, so sem a injecao da base) | |
| F3 | `node runtime\kb-cli.mjs uninstall --target all` e depois `node runtime\kb-cli.mjs doctor --target all` | o `uninstall` termina com `0 aviso(s)`; o `doctor` agora **falha** dizendo "nada registrado" (isso e o esperado); seus arquivos de configuracao pessoais continuam la | |

Para o F2, tirar o Node do PATH so nessa janela (nao mexe no resto do Windows):

```powershell
$env:Path = ($env:Path -split ';' | Where-Object { $_ -notmatch 'nodejs' }) -join ';'
where.exe node
```

O `where.exe node` deve dizer que nao encontrou. Se ainda achar, o Node esta em outra pasta: me avise.

Dica para o F3: antes de desinstalar, abra `~/.codex/config.toml` e `~/.config/opencode/opencode.json` e
veja que o que voce tinha continua la depois.

### Como me devolver o resultado

Cole a tabela preenchida (ou so os itens que falharam) com: o numero do item, o que voce fez, o que apareceu
na tela e o que esperava. Para itens do Codex, inclua a saida de `codex --version`; para o OpenCode,
`opencode --version`.

## Pontos que dependem de confirmacao

- Disparo real dos hooks no Codex (exige `/hooks`) e no plugin do OpenCode (API em reescrita V2): itens A4, A5, C3, C4.
- Se o hook de pos-edicao do Codex dispara quando o modelo edita por `apply_patch`: itens A4 e A5 respondem.
- `agents/openai.yaml` (`allow_implicit_invocation: false`): a descoberta dos `$delphi-cmd-*` foi provada, a
  execucao real nao: item A2.
- `commandWindows` do Codex: forma do comando silencioso sem Node: item F2.
- Confianca dos hooks na extensao do VS Code do Codex: item B2.
- Antigravity fica fora de escopo por enquanto (issue #9).
