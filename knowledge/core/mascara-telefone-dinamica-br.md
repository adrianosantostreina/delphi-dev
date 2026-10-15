# Máscara de telefone BR: fixa trunca dígito — precisa ser dinâmica

Telefone brasileiro tem **duas larguras**: fixo com 10 dígitos (`(34)3322-1100`) e celular com
11 (`(34)99988-7766`). Um único campo "Fone"/"Celular" na prática recebe os dois.

## O bug: máscara fixa descarta dígito em silêncio

O aplicador de máscara típico percorre a máscara e consome os dígitos:

```pascal
function TMaskFormatHelper.MaskWith(const AMask, AValue: string): string;
var
  I, J: integer;
begin
  Result := EmptyStr;
  if AValue.IsEmpty then Exit;
  J := 0;
  for I := 0 to Pred(AMask.Length) do
  begin
    if AMask.Chars[I] = '#' then
    begin
      Result := Result + AValue.Chars[J];
      Inc(J);
    end
    else
      Result := Result + AMask.Chars[I];
    if J = AValue.Length then
      Break;
  end;
end;
```

Repare: o laço termina quando a **máscara** acaba. Com `'(##)####-####'` (10 posições) e 11
dígitos digitados, **o 11º dígito simplesmente não entra no Result** — sem erro, sem aviso.
O usuário digita o celular certo e o cadastro grava um número incompleto.

É por isso que se vê tanto código com a máscara de telefone **comentada**: alguém ligou,
percebeu que "comia número" e desligou em vez de corrigir.

## Correção: escolher a máscara pela quantidade de dígitos

Trate telefone como caso especial, fora do `GetValue` (que não conhece o valor):

```pascal
const
  C_MASCARA_TELEFONE_FIXO = '(##)####-####';
  C_MASCARA_CELULAR       = '(##)#####-####';
  C_DIGITOS_CELULAR       = 11;

function TMaskFormatHelper.FormatarTelefone(const AValue: string): string;
begin
  // AValue ja chega so com digitos.
  if AValue.Length > C_DIGITOS_CELULAR then
    Result := AValue                                   // passa reto, ver abaixo
  else if AValue.Length = C_DIGITOS_CELULAR then
    Result := MaskWith(C_MASCARA_CELULAR, AValue)
  else
    Result := MaskWith(C_MASCARA_TELEFONE_FIXO, AValue);
end;
```

E no `Format`, antes do caminho genérico:

```pascal
if (Self = TMaskFormat.Telefone) then
  Exit(FormatarTelefone(TStringUtils.ExtractNumber(AValue)));
```

## O detalhe que quase todo mundo erra: > 11 dígitos

A tentação é `Copy(AValue, 1, 11)`. **Não faça.** Bases legadas de telefone são texto livre e
guardam coisas reais como:

```
0216399975417      <- 13 digitos (operadora + DDD + numero)
03007892444        <- numero 0300, nao e celular
 93 991194162      <- espaco a esquerda
(11)2466-8080/     <- mascara + barra sobrando
(  )    -    /     <- esqueleto de mascara vazio
```

Truncar `0216399975417` para 11 gera `(02)16399-9754` — um telefone que **nunca existiu**,
gravado por cima do dado original. Deixar passar sem máscara é feio, mas **íntegro**.

Regra: máscara **nunca** descarta informação. Se não cabe, não mascara.

## Onde isso interage com os eventos do FMX

Se a máscara é aplicada em `OnChangeTracking`, ela roda também ao **carregar** o registro
(atribuição por código dispara o evento) — ou seja, vai rodar sobre os valores legados acima.
Ver [fmx-eventos-disparam-em-atribuicao.md](fmx-eventos-disparam-em-atribuicao.md).

Por isso a função tem de ser idempotente: `Format` aplicado sobre um texto já mascarado
extrai os dígitos de novo (`ExtractNumber`) e remonta igual — só não pode truncar no caminho.

## Gravar com ou sem máscara?

Decisão de projeto, mas cheque o dado real antes de decidir:

```sql
SELECT COUNT(*) TOTAL,
       SUM(CASE WHEN FONE LIKE '%(%' OR FONE LIKE '%-%' THEN 1 ELSE 0 END) COM_MASCARA
  FROM CLIENTES;
```

Se a coluna já é mista, não existe "formato canônico a preservar" — e aí gravar como o usuário
vê é defensável. Se é dígito puro em 100% das linhas, grave `ExtractNumbers` e mascare só na
exibição, senão você cria um segundo formato na base.
