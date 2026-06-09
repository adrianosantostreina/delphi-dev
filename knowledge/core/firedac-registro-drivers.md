# Registro obrigatório de drivers e UI do FireDAC

## O problema

Ao abrir a primeira conexão FireDAC num projeto que usa apenas `FireDAC.Comp.Client` / `ADRConnection`, o app estoura em runtime:

```
Exception in module ...exe at ...
Object factory for class {3E9B315B-F456-4175-A864-B2573C4A2201} is missing.
To register it, you can drop component [TFDGUIxWaitCursor] into your project.
```

O GUID varia — o importante é o nome `TFDGUIxWaitCursor` (ou `TFDPhysSQLiteDriverLink`, `TFDStanJSONFile`, etc.) na mensagem. Significa que **uma unit do FireDAC que registra uma classe via `initialization` não foi incluída no uses de nenhuma unit usada**.

## A causa

O FireDAC divide drivers e UI em units separadas. Cada uma faz `TFDDriverFactory.RegisterClass` no `initialization`. Se nenhuma unit da cadeia de uses fizer referência a elas, o linker não inclui, a classe não é registrada, e na hora do uso o factory pergunta pela classe e estoura.

Wrappers como **ADRConnection** **não incluem** essas units por design (deixa o desenvolvedor escolher driver/UI). Então você é responsável por adicionar.

## A solução — units por tipo

Inclua no `uses` de alguma unit viva no projeto (tipicamente a unit de conexão) as units abaixo **conforme o que usa**:

### Driver do banco

| Banco | Units |
|---|---|
| SQLite | `FireDAC.Phys.SQLite`, `FireDAC.Phys.SQLiteDef` |
| Firebird | `FireDAC.Phys.FB`, `FireDAC.Phys.FBDef` |
| MySQL | `FireDAC.Phys.MySQL`, `FireDAC.Phys.MySQLDef` |
| PostgreSQL | `FireDAC.Phys.PG`, `FireDAC.Phys.PGDef` |
| SQL Server | `FireDAC.Phys.MSSQL`, `FireDAC.Phys.MSSQLDef` |
| Oracle | `FireDAC.Phys.Oracle`, `FireDAC.Phys.OracleDef` |

### UI de espera (Wait Cursor) — ESCOLHER UM

| Target | Unit |
|---|---|
| App mobile FMX (Android/iOS) | `FireDAC.ConsoleUI.Wait` ✅ recomendado |
| App desktop FMX (Win/macOS/Linux) | `FireDAC.ConsoleUI.Wait` (simples) ou `FireDAC.FMXUI.Wait` (com diálogo) |
| App VCL | `FireDAC.VCLUI.Wait` |
| App console/service | `FireDAC.ConsoleUI.Wait` |

**Preferir `FireDAC.ConsoleUI.Wait` em projetos mobile** — não tenta abrir janela modal de espera, evita bugs visuais e funciona em qualquer target.

### Outras units que registram classes comuns

| Unit | Para que serve |
|---|---|
| `FireDAC.DApt` | Required sempre que fizer `Open`/`Fetch` de queries (registra `TFDManager` e adapter) |
| `FireDAC.Stan.ExprFuncs` | Funções de expressão para filters client-side |
| `FireDAC.Stan.JSONFile` | Salvar/carregar dataset em JSON |
| `FireDAC.Stan.StorageBin` | Formato binário nativo |

## Registro de classe ≠ instância do componente

**ATENÇÃO — pegadinha principal:** só ter `FireDAC.ConsoleUI.Wait` no uses **não é suficiente**. Essa unit apenas **registra a classe** `TFDGUIxWaitCursor` no factory — mas o Manager do FireDAC precisa de uma **instância** desse componente configurada como provider ativo para usar.

Quando você arrasta o componente `TFDGUIxWaitCursor` num DataModule no designer, o `.dfm` cria a instância automaticamente ao instanciar o DataModule. Sem DataModule (apps que usam ADRConnection puro, TFDConnection programática, etc.), você precisa **criar a instância manualmente**.

## Solução: unit de setup dedicada (sem DataModule)

```pascal
unit App.Infra.FireDAC.Setup;

interface

implementation

uses
  FireDAC.Phys.SQLite,
  FireDAC.Phys.SQLiteDef,
  FireDAC.Phys.SQLiteWrapper.Stat,  // SQLite3 estático — Android/iOS exige
  FireDAC.Stan.ExprFuncs,
  FireDAC.Stan.Intf,
  FireDAC.UI.Intf,
  FireDAC.Comp.UI,          // TFDGUIxWaitCursor, TFDPhysSQLiteDriverLink
  FireDAC.ConsoleUI.Wait,   // provider 'Console'
  FireDAC.DApt;

var
  FWaitCursor: TFDGUIxWaitCursor;
  FSQLiteDriver: TFDPhysSQLiteDriverLink;

initialization
  FWaitCursor := TFDGUIxWaitCursor.Create(nil);
  FWaitCursor.Provider := 'Console';
  FWaitCursor.ScreenCursor := gcrNone;

  FSQLiteDriver := TFDPhysSQLiteDriverLink.Create(nil);
  FSQLiteDriver.EngineLinkage := slStatic;  // obrigatório Android/iOS

finalization
  FSQLiteDriver.Free;
  FWaitCursor.Free;

end.
```

## SQLite no Android/iOS — Linkagem estática (crítico)

### O erro
```
[FireDAC][Phys][SQLite]-314. Cannot load vendor library
[libsqlite.so or libdb_sql.so].
dlopen failed: library "libdb_sql.so" not found
```

### Por que acontece
O FireDAC tem dois modos para o driver SQLite:

| `EngineLinkage` | Comportamento | Uso |
|---|---|---|
| `slDefault` ou `slDynamic` | `dlopen("libsqlite.so")` em runtime | Nunca funciona em Android moderno — apps não têm acesso à lib nativa do sistema |
| **`slStatic`** | Código C do SQLite3 linkado no `.so` do app | **Obrigatório em Android/iOS** |

### Por que "nunca precisei configurar antes"
Quando o desenvolvedor dropa `TFDPhysSQLiteDriverLink` no designer (dentro de um DataModule), o Delphi grava a propriedade `EngineLinkage = slStatic` no `.dfm` — isso vira o default visual. Projetos sem DataModule (connection via código/ADRConnection) não herdam essa configuração; precisa setar manualmente.

### Como corrigir
1. Adicionar `FireDAC.Phys.SQLiteWrapper.Stat` no uses — essa unit **contém o código C do SQLite3** (~1 MB), é o que é "linkado estaticamente"
2. Instanciar `TFDPhysSQLiteDriverLink` com `EngineLinkage := slStatic` **antes** do primeiro `.Connect`

Ambas as coisas são necessárias: a unit só "carrega" o código, o EngineLinkage só "configura qual usar".

### Versões antigas do Delphi
Em Delphi 10.3 e anteriores, a propriedade se chama `StaticLink: Boolean` (em vez de `EngineLinkage`). O equivalente é `DriverLink.StaticLink := True`.

Colocar essa unit **como uma das primeiras no `.dpr`** (antes de qualquer unit que acesse banco).

## Alternativa: DataModule clássico

Se preferir o visual do designer:

1. `File > New > Other > Delphi Files > Data Module`
2. Arrastar `TFDGUIxWaitCursor` + `TFDPhysSQLiteDriverLink` do palette
3. No `TFDGUIxWaitCursor`: `Provider := 'Console'`, `ScreenCursor := gcrNone`
4. No `.dpr`: `Application.CreateForm(TDMFireDAC, DMFireDAC);` (no topo, antes de qualquer acesso a banco)

Funciona igual — o `.dfm` cria as instâncias.

## Onde colocar

Seja unit de setup ou DataModule, deve ser referenciado **antes** de qualquer `.Open`, `.ExecSQL`, `TConnection.Connection` no boot. No `.dpr`, primeira ou segunda posição do uses.

## ADRConn: o backend FireDAC depende de um DEFINE de compilação

**Pegadinha separada (não é unit de uses — é `{$DEFINE}`):** a biblioteca **ADRConn** (`ADRConn.Model.Interfaces`, `ADRConn.Model.Factory`, `CreateConnection`, `CreateQuery`) suporta vários backends e escolhe o FireDAC por **define de compilação condicional `ADRCONN_FIREDAC`**. O código do backend FireDAC do ADRConn é todo gateado `{$IFDEF ADRCONN_FIREDAC}`.

Se esse define **não estiver no projeto** (`Project > Options > Building > Delphi Compiler > Conditional defines`, que grava `<DCC_Define>ADRCONN_FIREDAC;$(DCC_Define)</DCC_Define>` no `.dproj` por configuração), o ADRConn compila mas **não conecta a nada** — `CreateConnection`/`.Connect`/`CreateQuery` lançam exceção em runtime (connection/driver nil, factory vazio).

### Sintoma traiçoeiro
Se essas exceções caírem em blocos `try/except` silenciosos (comum em camadas DAO/sync que "engolem" erro), o app **parece travar/congelar** sem mensagem — porque toda operação de banco falha mas ninguém vê. Diagnóstico real: tornar os `except` visíveis (logar `E.ClassName + E.Message`) — o erro do ADRConn aparece na hora.

### Correção
Adicionar `ADRCONN_FIREDAC` aos Conditional defines de **todas** as configurações que importam (Debug/Release × cada plataforma) no `.dproj`. É ortogonal ao registro de drivers/UI do FireDAC acima: você precisa **das duas coisas** — o define `ADRCONN_FIREDAC` (ADRConn liga o backend) **e** as units `FireDAC.Phys.*`/Wait + instância do WaitCursor (FireDAC registra os drivers).

### Regra de diagnóstico
"App Delphi com ADRConn que trava/congela sem erro logo na 1ª query/conexão" → **antes de investigar thread/HTTP/SQLite, conferir se `ADRCONN_FIREDAC` está no `.dproj`** e se há `except` engolindo a exceção. Custou uma saga inteira de depuração de threading que não era o problema.

## Como diagnosticar outros GUIDs da mesma família

Se aparecer outro GUID diferente do `TFDGUIxWaitCursor`, procurar o nome da classe no erro, jogar no Google ou grep no `$(BDS)\source\data\firedac\` — a unit que contém a classe no `implementation` é a que você precisa adicionar ao uses.
