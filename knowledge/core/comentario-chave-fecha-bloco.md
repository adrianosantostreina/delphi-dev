# `}` dentro de comentário `{ … }` fecha o comentário no meio (E2029 / E2038)

## Sintoma

Cabeçalho de unit documentando endpoints REST:

```pascal
unit uServicoMerchant;

{
  Cobre os endpoints:
    GET    /merchants/{id}                     -> CarregarDetalhes
    GET    /merchants/{id}/status              -> CarregarStatus
}

interface
```

```
uServicoMerchant.pas(15): error E2029: 'INTERFACE' expected but '-' found
uServicoMerchant.pas(24): error E2038: Illegal character in input file: '}' (#$7D)
```

O erro aponta para **linhas dentro do comentário**, não para o lugar do problema — e o texto
("`INTERFACE` expected") sugere unit malformada, o que manda a investigação para o lado errado.

## Causa

Comentário `{ … }` em Delphi **não aninha**. A primeira `}` encontrada fecha o bloco, venha ela de
onde vier. Em `/merchants/{id}`, a chave de fechamento de `{id}` **encerra o comentário**, e o resto
do texto passa a ser lido como código.

Vale para qualquer chave literal em texto documental: `{id}`, `{merchantId}`, `{orderId}`, exemplos
de JSON, templates de URL, trechos de C/JavaScript.

## Correção

Trocar as chaves por outro delimitador no texto:

```pascal
{
    GET    /merchants/<id>                     -> CarregarDetalhes
}
```

Ou usar comentário de linha, que não tem terminador:

```pascal
//  GET    /merchants/{id}   -> CarregarDetalhes
```

`(* … *)` **não resolve** por aninhamento (também não aninha consigo mesmo), mas resolve este caso
específico, porque a `}` solta não o fecha:

```pascal
(*
    GET /merchants/{id}
*)
```

## Como reconhecer rápido

`E2029`/`E2038` cuja linha citada está **dentro de um bloco de comentário** = quase sempre uma `}`
literal no texto. Procurar `{` no meio do comentário antes de qualquer outra hipótese.

## Relacionado

Outros erros cuja mensagem aponta para o lugar errado:
[for-in-array-constructor-e2001.md](for-in-array-constructor-e2001.md),
[dfm-fmx-sem-bom.md](dfm-fmx-sem-bom.md).
