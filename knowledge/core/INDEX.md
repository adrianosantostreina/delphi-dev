# Delphi Knowledge Base — Core

Base de conhecimento central do plugin delphi-dev. Reutilizável em todos os projetos Delphi (VCL, FMX, RTL).

> Marcadores: sem marcador = Delphi geral | **[Mobile]** = Android/iOS. Conhecimento específico de FireMonkey fica em [`../fmx/INDEX.md`](../fmx/INDEX.md).

## Fundamentos
- [encoding-utf8-bom.md](encoding-utf8-bom.md) — UTF-8 com BOM em todo arquivo Delphi; diagnóstico de mojibake
- [uses-uma-unit-por-linha.md](uses-uma-unit-por-linha.md) — Uma unit por linha, grupos por namespace
- [dpr-uses-project-manager.md](dpr-uses-project-manager.md) — Units no Project Manager via uses do .dpr
- [class-var-vaza-para-campos-de-instancia.md](class-var-vaza-para-campos-de-instancia.md) — `class var` abre seção que linha em branco não fecha → `E2356` em propriedade de instância

## Form Designer
- [componentes-designer-vs-runtime.md](componentes-designer-vs-runtime.md) — Componentes no designer vs criação em runtime

## Build & Recursos
- [build-via-bat-com-log.md](build-via-bat-com-log.md) — Template .bat com log + catálogo de erros (E2003/E2065)
- [recursos-rcdata.md](recursos-rcdata.md) — Embutir arquivos no executável via TResourceStream
- [msb6003-command-line-too-long.md](msb6003-command-line-too-long.md) — Erro MSB6003 (linha de comando longa demais) no build
- [dproj-projectguid-valido.md](dproj-projectguid-valido.md) — `.dproj` à mão exige `ProjectGuid` hexadecimal válido; placeholder não-hex compila pela CLI mas o IDE recusa abrir
- [dproj-dcc-debuginformation-nao-booleano.md](dproj-dcc-debuginformation-nao-booleano.md) — `DCC_DebugInformation` é enum numérico, não booleano → `F1026 File not found: 'true.dpr'`

## Servidor REST / Horse
- [console-writeln-sem-flush-nao-loga.md](console-writeln-sem-flush-nao-loga.md) — `Writeln` com stdout redirecionado não aparece sem `Flush(Output)`; app console sem log próprio não deixa rastro
- [horse-gbswagger-rotas-jwt.md](horse-gbswagger-rotas-jwt.md) — rotas gbswagger, cadeado JWT, superfície real da API (`Swagger.Info.Title`, `HorseSwagger`, `/swagger/doc/html`) e `GBSwagger.Path.Attributes` obrigatória no `uses`

## Banco de Dados
- [firedac-registro-drivers.md](firedac-registro-drivers.md) — Registro explícito de drivers FireDAC + ConsoleUI.Wait + DEFINE ADRConn
- [firedac-console-firebird.md](firedac-console-firebird.md) — FireDAC em aplicação console com Firebird
- [adrconnection-query-builder.md](adrconnection-query-builder.md) — ADRConnection / query builder

## Locale & Conversão
- [conversao-numerica-locale.md](conversao-numerica-locale.md) — Conversão numérica e impacto do locale (separador decimal)

## Fiscal
- [acbr-nfce-integracao.md](acbr-nfce-integracao.md) — ACBr Trunk2: NFCe, SSL, PIX, DANFE

## Assíncrono
- [delphi-async.md](delphi-async.md) — TTask vs TThread, Synchronize/Queue, IFuture, TCriticalSection

## Mobile (referência geral)
- [delphi-android-ios-versions.md](delphi-android-ios-versions.md) — **[Mobile]** Tabela Delphi × Android API × iOS SDK × exigências das lojas

## Importados via /sync-kb
- [acbr-linux64-console-nogui.md](acbr-linux64-console-nogui.md) — ACBr em Linux64 console: o define `NOGUI` é obrigatório
- [acbr-posprinter-escpos.md](acbr-posprinter-escpos.md) — ACBrPosPrinter / impressão ESC/POS de cupom (térmica)
- [adrconnection-pool-banco-fora.md](adrconnection-pool-banco-fora.md) — ADRConnection pool: banco fora do ar vira Access Violation no controller
- [android-crash-nativo-simbolizar-tombstone.md](android-crash-nativo-simbolizar-tombstone.md) — [Android] Achar a linha Delphi de um crash nativo (SIGSEGV) — inclusive no emulador com tradução ARM
- [android-device-debug-live-adb-scrcpy.md](android-device-debug-live-adb-scrcpy.md) — Depurar num aparelho real ao vivo, via adb — com o usuário mostrando a tela (scrcpy) ou não
- [android-e7688-enabledsysjars-desync.md](android-e7688-enabledsysjars-desync.md) — `[PAClient Error] E7688 NoSuchFileException` no dexing/merge — `EnabledSysJars` desatualizado
- [android-emulador-x86-traducao-arm.md](android-emulador-x86-traducao-arm.md) — [Android] Testar APK Delphi no emulador x86_64 (tradução ARM) — sem aparelho físico
- [android-jdk-keytool-path-obsoleto.md](android-jdk-keytool-path-obsoleto.md) — [Android] IDE não encontra KeyTool.exe/JarSigner.exe nas configurações Java (RAD Studio 13 / 37.0)
- [android-permissoes-runtime.md](android-permissoes-runtime.md) — [Android] Permissão no manifesto não basta — e os tipos do callback não estão onde parecem
- [anonima-nao-captura-rotina-aninhada.md](anonima-nao-captura-rotina-aninhada.md) — `E2555: Cannot capture symbol` — anônima não enxerga procedure aninhada
- [boss-install-apaga-pasta-nao-declarada.md](boss-install-apaga-pasta-nao-declarada.md) — Boss: `boss install` apaga de `modules/` o que nao esta no boss.json
- [brcc32-resinator-delphi13-bug.md](brcc32-resinator-delphi13-bug.md) — RAD Studio 37.0 (Delphi 13): BRCC32 via MSBuild usa motor novo (resinator) por padrão — `CompilerToUse=brcc` documentado está quebrado
- [build-cli-reescreve-dproj-deployproj.md](build-cli-reescreve-dproj-deployproj.md) — Build via CLI pode reescrever `.dproj`/`.deployproj` como efeito colateral
- [comentario-chave-fecha-bloco.md](comentario-chave-fecha-bloco.md) — `}` dentro de comentário `{ … }` fecha o comentário no meio (E2029 / E2038)
- [compilerversion-tabela-condicional.md](compilerversion-tabela-condicional.md) — Tabela CompilerVersion ↔ Delphi + compilação condicional por versão
- [conjunto-literal-limite-255.md](conjunto-literal-limite-255.md) — `x in [a, b, c]` só aceita valores 0..255 — teste que **nunca** casa
- [datasetserialize-merge-float-em-campo-inteiro.md](datasetserialize-merge-float-em-campo-inteiro.md) — DataSet-Serialize: número com casa decimal em campo inteiro vira 0 (e pode zerar a chave)
- [dcc32-unit-nome-pontuado-conflito-search-path.md](dcc32-unit-nome-pontuado-conflito-search-path.md) — Delphi 13 (dcc32 37.0): unit-fonte com nome pontuado no `-U` quebra resolução de OUTRA unit pontuada da RTL (`F2613 Unit not found`)
- [delphi-pastas-especiais-desktop.md](delphi-pastas-especiais-desktop.md) — Pastas especiais: privadas no mobile, COMPARTILHADAS no desktop
- [delphi13-horse-webwebconst-shadow.md](delphi13-horse-webwebconst-shadow.md) — Delphi 13: `F2613 Unit 'Web.HTTPApp' not found` ao migrar projeto Horse
- [firedac-getlastautogenvalue-corrida-firebird.md](firedac-getlastautogenvalue-corrida-firebird.md) — FireDAC + Firebird: `GetLastAutoGenValue('GEN_X')` devolve o ID de OUTRA conexão
- [firedac-linux-libfbclient-symlink.md](firedac-linux-libfbclient-symlink.md) — FireDAC no Linux: erro cita `libfbembed.so`, mas o que falta é o symlink `libfbclient.so`
- [firedac-persistent-fields-colunas-extras.md](firedac-persistent-fields-colunas-extras.md) — FireDAC — Campos persistentes ignoram colunas extras do SELECT
- [firedac-sqlite-renumerar-pk-defer-foreign-keys.md](firedac-sqlite-renumerar-pk-defer-foreign-keys.md) — FireDAC + SQLite: renumerar PK com filhos → `PRAGMA defer_foreign_keys`
- [for-in-array-constructor-e2001.md](for-in-array-constructor-e2001.md) — E2001 `Ordinal type required` em `for X in [a, b, c]` de objetos (downgrade)
- [git-bash-msys-exe-sobrescreve-binario.md](git-bash-msys-exe-sobrescreve-binario.md) — Git Bash/MSYS trata `foo` e `foo.exe` como o mesmo arquivo — e `bin\` costuma ser o `DCC_ExeOutput` do Win32
- [horse-android-unexpected-end-of-stream.md](horse-android-unexpected-end-of-stream.md) — Horse + app Android: "unexpected end of stream" e requisição com status 0 (de vez em quando)
- [horse-conexao-por-requisicao.md](horse-conexao-por-requisicao.md) — Horse + FireDAC: conexão POR REQUISIÇÃO, nunca singleton
- [horse-linux-docker-firebird.md](horse-linux-docker-firebird.md) — Horse no Linux/Docker + FireDAC a Firebird remoto
- [indy-openssl-android.md](indy-openssl-android.md) — OpenSSL do Indy no Android: empacotar as `.so` em `lib/<abi>/`
- [indy-readtimeout-streaming.md](indy-readtimeout-streaming.md) — Indy `ReadTimeout` em cliente de streaming (WebSocket): trocar para infinito após o handshake
- [indy-tls-client-passthrough.md](indy-tls-client-passthrough.md) — Cliente TLS com Indy: `PassThrough := False` (wss/https)
- [json-null-e-iso8601-delphi.md](json-null-e-iso8601-delphi.md) — Ler JSON de API em Delphi: `null` explicito e data ISO-8601 com `Z`
- [mascara-telefone-dinamica-br.md](mascara-telefone-dinamica-br.md) — Máscara de telefone BR: fixa trunca dígito — precisa ser dinâmica
- [msbuild-build-ok-sem-recompilar.md](msbuild-build-ok-sem-recompilar.md) — `msbuild /t:Build` pode reportar sucesso sem recompilar o `.dcu` alterado
- [program-name-colide-var-global-e2029.md](program-name-colide-var-global-e2029.md) — Nome do `program` igual ao de uma variável global → `E2029` sem relação aparente
- [restrequest4d-timeout-real.md](restrequest4d-timeout-real.md) — RESTRequest4D — o `Timeout` real é maior que o pedido
- [router4delphi-animation-hook-sksvg.md](router4delphi-animation-hook-sksvg.md) — Router4D: o hook `Animation` some com ícone `TSkSvg` dentro de `TButton`
- [router4delphi-has-fmx-define.md](router4delphi-has-fmx-define.md) — Router4D (router4delphi) — `HAS_FMX` precisa ser definido no `.dproj` do projeto host
- [router4delphi-unrender-e-render-inicial.md](router4delphi-unrender-e-render-inicial.md) — Router4D: UnRender da tela atual dispara em navegacao para OUTRO container; Render<T> exige rota registrada
- [runtime-error-217-resolver-endereco-map.md](runtime-error-217-resolver-endereco-map.md) — Runtime error 217 no startup — resolver o endereço pelo `.map`
- [string-literal-255-limite.md](string-literal-255-limite.md) — E2056 `String literals may have at most 255 elements` (downgrade p/ Delphi ≤ 11)
- [thread-freeonterminate-referencia.md](thread-freeonterminate-referencia.md) — `FreeOnTerminate := True` + guardar a referência da thread = leitura de memória liberada
- [tinifile-bom-ignora-ini-inteiro.md](tinifile-bom-ignora-ini-inteiro.md) — `.ini` gravado com BOM: `TIniFile` ignora o arquivo inteiro, em silêncio
- [vcl-messagedlg-botoes-em-ingles.md](vcl-messagedlg-botoes-em-ingles.md) — `MessageDlg` da VCL mostra "Yes / No / Confirm" em inglês
- [w1036-recurso-adquirido-dentro-do-try.md](w1036-recurso-adquirido-dentro-do-try.md) — W1036 nos DAOs: recurso adquirido DENTRO do `try` que o libera
- [writeln-sem-console-runtime-error-217.md](writeln-sem-console-runtime-error-217.md) — WriteLn/console em `initialization` quebra apps GUI/Service (Runtime error N, sem log nenhum)
