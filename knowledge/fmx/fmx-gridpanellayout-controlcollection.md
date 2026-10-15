# [FMX] TGridPanelLayout exige ControlCollection explícita no .fmx

## Sintoma

Ao converter um container para `TGridPanelLayout` editando o `.fmx` à mão (sem o designer),
definindo apenas `ColumnCollection` e `RowCollection`, os controles filhos **colapsam numa
única célula** — visualmente um filho cobre o outro (o último na ordem de z-order fica por
cima, ocupando a área toda) e os demais "somem". Compila sem erro (é problema de streaming,
não de código).

## Causa

`TGridPanelLayout` **não** auto-distribui os filhos em row-major ao carregar do `.fmx`.
A posição de cada controle vem da propriedade **`ControlCollection`**, que mapeia cada
controle a uma célula (`Column`/`Row`). Sem ela, todos vão para a célula (0,0).

O designer do RAD **sempre** grava a `ControlCollection` — por isso o bug só aparece quando
se edita o `.fmx` manualmente.

## Correção

Adicionar `ControlCollection` mapeando cada filho por nome (o filho precisa ter `Name`).
As referências em `Control =` resolvem mesmo apontando para objetos declarados **depois**
no stream (fixup do FMX). Os filhos usam `Align = Client` para preencher a própria célula.

```
object Lyt: TGridPanelLayout
  ColumnCollection = <
    item
      Value = 50.000000000000000000
    end
    item
      Value = 50.000000000000000000
    end>
  ControlCollection = <
    item
      Column = 0
      Control = CardEsquerda
      Row = 0
    end
    item
      Column = 1
      Control = CardDireita
      Row = 0
    end>
  RowCollection = <
    item
      Value = 100.000000000000000000
    end>
  object CardEsquerda: TRectangle
    Align = Client
    Margins.Right = 10.000000000000000000
  end
  object CardDireita: TRectangle
    Align = Client
    Margins.Left = 10.000000000000000000
  end
end
```

- `ColumnCollection`/`RowCollection` items: `Value` é percentual (SizeStyle padrão = ssPercent),
  então `50`+`50` = duas colunas iguais; `100` = uma linha cheia.
- Espaçamento entre células: usar `Margins` nos filhos (ex.: `Right=10` num, `Left=10` no outro
  → gap de 20px com larguras iguais).

## Quando usar

Para **responsividade de colunas iguais** (cards lado a lado que devem encolher juntos).
Não usar `Align = Left` com largura fixa + `Align = Client` no vizinho: o `Left` nunca encolhe,
e só o `Client` absorve a variação de tamanho (sintoma: só um card redimensiona).

`TGridPanelLayout` está em `FMX.Layouts` (mesma unit de `TLayout`) — uses já coberto se o form
já usa layouts.
