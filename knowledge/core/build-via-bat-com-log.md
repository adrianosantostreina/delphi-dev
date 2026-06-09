# Build via .bat com redirecionamento de log

**[Delphi geral]** — vale para VCL e FMX.

## Problema

Capturar `stdout` de uma compilação Delphi quando o Claude Code roda em Windows é frágil:

- `cmd.exe /c "..."` invocado pelo Bash (MSYS) ou pelo PowerShell **não herda o cwd** das ferramentas — `cd` antes raramente funciona; o caminho precisa ser absoluto entre aspas.
- `2>&1` no shell externo nem sempre captura tudo do `msbuild`/`dcc32`.
- Encoding misto (CP1252 do compilador, UTF-8 do shell) gera caracteres estranhos.
- Buffer do PowerShell pode cortar linhas longas.

## Solução: o `.bat` redireciona toda a saída para um arquivo

O agente apenas **executa o `.bat`** (descartando o stdout dele) e depois **lê o arquivo de log** com a tool `Read`. Isso funciona em qualquer shell, com qualquer encoding, sem race conditions.

### Template padrão para `build.bat`

```bat
@echo off
REM build.bat - Compila o projeto via msbuild
setlocal

set CONFIG=%1
if "%CONFIG%"=="" set CONFIG=Debug

set PLAT=%2
if "%PLAT%"=="" set PLAT=Win32

REM Pasta Studio\<N>.0\ por versao do produto:
REM   21.0 = Delphi 10.4 Sydney   (compiler version 34)
REM   22.0 = Delphi 11 Alexandria (compiler version 35)
REM   23.0 = Delphi 12 Athens     (compiler version 36)
REM   37.0 = Delphi 13            (compiler version 37 — confirmar)
REM Mais de uma instalada? Listar com:
REM   dir "C:\Program Files (x86)\Embarcadero\Studio" /b /ad
REM Se ambiguo, perguntar ao desenvolvedor qual versao usar.
set RSVARS=C:\Program Files (x86)\Embarcadero\Studio\37.0\bin\rsvars.bat
if not exist "%RSVARS%" (
  echo [build.bat] ERRO: rsvars.bat nao encontrado em "%RSVARS%"
  exit /b 2
)

call "%RSVARS%"
if %ERRORLEVEL% NEQ 0 (
  echo [build.bat] ERRO: rsvars.bat falhou
  exit /b 1
)

set LOG=%~dp0build_log.txt

echo === Compilando %~n0  Config=%CONFIG%  Platform=%PLAT% ===
echo Log: %LOG%

msbuild "%~dp0SeuProjeto.dproj" /t:Build /p:Config=%CONFIG% /p:Platform=%PLAT% /nologo /v:minimal /clp:NoSummary > "%LOG%" 2>&1
set ERR=%ERRORLEVEL%

REM Imprime o log no console (visualizacao direta)
type "%LOG%"

if %ERR% EQU 0 (
  echo === BUILD OK  ^| %PLAT%\%CONFIG%\SeuProjeto.exe ===
) else (
  echo === BUILD FALHOU  ^| codigo %ERR%  ^| ver build_log.txt ===
)
exit /b %ERR%
```

### Pontos-chave

| Ponto | Por que |
|---|---|
| `%~dp0` | Resolve o diretório do próprio `.bat` (com barra final). Permite chamar de qualquer lugar. |
| `> "%LOG%" 2>&1` | Captura stdout **e** stderr no arquivo; **antes** de `set ERR=`. |
| `type "%LOG%"` | Imprime o conteúdo no console depois — útil quando quem chamou ainda quer ver. |
| `/p:Config=` | Nome canônico nos `.dproj` recentes. Versões mais antigas aceitam `Configuration=` também. |

> ⚠️ **Armadilha do exit code (build "OK" falso).** `%ERRORLEVEL%` reflete sempre o
> **último** comando executado. Se o `.bat` fizer `type "%LOG%"` e só então
> `exit /b %ERRORLEVEL%`, ele devolve o código do `type` (quase sempre `0`) e
> **mascara a falha do msbuild** — quem chamou vê sucesso mesmo com `error E2010`
> no log. **Sempre** capture o resultado do msbuild numa variável (`set ERR=%ERRORLEVEL%`)
> **imediatamente** após o msbuild, antes do `type`, e finalize com `exit /b %ERR%`.
> Por isso a regra de ouro continua valendo: **conferir o build pelo conteúdo do
> `build_log.txt` (grep por `error E`/`error F`/`Fatal`), nunca pelo exit code isolado.**
| `/v:minimal /clp:NoSummary` | Reduz ruído do msbuild (Microsoft-Build-Engine summary, etc) sem perder erros. |
| `/nologo` | Some o banner do msbuild. |

### Variantes para testes unitários (DUnitX)

```bat
@echo off
call "C:\Program Files (x86)\Embarcadero\Studio\37.0\bin\rsvars.bat"
set LOG=%~dp0test_log.txt

REM Compila + roda + captura tudo
dcc32 -B -Q -E"%~dp0Win32\Debug" -N"%~dp0Win32\Debug\dcu" "%~dp0SeuProjeto.Tests.dpr" > "%LOG%" 2>&1
if %ERRORLEVEL% NEQ 0 ( type "%LOG%" & exit /b 1 )

REM ATENCAO: DUnitX nao aceita "--exit" sozinho — exige chave:valor.
REM A chave correta e "exitbehavior". Valores: Continue (default) | Pause.
"%~dp0Win32\Debug\SeuProjeto.Tests.exe" --exitbehavior:Continue >> "%LOG%" 2>&1
type "%LOG%"
exit /b %ERRORLEVEL%
```

> Se rodar com `--exit`, DUnitX falha com:
> `ECommandLineError: Option [exit] expected a following :value but none was found`

### Como invocar do Bash/PowerShell do Claude Code

```bash
# Bash (MSYS)
cmd.exe /c '"<caminho-absoluto>\build.bat" 2>&1'

# PowerShell
& cmd.exe /c '"<caminho-absoluto>\build.bat" 2>&1'
```

> O `& cmd.exe /c '...'` no PowerShell é o invariante que sempre funciona. Variantes que **falham** neste ambiente:
>
> - `Set-Location <pasta>; cmd.exe /c "build.bat"` — o `cmd.exe` filho não vê o cwd.
> - `cmd.exe /c 'cd /d <pasta> && build.bat'` — funciona às vezes, mas é frágil quando o caminho tem espaços ou caracteres especiais.

### Depois de rodar

O agente lê `build_log.txt` com `Read`. O arquivo deve estar no `.claudeignore` para não poluir contexto em listagens recursivas.

```
# .claudeignore
build_log.txt
test_log.txt
```

## Quando perguntar ao desenvolvedor antes de gerar o `.bat`

- Existem **duas ou mais** pastas `Studio\<N>.0\` instaladas (mais de um Delphi). Listar e perguntar qual usar.
- O projeto compila para plataforma **não-Win32** (Android/iOS/OSX64) — depende de SDK e PA Server específicos da máquina; não chutar.
- O `.dproj` tem build configurations além de `Debug`/`Release`.
- O Delphi é **Community Edition** (caminho de instalação difere de `Program Files (x86)`).

## Erro MSB6003 / MSB6002: Command-line too long

**Sintoma:**
```
warning MSB6002: The command-line for the "DCC" task is too long. Command-lines longer than 32000 characters
error MSB6003: The specified task executable "dcc" could not be run. O nome do arquivo ou a extensão é muito grande
```

**Causa:** O `DCC_UsePackage` do `.dproj` (que lista pacotes instalados no IDE) é expandido em flags `-LU<pacote>` para o dcc32/dcc64. Quando o desenvolvedor tem muitos pacotes de terceiros instalados, a linha ultrapassa 32000 chars.

**Solução:** Chamar o `dcc32.exe` / `dcc64.exe` diretamente, usando um arquivo `.cfg` com mesmo nome do projeto. O `.cfg` não tem limite de tamanho. O compilador lê o `apiNFCE.cfg` automaticamente quando está na pasta do projeto.

**Formato do `.cfg`:**
```ini
; Comentarios com ;
-DDEBUG               ; Define
-DADRCONN_FIREDAC
-NSWinapi;System;...  ; Namespaces (-NS, sem espaço)
-E".\bin"             ; Output EXE
-N0".\dcu"            ; Output DCU
-U"modules\horse\src" ; Search path (repete por pasta)
-I"C:\ACBr\Fontes"    ; Include path para arquivos .inc
```

**Template de bat que usa o `.cfg`:**
```bat
call "C:\Program Files (x86)\Embarcadero\Studio\23.0\bin\rsvars.bat"
cd /d "%PROJ_DIR%"   ; OBRIGATORIO: dcc32 resolve paths do .cfg relativo ao cwd
dcc32.exe "projeto.dpr" >> "%LOG%" 2>&1
```

> `cd /d` é obrigatório antes de chamar o dcc32/dcc64 quando os paths no `.cfg` são relativos.

**Limitação Win64 + ACBr:**  
Se o ACBr só tem DCUs pré-compilados para Win32 (pasta `Lib\LibD29\Win32` populada, `Win64` vazia), compilar para Win64 a partir dos fontes do ACBr falha porque `ACBrTCP\ACBrSocket.pas` depende de `Controls` (VCL), que não está disponível em contexto Win64 sem os pacotes VCL compilados. Solução: compilar para Win32 (igualmente válido para servidor console Windows).

## Catálogo de erros do dcc32

Reaproveitado pelo subagente `delphi-build`. Os mais comuns que se resolvem só adicionando unit ao `uses`:

| Identificador faltando | Unit a adicionar |
|---|---|
| `TColor`, `TBitmap`, `TFont`, `TCanvas` | `Vcl.Graphics` (VCL) ou `FMX.Graphics` (FMX) |
| `TList<>`, `TObjectList<>`, `TDictionary<>` | `System.Generics.Collections` |
| `Format`, `IntToStr`, `Trim`, `FreeAndNil` | `System.SysUtils` |
| `TDateTime`, `IncDay`, `DaysBetween` | `System.DateUtils` |
| `TStringList`, `TStringStream` | `System.Classes` |
| `RGB`, `MessageBox`, `LoadCursor` | `Winapi.Windows` |
