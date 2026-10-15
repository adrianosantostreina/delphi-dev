# ACBr em Linux64 console: o define `NOGUI` é obrigatório

**Sintoma.** Projeto console (`{$APPTYPE CONSOLE}`, Horse/daemon) que usa ACBr compila
em Windows e falha em **Linux64** com erros de unit de interface gráfica que não existem
naquela plataforma:

```
ACBrBase.pas(64):   error F2613: Unit 'FMX.Dialogs' not found.
ACBrSocket.pas(419): error F2613: Unit 'Controls' not found.
```

**Causa 1 — o ACBr assume que todo POSIX é FireMonkey.** Em `Fontes/ACBrComum/ACBr.inc`:

```pascal
{$IFDEF DELPHILANGUAGE}
  {$IFDEF POSIX}
    {$IFDEF LINUX} {$DEFINE USE_UTF8} {$UNDEF HAS_BLUETOOTH} {$ENDIF}
    {$DEFINE FMX}          // <-- vale para iOS, macOS, Android... e Linux64
```

Verdade para iOS/macOS/Android; **falso para Linux64**, que no Delphi é alvo de
console/servidor e **não tem FMX na RTL** (FireMonkey para Linux só via FmxLinux, produto
pago de terceiro). Com `FMX` definido, o `ACBrBase` cai neste ramo:

```pascal
{$IFNDEF NOGUI}
  {$IF DEFINED(VisualCLX)}                ,QDialogs
  {$ELSEIF DEFINED(FMX)}                  ,FMX.Dialogs, System.UITypes   // <-- aqui
  {$ELSEIF DEFINED(DELPHICOMPILER16_UP)}  ,Vcl.Dialogs, System.UITypes
  {$ELSE}                                 ,Dialogs
  {$IFEND}
{$ENDIF};
```

Note que o ramo VCL **também** não serviria: `Vcl.Dialogs` não existe no Linux. Não há
caminho válido — a saída é não entrar no bloco.

**Causa 2 — cursor de tela em app sem tela.** `ACBrSocket` puxa `Controls, Forms` para
trocar o cursor durante requisições HTTP:

```pascal
{$IFDEF VCL}  {$DEFINE UPDATE_SCREEN_CURSOR} {$ENDIF}
{$IFDEF LCL}  {$DEFINE UPDATE_SCREEN_CURSOR} {$ENDIF}
{$IFDEF NOGUI} {$UNDEF UPDATE_SCREEN_CURSOR} {$ENDIF}
```

**Correção — definir `NOGUI` no projeto.** É a saída que o próprio ACBr prevê
(`ACBr.inc` liga `NOGUI` sozinho só para `FRAMEWORK` e `LAMW`; num Horse/daemon Delphi
nenhum dos dois se aplica, então tem de vir do `.dproj`):

```xml
<PropertyGroup Condition="'$(Base)'!=''">
    <DCC_Define>NOGUI;$(DCC_Define)</DCC_Define>
</PropertyGroup>
```

**Ponha no escopo `Base`, não só no `Base_Linux64`.** Um app console é console em toda
plataforma: o mesmo `ACBrSocket` quebra em Win64 (`Unit 'Controls' not found`) quando os
packages VCL não estão no projeto. Definir só para Linux dá paridade dev/prod falsa — a
build Windows passa por um caminho de código que a de produção nunca executa.

**Efeito colateral a conferir antes:** `NOGUI` também faz `{$UnDef HAS_PNG}`. Se o
serviço gera DANFE/relatório com logo PNG, avalie. Em APIs que só emitem XML — ou onde a
geração de PDF já é tolerante à ausência de FastReport/ForteReports — não muda nada.

## Ordem em que os erros aparecem

Os três problemas típicos de portar um Horse+ACBr para Linux64 se **mascaram em série** —
cada um só aparece depois de resolver o anterior, e é fácil concluir que "o erro mudou de
lugar sozinho":

1. `MSB6003` (command line too long) — nem chega a compilar. Ver
   [msb6003-command-line-too-long](msb6003-command-line-too-long.md).
2. `E2003: Undeclared identifier 'TFDGUIxWaitCursor'` — FireDAC/ADRConnection. Ver
   [firedac-console-firebird](firedac-console-firebird.md).
3. `F2613: Unit 'FMX.Dialogs' not found` — este arquivo.

Validado ao vivo em 2026-09-09, Delphi 13 (Studio 37.0), SDK `ubuntu22.04.sdk`,
ACBr_Truk2, API Horse console de NFC-e: `BUILD OK` em Linux64 **e** Win64 depois de
`DCC_ForceExecute` + `NOGUI`, ambos no escopo `Base`.
