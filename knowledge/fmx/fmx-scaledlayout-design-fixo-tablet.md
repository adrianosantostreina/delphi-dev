# [FMX/Mobile] TScaledLayout — design em tamanho fixo que escala para o device

## Problema
Forms FMX desenhados num canvas fixo (ex.: `ClientWidth=560`, `ClientHeight=900`,
`FormFactor.Devices=[Desktop]`) com filhos posicionados por **coordenadas absolutas**
(`Position.X/Y`, `Size.Width/Height`) aparecem **corretos no Windows/desktop**, mas no
**tablet/celular Android/iOS** o conteudo fica "ilhado" num bloco no canto superior
esquerdo (do tamanho do design) enquanto o resto da tela fica vazio — "parece um
smartphone pequeno num tablet".

Causa: no mobile o form ocupa a tela inteira; layouts raiz com `Align=Contents/Client`
preenchem a tela real, mas os filhos com posicao absoluta continuam nas coordenadas do
canvas de design (ex.: 560x900). Eles **nao escalam** sozinhos.

## Solucao: TScaledLayout (unit `FMX.Layouts`)
Envolver o conteudo num `TScaledLayout` que define o espaco logico de design uma vez:

```
object ScaledRoot: TScaledLayout
  Align = Contents
  OriginalWidth = 560.000000     // o canvas em que voce desenhou
  OriginalHeight = 900.000000
  object LytConteudo: TLayout     // todo o conteudo (ou container de rota) aqui dentro
    Align = Contents
    Size.Width = 560.000000
    Size.Height = 900.000000
  end
end
```

O `TScaledLayout` estabelece um sistema de coordenadas de `OriginalWidth x OriginalHeight`
e aplica um transform de escala = (LarguraReal/Original, AlturaReal/Original). **Todos os
descendentes** trabalham nas coordenadas do design (560x900) independentemente do `Align`,
e o conjunto inteiro (incl. fontes, com Skia fica nitido) e escalado para preencher a tela.

Vantagem: **um unico ponto** corrige todas as telas de uma vez — ideal quando ha um
container central (ex.: Router4D renderizando varias views no mesmo `TLayout`). Nao precisa
mexer no layout interno de cada tela.

## Pegadinhas
- **Todo objeto nomeado no `.fmx` precisa do campo publicado na classe** do form. Ao
  adicionar `ScaledRoot` no `.fmx`, declarar `ScaledRoot: TScaledLayout;` na classe
  (senao erro de streaming / campo orfao).
- `TScaledLayout` esta em **`FMX.Layouts`** (mesma unit de `TLayout`).
- **Distorcao de aspecto:** ele estica os dois eixos independentemente. Se o aspecto do
  device difere muito do design, circulos viram elipses. Quando design e device tem
  aspecto parecido (ex.: 560/900=0,62 vs tablet retrato 800/1280=0,625) a distorcao e
  desprezivel. Para aspecto bem diferente (ex.: 4:3), avaliar manter o conteudo num
  container de aspecto fixo centralizado, ou redesenhar responsivo (Align/GridPanelLayout).
- No **Windows/desktop** com a janela no tamanho do design (ex.: kiosk 560x900) a escala
  fica 1.0 — comportamento inalterado.

Relacionado: [dimensoes-form-mobile.md](dimensoes-form-mobile.md),
[fmx-gridpanellayout-controlcollection.md](fmx-gridpanellayout-controlcollection.md).
