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
