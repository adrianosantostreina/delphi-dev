# ACBrPosPrinter / impressão ESC/POS de cupom (térmica)

Como imprimir cupom/recibo em impressora térmica a partir de Delphi, e a
armadilha de tentar fazer isso por GDI.

## Armadilha: NÃO imprima em térmica via GDI

Imprimir numa impressora **térmica** (não-fiscal, ESC/POS) usando o caminho GDI
do Windows (`CreateDC` + `StartDoc` + `TextOut` + `EndDoc`) costuma **travar o
app na thread da UI** (app "Não Respondendo", cursor de ampulheta preso) e **não
imprime nada**. Motivos:

- Drivers térmicos esperam **bytes ESC/POS RAW**, não uma página rasterizada por GDI.
- Se a impressora padrão for **virtual** (Microsoft Print to PDF/XPS/Fax), o
  `StartDoc` abre um diálogo "Salvar como" que num app **FireMonkey** fica
  escondido/sem foco → trava.

**Correto para térmica = ESC/POS RAW** (via spooler do Windows, sem renderização):
ou ACBrPosPrinter, ou `WinSpool` direto (`OpenPrinter`/`StartDocPrinter` datatype
`RAW`/`WritePrinter`).

## ACBrPosPrinter — uso mínimo

`TACBrPosPrinter` (unit `ACBrPosPrinter`, pasta `ACBrSerial`) interpreta as **tags**
do cupom (`<n>`negrito`</n>`, `</zera>`, `</corte_total>`, `</ce>`centralizar etc.)
quando `TraduzirTags := True`. Setar o `Buffer.Text` e chamar `Imprimir`:

```pascal
FPos := TACBrPosPrinter.Create(nil);
FPos.Modelo := ppEscPosEpson;       // ESC/POS genérico (cobre a maioria)
FPos.Porta := '*';                  // '*' = IMPRESSORA PADRÃO do Windows (RAW)
FPos.PaginaDeCodigo := pc850;
FPos.ColunasFonteNormal := 48;      // 80mm normal ≈ 48 col; 58mm ≈ 32 col
FPos.CortaPapel := True;
FPos.ControlePorta := True;         // abre/fecha a porta a cada impressão
FPos.TraduzirTags := True;
FPos.Buffer.Text := ATextoComTags;
FPos.Imprimir;
```

### Valores de `Porta`
- `'*'` → impressora **padrão** do Windows (RAW ESC/POS). Não precisa detectar o nome.
- `'RAW:NomeDaImpressora'` → impressora instalada específica, via spooler.
- `'COM1'` / `'LPT1'` → porta serial/paralela.
- caminho terminando em `.txt` → grava os **bytes ESC/POS em arquivo** (depuração).
  **Armadilha:** o ACBr **apaga** esse arquivo a cada `Conectar` (`TACBrDeviceLPT.Conectar` faz
  `DeleteFile` quando é porta TXT). Com `ControlePorta := True` ele conecta a cada `Imprimir`, então
  o arquivo só guarda o **último** cupom. Para acumular (teste automatizado que conta cupons), use
  `ControlePorta := False` e chame `Ativar` uma vez — o arquivo vale desde a ativação. Também é
  `dtFile` qualquer porta que comece com `FILE:` ou contenha `\` (ver `DeduzirTipoPorta`).
  As linhas saem terminadas em **LF**, não CRLF.
- **`'USB001'` NÃO funciona**: é o nome da **porta** do Windows, não uma porta que o
  ACBr abre direto. Use `'*'` ou `'RAW:<nome da impressora>'`.

### `ColunasFonteNormal` x mm de papel
Confusão comum: papel de **80mm** ≈ **48 colunas** em fonte normal (não 80). 58mm ≈ 32.
Colocar 80 colunas estoura o layout. O nº de colunas usado para **montar o texto**
(alinhamento por espaços) deve ser o MESMO passado ao ACBr.

## Plugar o ACBr no build (DCUs pré-compiladas)

Não precisa compilar o fonte do ACBr nem instalar pacote. Basta apontar o
**Search Path** para as DCUs já compiladas da versão certa do Delphi:

- Delphi 13 (RAD Studio 37.0) → `LibD37\Win32` (usado no CEM 3.0)
- Delphi 12 Athens (RAD Studio 23.0) → `LibD29\Win32`
- Delphi 11 Alexandria → `LibD28\Win32`

Ex.: adicionar ao `DCC_UnitSearchPath` do `.dproj`:
`C:\Componentes\ACBR\Lib\Delphi\LibD29\Win32`

Essa pasta já traz **todas** as dependências como DCU (ACBrBase, ACBrDevice,
ACBrConsts, ACBrUtil.*, Synapse `blcksock`/`synsock`), então **um único path**
resolve. Se o command line do `dcc32` estourar (`MSB6003`), usar
`<DCC_ForceExecute>true</DCC_ForceExecute>` (ver [msb6003-command-line-too-long]).

> A DCU é por versão de compilador: `LibD29` casa com Athens. Versão errada dá
> `F2051 unit X was compiled with a different version`.

## Testar sem impressora (padrão usado no CEM 3.0)

- Separe a **montagem do texto com tags** numa unit pura (`function MontarCupom(...): string`) e teste
  o layout com DUnitX: tire as tags com regex (`</?[a-z_]+>`) e confira que nenhuma linha passa de
  `ColunasFonteNormal`.
- Ponta a ponta: porta em `.txt` (com `ControlePorta := False`, ver acima), decodifique o arquivo em
  `cp850` e conte marcas únicas por cupom (ex.: `"Pedido 123
"`); o corte total aparece como
  `GS V` (`V`).
