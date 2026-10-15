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

### Linux daemon: linkar `ConsoleUI.Wait` NAO basta — configurar o cursor

Num binario **Linux64** (ex.: API Horse em Docker), mesmo com `FireDAC.ConsoleUI.Wait`
linkado, **criar** um `TFDGUIxWaitCursor` com provider/screen cursor default ainda tenta
resolver um cursor de tela inexistente -> mesma AV 0x0. Depois de `Create`, configurar
explicitamente para console:

```pascal
{$IFDEF LINUX}
  FCursor.Provider := 'Console';
  FCursor.ScreenCursor := gcrNone;   // gcrNone esta em FireDAC.UI.Intf
{$ENDIF}
```

Pegadinhas de compilacao Linux64 (nao aparecem no Win, pois esse ramo e `{$IFDEF}`-guarded):
- `TFDGUIxWaitCursor` fica **E2003 undeclared** se `FireDAC.Comp.UI` nao estiver no `uses`
  visivel no ramo Linux (garantir que esteja incondicional ou no `{$IFDEF LINUX}`).
- `gcrNone` exige **`FireDAC.UI.Intf`** no `uses` do ramo Linux (senao E2003 no identificador).
- Nao `{$IFDEF MSWINDOWS}` a criacao do cursor: use uma guarda `{$IF (not Defined(ANDROID))
  and (not Defined(IOS))}` (o cursor existe em Win **e** Linux; so mobile fica de fora).

### Status no ADRConnection (verificado em 2026-08-29)

**Nenhuma versao publicada tem esse fix.** A ultima tag do upstream
(`github.com/adrianosantostreina/adrconnection`) e a **4.1.7**, e o fonte dela tem
exatamente o mesmo comportamento da 4.1.3: `FireDAC.Comp.UI` e `FireDAC.UI.Intf` so
entram no `uses` sob `{$IFDEF MSWINDOWS}`, e o cursor e criado sem configurar
Provider/ScreenCursor. Nao existe 4.1.8 — se voce leu isso aqui antes, estava errado.

Isso **nao e um bug para os consumidores Windows** (VCL/FMX): la o cursor funciona.
So quebra em build Linux64 console.

### Como corrigir sem tocar na lib: override de unit por search path

Quando a lib nao pode ser alterada (esta em produçao em outros projetos, e gerenciada
por Boss e seria apagada no proximo `boss install`), a saida limpa e **sombrear a unit**
no proprio projeto:

1. Copiar a unit da lib para uma pasta local do projeto (ex.: `patch/`), preservando o
   nome do arquivo e o `unit X;` original.
2. Aplicar o fix nessa copia.
3. Colocar a pasta **antes** da pasta da lib no `DCC_UnitSearchPath` do `.dproj` — o
   compilador resolve a primeira ocorrencia encontrada.
4. Deixar `modules/` intocado. `boss install` passa a ser inofensivo.

Como confirmar que o override pegou: a linha do linker no log de build mostra `-L patch`
antes de `-L modules\<lib>\Source`, e os erros/avisos passam a citar `patch\Unit.pas`.

Custo: e um fork de uma unit — ao atualizar a lib, re-sincronizar a copia a mao.
Documentar isso num comentario no topo do arquivo e no README da pasta.

**Pegadinha ao documentar:** comentario `{ }` em Pascal **nao aninha**. Se o cabecalho
explicativo contiver `{$IFDEF ...}`, o `}` fecha o comentario antes da hora e a unit
inteira desanda (`E2029 'UNIT' expected`, depois `E2038 Illegal character '}'`).
Use `//` no cabecalho, ou escreva as diretivas sem chaves.

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
