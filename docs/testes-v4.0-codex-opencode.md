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
