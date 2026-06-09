# Uses clause — componentes e tipos FMX comuns

Tabela de referência rápida: dado um tipo/componente, em qual unit declarar. Consultar **antes** de escrever unit nova para evitar `E2003 Undeclared identifier`.

Aplica-se a Delphi 11+ / FMX. Units marcadas com ⚠️ têm variações entre versões — confirmar no ambiente.

---

## Forms / Frames / Styles (FMX.Forms)

| Tipo | Unit |
|---|---|
| `TForm` | `FMX.Forms` |
| `TFrame` | `FMX.Forms` |
| `TApplication` | `FMX.Forms` |
| `TStyleBook` | `FMX.Forms` (também em `FMX.Styles`) |
| `TStyleManager` | `FMX.Styles` |
| `TCustomStyleBook` | `FMX.Styles` |

## Layouts e containers

| Tipo | Unit |
|---|---|
| `TLayout` | `FMX.Layouts` |
| `TScrollBox` | `FMX.Layouts` |
| `TVertScrollBox` | `FMX.Layouts` |
| `THorzScrollBox` | `FMX.Layouts` |
| `TFlowLayout` | `FMX.Layouts` |
| `TGridLayout` | `FMX.Layouts` |
| `TTabControl` | `FMX.TabControl` |
| `TTabItem` | `FMX.TabControl` |
| `TMultiView` | `FMX.MultiView` |
| `TSplitter` | `FMX.Controls` |

## Controles comuns (FMX.StdCtrls)

| Tipo | Unit |
|---|---|
| `TLabel` | `FMX.StdCtrls` |
| `TButton` | `FMX.StdCtrls` |
| `TSpeedButton` | `FMX.StdCtrls` |
| `TCheckBox` | `FMX.StdCtrls` |
| `TRadioButton` | `FMX.StdCtrls` |
| `TSwitch` | `FMX.StdCtrls` |
| `TTrackBar` | `FMX.StdCtrls` |
| `TProgressBar` | `FMX.StdCtrls` |
| `TAniIndicator` | `FMX.StdCtrls` |
| `TArcDial` | `FMX.StdCtrls` |
| `TScrollBar` | `FMX.StdCtrls` |
| `TGroupBox` | `FMX.StdCtrls` |
| `TExpander` | `FMX.StdCtrls` |
| `TImageControl` | `FMX.StdCtrls` (ou `TImage` de `FMX.Objects`) |

## Objetos gráficos (FMX.Objects)

| Tipo | Unit |
|---|---|
| `TRectangle` | `FMX.Objects` |
| `TRoundRect` | `FMX.Objects` |
| `TCircle` | `FMX.Objects` |
| `TEllipse` | `FMX.Objects` |
| `TLine` | `FMX.Objects` |
| `TPath` ⚠️ (shape) | `FMX.Objects` (o namespace de `System.IOUtils.TPath` é diferente) |
| `TImage` | `FMX.Objects` |
| `TText` | `FMX.Objects` |
| `TPaintBox` | `FMX.Objects` |
| `TArc` | `FMX.Objects` |
| `TPie` | `FMX.Objects` |
| `TSelection` | `FMX.Objects` |

## Entrada de texto

| Tipo | Unit |
|---|---|
| `TEdit` | `FMX.Edit` |
| `TMemo` | `FMX.Memo` |
| `TNumberBox` | `FMX.NumberBox` |
| `TSearchEditButton` | `FMX.SearchBox` |
| `TClearEditButton` | `FMX.Edit` |
| `TPasswordEditButton` | `FMX.Edit` |
| `TDateEdit` | `FMX.DateTimeCtrls` |
| `TTimeEdit` | `FMX.DateTimeCtrls` |

## Listas

| Tipo | Unit |
|---|---|
| `TListBox` | `FMX.ListBox` |
| `TListBoxItem` | `FMX.ListBox` |
| `TComboBox` | `FMX.ListBox` |
| `TListView` | `FMX.ListView` |
| `TListViewItem` | `FMX.ListView` |
| `TTreeView` | `FMX.TreeView` |

## Diálogos e serviços

| Tipo | Unit |
|---|---|
| `TDialogService` | `FMX.DialogService` |
| `TMessageDialog` | `FMX.Dialogs` |
| `ShowMessage` (procedure) | `FMX.Dialogs` |
| `TOpenDialog` / `TSaveDialog` | `FMX.Dialogs` |

## Gráficos / estilo

| Tipo | Unit |
|---|---|
| `TBitmap` | `FMX.Graphics` |
| `TCanvas` | `FMX.Graphics` |
| `TBrush` | `FMX.Graphics` |
| `TStrokeBrush` | `FMX.Graphics` |
| `TFont` | `FMX.Graphics` |
| `TAlphaColor` | `System.UITypes` |
| `TAlphaColorRec` | `System.UITypes` |
| `TAlignLayout` (enum) | `FMX.Types` |
| `TFontStyle` | `System.UITypes` |

## RTL / System comuns

| Tipo / Função | Unit |
|---|---|
| `Exception`, `EArgumentNilException` | `System.SysUtils` |
| `TStringList` | `System.Classes` |
| `TList<T>`, `TObjectList<T>`, `TDictionary<K,V>` | `System.Generics.Collections` |
| `TPath` (filesystem) | `System.IOUtils` |
| `TFile` | `System.IOUtils` |
| `TDirectory` | `System.IOUtils` |
| `TJSONValue`, `TJSONObject`, `TJSONArray`, `TJSONNumber` | `System.JSON` |
| `TTask`, `ITask` | `System.Threading` |
| `TThread`, `TThread.Synchronize`, `TThread.Queue`, `TThread.Sleep` | `System.Classes` |
| `TProc`, `TProc<T>`, `TFunc<T>` | `System.SysUtils` |
| `TValue`, `TRttiContext` | `System.Rtti` |
| `TypeInfo`, `GetTypeData` | `System.TypInfo` |
| `RT_RCDATA` | `Winapi.Windows` (portável também em Android) |
| `TResourceStream` | `System.Classes` |
| `TStringStream` | `System.Classes` |

## FireDAC

| Tipo | Unit |
|---|---|
| `TFDConnection` | `FireDAC.Comp.Client` |
| `TFDQuery` | `FireDAC.Comp.Client` |
| `TFDCommand` | `FireDAC.Comp.Client` |
| `TFDTable` | `FireDAC.Comp.Client` |
| `TFDTransaction` | `FireDAC.Comp.Client` |
| `TFDStoredProc` | `FireDAC.Comp.Client` |
| `TFDMemTable` | `FireDAC.Comp.Client` |
| `TFDGUIxWaitCursor` | `FireDAC.Comp.UI` + `FireDAC.FMXUI.Wait` (FMX) ou `FireDAC.VCLUI.Wait` (VCL) |
| `TFDPhysSQLiteDriverLink` | `FireDAC.Phys.SQLite` |
| Link estático SQLite | `FireDAC.Phys.SQLiteWrapper.Stat` |
| `TFDPhysMySQLDriverLink` | `FireDAC.Phys.MySQL` |
| `TFDPhysFBDriverLink` (Firebird) | `FireDAC.Phys.FB` |

**FireDAC boilerplate mínimo (SQLite multiplatform):**
```pascal
uses
  FireDAC.Stan.Intf, FireDAC.Stan.Option, FireDAC.Stan.Error,
  FireDAC.UI.Intf, FireDAC.Phys.Intf, FireDAC.Stan.Def, FireDAC.Stan.Pool,
  FireDAC.Stan.Async, FireDAC.Stan.Param, FireDAC.Stan.ExprFuncs,
  FireDAC.Phys, FireDAC.Phys.SQLite, FireDAC.Phys.SQLiteDef,
  FireDAC.Phys.SQLiteWrapper.Stat,
  FireDAC.DatS, FireDAC.DApt.Intf, FireDAC.DApt,
  FireDAC.FMXUI.Wait, FireDAC.Comp.UI,
  FireDAC.Comp.Client;
```

## Testes (DUnitX)

| Tipo | Unit |
|---|---|
| `TestFixture`, `Test`, `Setup`, `TearDown` attributes | `DUnitX.TestFramework` |
| `Assert` | `DUnitX.TestFramework` |
| `TDUnitX` | `DUnitX.TestFramework` |
| `TDUnitXConsoleLogger` | `DUnitX.Loggers.Console` |
| `TDUnitXXMLNUnitFileLogger` | `DUnitX.Loggers.Xml.NUnit` |

---

## Regra prática

Antes de escrever `unit`, listar mentalmente os tipos/funções que o corpo vai usar, conferir aqui, e **declarar no topo**. Se um tipo não está na tabela, consultar a doc Embarcadero ou Ctrl+Click no IDE — e **adicionar à tabela** para ajudar o próximo.

## Armadilhas comuns

- **`TPath`**: existem dois — `System.IOUtils.TPath` (filesystem) e `FMX.Objects.TPath` (shape vetorial). Qualificar com o namespace se houver conflito.
- **`FMX.Controls.Presentation`**: exigida quando o form/frame usa controles com presentation proxies (quase todos em Delphi 11+). Adicionar no `uses` mesmo sem referência direta no código — o compilador pede.
- **`FireDAC.Phys.SQLiteWrapper.Stat`**: necessária para link estático do SQLite em mobile (Android/iOS). Sem ela, o app compila mas falha em runtime com "Cannot load driver: SQLite".
- **`FMX.Dialogs` vs `FMX.DialogService`**: `ShowMessage` vem de `FMX.Dialogs`; `TDialogService.MessageDialog` (assíncrono, multiplat) vem de `FMX.DialogService`. Preferir o segundo em apps mobile.
- **`System.Classes` vs `System.SysUtils`**: `TThread`, `TStream` ficam em `System.Classes`; `Exception`, `Format`, `IntToStr` ficam em `System.SysUtils`. Quase sempre ambas são necessárias juntas.
