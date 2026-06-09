# Conversão numérica e o separador decimal do locale

`StrToFloat`, `StrToCurr`, `StrToFloatDef`, `StrToCurrDef` (e as versões `Try...`)
usam, por padrão, o **separador decimal do locale** (`FormatSettings` global do
sistema). Em pt-BR o separador decimal é **vírgula** (`,`) e o de milhar é ponto (`.`).

## Anti-padrão (bug silencioso)

Trocar a vírgula por ponto "para virar decimal" e chamar a conversão sem
`FormatSettings` quebra em máquinas pt-BR:

```pascal
// ERRADO em locale pt-BR:
LTexto := Edit.Text.Replace(',', '.');   // "37,55" -> "37.55"
Result := StrToCurrDef(LTexto, 0);        // '.' é lido como separador de MILHAR
                                          // -> conversão falha -> retorna 0 (default)
```

O default (0) mascara o erro: nenhuma exceção, o valor simplesmente "some".
Sintoma típico: validação "informe o valor" disparando mesmo com valor preenchido.

## Padrão correto

Parsear a string **no formato em que ela está**, fornecendo um `TFormatSettings`
explícito — nunca depender da configuração regional da máquina:

```pascal
var
  LFormato: TFormatSettings;
begin
  LFormato := TFormatSettings.Create;     // ou TFormatSettings.Invariant
  LFormato.DecimalSeparator  := ',';      // formato brasileiro exibido na UI
  LFormato.ThousandSeparator := '.';
  Result := StrToCurrDef(Edit.Text, 0, LFormato);
end;
```

Regra: o `TFormatSettings` deve refletir o formato **da string de entrada**, não o
que se deseja na saída. Se a UI mostra `37,55`, parseie com decimal `,`.

`TFormatSettings` está em `System.SysUtils`. A sobrecarga com `TFormatSettings`
existe desde o Delphi XE.

Vale também para a volta (`FloatToStr`/`FormatFloat`): passar `FormatSettings`
explícito evita surpresas quando o código roda em máquinas com locale diferente.
Relacionado: [[encoding-utf8-bom]].
