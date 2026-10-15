# Ler JSON de API em Delphi: `null` explicito e data ISO-8601 com `Z`

Dois modos de o `System.JSON` falhar **em silencio** — sem excecao, sem log, so um campo
vazio na tela. Aparecem juntos em qualquer API Delphi que serialize dataset (DataSetSerialize,
`TFDDataSet.ToJSONArray` e afins).

## 1. `GetValue<T>(campo, default)` NAO devolve o default quando o campo e `null`

O serializador manda a chave com `null` dentro em vez de omiti-la:

```json
{ "ITP_VLRUNITARIOLIQUIDO": null, "PED_DTENTREGA": null }
```

`TJSONObject.GetValue<Double>('ITP_VLRUNITARIOLIQUIDO', 0)` **nao** cai no default: a chave
EXISTE, so que apontando para um `TJSONNull`. O default so vale para chave **ausente**.
Dependendo da versao, o resultado e lixo ou uma excecao no meio de um laco de render.

A cura e um "valor util" que trate `TJSONNull` como ausente:

```pascal
function ValorUtil(const AObjeto: TJSONValue; const ACampo: string): TJSONValue;
begin
  Result := nil;
  if AObjeto = nil then
    Exit;

  Result := AObjeto.FindValue(ACampo);

  if Result is TJSONNull then    // <- a linha que resolve
    Result := nil;
end;

class function TJSONLeitor.Numero(const AObjeto: TJSONValue;
  const ACampo: string; const ADefault: Double): Double;
var
  LValor: TJSONValue;
begin
  LValor := ValorUtil(AObjeto, ACampo);
  if not (LValor is TJSONNumber) then
    Exit(ADefault);
  Result := TJSONNumber(LValor).AsDouble;
end;
```

## 2. `TryStrToDateTime` nao le ISO-8601 — e falha calado

O corpo traz `"2026-08-30T00:00:00.000Z"`. `TryStrToDateTime` devolve **False** (nao
levanta), a variavel fica com o valor anterior e a tela escreve "data nao informada" num
registro que tem data. Use `TryISO8601ToDate` (`System.DateUtils`).

## 3. `AReturnUTC` do `TryISO8601ToDate`: o parametro que muda o DIA

```pascal
TryISO8601ToDate(LTexto, Result, True);   // <- True, nao False
```

O texto ja vem em UTC (`Z`). Com `AReturnUTC = False` o Delphi converte para o fuso local:
`2026-08-30T00:00:00Z` vira **29/08 21:00** no Brasil (UTC-3). O relatorio inteiro sai com
um dia a menos, e ninguem estranha porque a data continua *plausivel*.

Regra: se o servidor gravou uma **data** (nao um instante), o que interessa e a data que
ele gravou — `AReturnUTC = True`.

## 4. `TFormatSettings.Invariant` nao le `yyyy-mm-dd`

O `ShortDateFormat` do Invariant e americano (`MM/dd/yyyy`), entao `2026-08-30` nao casa.
Para o fallback de data ISO simples, monte o formato:

```pascal
LFormato := TFormatSettings.Invariant;
LFormato.DateSeparator   := '-';
LFormato.ShortDateFormat := 'yyyy-mm-dd';

if not TryStrToDate(LTexto, Result, LFormato) then
  Result := 0;
```

## Teste que vale a pena ter

Um objeto sintetico com `"NULO": null`, `"DATA_ISO": "...Z"`, `"DATA_SIMPLES": "2026-08-30"`
e `"DATA_RUIM": "nao e data"` cobre os quatro casos, roda sem servidor e custa nada.
Comparar `FormatDateTime('yyyy-mm-dd', ...)` com a string esperada e o que pega o bug do
`AReturnUTC` — comparar so "deu certo" nao pega.
