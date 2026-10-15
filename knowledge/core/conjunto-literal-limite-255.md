# `x in [a, b, c]` só aceita valores 0..255 — teste que **nunca** casa

## Sintoma

Um teste de pertinência escrito com literal de conjunto simplesmente não funciona,
sem erro em runtime e sem nada no log:

```pascal
if LStatus in [0, 408, 429] then      // 408 e 429 NUNCA casam
  Reenfileirar;
```

O compilador avisa — e é fácil não ler, porque é *warning*, não erro:

```
warning W1012: Constant expression violates subrange bounds
```

## Causa

Em Delphi, o **literal de conjunto** (`[...]`) constrói um `set of` cujo tipo-base é
inferido dos elementos, e `set of` é limitado a **256 elementos ordinais (0..255)**.
Qualquer constante acima de 255 no literal estoura a faixa: o compilador emite W1012 e
o elemento fora da faixa **não entra no conjunto**. O `in` então avalia sempre `False`
para aquele valor.

Nada disso aparece em execução. O código compila, roda e toma a decisão errada em
silêncio.

## Onde isso morde de verdade

**Códigos de status HTTP** são o caso clássico, porque a metade "boa" da lista funciona
e esconde o problema:

```pascal
if LStatus in [200, 201, 204] then ...   // OK: todos < 256
if LStatus in [0, 408, 429] then ...     // 408 e 429 NUNCA casam
if LStatus in [500, 502, 503] then ...   // NENHUM casa
```

Caso real (TMV 3.0, 2026-09-06): a fila de envio offline classificava a resposta do
servidor para decidir entre "tentar de novo" e "desistir". Com `LStatus in [0, 408,
429]`, um **429 Too Many Requests** caía no ramo do 4xx definitivo e o envio era
descartado — exatamente o oposto do que o status pede.

Outros gatilhos comuns: ano (`if LAno in [2020, 2021]`), código de erro do banco,
identificador de produto, qualquer enumeração com valor explícito acima de 255.

## Correção

Comparação explícita:

```pascal
if (LStatus = 0) or (LStatus = 408) or (LStatus = 429) then ...
```

Ou `case`, que **não** tem essa limitação — os rótulos são constantes ordinais
quaisquer, não um `set`:

```pascal
case LStatus of
  408, 429, 500, 502, 503, 504: Result := True;
else
  Result := False;
end;
```

`case` costuma ler melhor quando a lista é longa, e é a forma preferível para status
HTTP.

Uma terceira saída, quando a lista é grande e usada em vários lugares: declarar um
array constante e um `IndexOf`/laço. Raramente vale o custo.

## Como detectar no que já existe

```bash
grep -rnE "in \[[^]]*[0-9]{3,}" --include=*.pas .
```

Depois filtre os que têm número ≥ 256. Mais confiável ainda: procurar **W1012** no log
de build — o compilador já sabe.

## A lição além do bug

Este é um defeito que o compilador **denuncia** e que passa mesmo assim, porque o
projeto convive com centenas de hints e warnings de bibliotecas de terceiros e
ninguém lê mais a lista. Vale filtrar o log de build pelo próprio código:

```bash
grep -E "warning W1" build_log.txt | grep -v "modules\\\\"
```

## Ver também

- [comentario-chave-fecha-bloco.md](comentario-chave-fecha-bloco.md)
- [class-var-vaza-para-campos-de-instancia.md](class-var-vaza-para-campos-de-instancia.md)
