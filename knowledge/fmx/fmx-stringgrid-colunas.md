# [FMX] TStringGrid — colunas são objetos `TStringColumn`, não a propriedade VCL `Columns`

## Sintoma

Ao **abrir o form em runtime** (não em compilação — o `.fmx` só é validado quando o form é
instanciado), surge um diálogo de erro de streaming, um problema de cada vez:

```
Error reading <grid>.ShowSelectedHeaders: Property ShowSelectedHeaders does not exist.
```
depois, após remover:
```
Error reading <grid>.Columns: Property Columns does not exist.
```

## Causa

O `.fmx` foi escrito (ou copiado) **com sintaxe VCL** de grid. No `TStringGrid`/`TGrid` do
**FireMonkey** essas construções não existem:

- ❌ `Columns = <item Header='X' Width=120 end ...>` → é sintaxe **VCL** (`TDBGrid`/`TStringGrid` VCL).
- ❌ `ShowSelectedHeaders` → propriedade **VCL**, não existe em FMX.
- ❌ `Width` dentro da coluna → em FMX é `Size.Width`.

Como o `.fmx` é compilado apenas como *resource* e validado pelo sistema de streaming em
**runtime**, o `dcc`/msbuild compila **BUILD OK** mesmo com propriedades inválidas. O erro só
aparece ao instanciar o form.

## Correção — sintaxe FMX

No FMX, cada coluna é um **objeto filho** do grid:

```pascal
object sgrOperadores: TStringGrid
  Align = Client
  ReadOnly = True
  OnCellClick = sgrOperadoresCellClick
  object ColNome: TStringColumn
    Header = 'Nome'
    Size.Width = 180.000000000000000000
  end
  object ColLogin: TStringColumn
    Header = 'Login'
    Size.Width = 100.000000000000000000
  end
end
```

E declarar os campos na classe (como o designer faria), mantendo `.fmx` e `.pas` sincronizados:

```pascal
sgrOperadores: TStringGrid;
ColNome: TStringColumn;
ColLogin: TStringColumn;
```

`TStringColumn` está na unit **`FMX.Grid`** (já necessária para `TStringGrid`).

## Notas

- Colunas declaradas são obrigatórias quando o grid é preenchido **manualmente** via
  `Grid.Cells[col, row] := ...`. O índice de `Cells` segue a **ordem de declaração** das colunas (0,1,2…).
- Grids preenchidos via **LiveBindings** (`TBindSourceDB` + `TLinkGridToDataSource`) **não** precisam
  de colunas no `.fmx` — são geradas automaticamente em runtime.
- Tipos de coluna FMX: `TStringColumn`, `TCheckColumn`, `TProgressColumn`, `TPopupColumn`,
  `TImageColumn`, `TDateColumn`, `TCurrencyColumn` etc. — todos em `FMX.Grid`.
- Relacionado: [campos-orfaos-fmx.md](campos-orfaos-fmx.md) (outro erro de streaming `.fmx` ↔ `.pas`).
