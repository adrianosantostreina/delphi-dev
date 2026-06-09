# FireDAC em app CONSOLE + Firebird: AVs traicoeiros

Dois erros distintos que aparecem como **Access Violation "Read of address 0x0"**
em TODA operacao de banco de um app **console** (ex.: API REST Horse) e que se
mascaram mutuamente — o segundo so aparece depois de corrigir o primeiro.

## 1. Wait cursor GUI num app sem GUI

FireDAC, por padrao, mostra um "wait cursor" durante operacoes. Se o binario
linka `FireDAC.VCLUI.Wait` (ou FMXUI) e cria um `TFDGUIxWaitCursor`, o provider
'Auto' escolhe VCL/FMX e tenta acessar `Screen`/`Application` — que **nao existem**
num app console -> **AV no primeiro acesso ao banco**. Pior: se a conexao e aberta
no startup (ex.: pool em `initialization`), o AV deixa o pool vazio e todo request
cai num nil deref no mesmo offset.

**Correcao:** num app console, linkar `FireDAC.ConsoleUI.Wait` em vez de
`FireDAC.VCLUI.Wait`. Em wrappers como ADRConnection, ajustar a unit de conexao
(`ADRConn.Model.Firedac.Connection.pas`) no ramo `{$IFDEF MSWINDOWS}` para usar
`FireDAC.ConsoleUI.Wait`. Sintoma de sucesso: o exe encolhe (VCL/Forms saem do link)
e o AV vira uma `EFDException` legivel.

## 2. fbclient.dll com arquitetura trocada (-314)

`EFDException [FireDAC][Phys][FB]-314: Cannot load vendor library [fbclient.dll].
fbclient.dll has unsupported architecture [x86]. Required [x64]` (ou vice-versa).

A `fbclient.dll` (client do Firebird) precisa ter a **mesma arquitetura do processo**:
processo Win32 -> fbclient x86; processo Win64 -> fbclient x64. Um exe 64-bit NAO
carrega DLL 32-bit. A arquitetura do **servidor** Firebird e irrelevante (a conexao
e via TCP); o que importa e a do client linkado ao processo.

**Correcoes:**
- Compilar o app na mesma bitness do `fbclient.dll` disponivel (ex.: Win32 se so ha
  fbclient x86 no `.\bin`), OU
- Colocar um `fbclient.dll` da arquitetura certa no diretorio do exe / no PATH.

**Como checar a arquitetura de um .dll/.exe** (PE header, sem ferramentas externas):
ler o offset em 0x3C (e_lfanew), e no PE+4 o campo Machine: `0x14C`=x86, `0x8664`=x64.

## Relacionado
- [firedac-registro-drivers.md](firedac-registro-drivers.md) — driver factory ausente
- [adrconnection-query-builder.md](adrconnection-query-builder.md) — DEFINE `ADRCONN_FIREDAC`, builder
