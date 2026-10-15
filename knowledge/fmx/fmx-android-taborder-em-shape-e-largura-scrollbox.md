# [FMX/Android] TabOrder em TRectangle quebra a tela; TVertScrollBox.Content mede ~50 antes do realinhamento

Validado 2026-10-01 (Delphi 13, Android64). Os dois funcionam no Windows e só aparecem no Android.

## 1. `TabOrder` gravado num `TRectangle` (ou outro shape) no .fmx
Ao criar a tela: `Error reading recPapel.TabOrder: Property TabOrder does not exist`. No Windows a
tela abre. Labels com `TabOrder` não têm problema; o shape tem. Remova a linha do .fmx (varra
todos os .fmx: objeto `TRectangle/TCircle/TLine/TRoundRect/TEllipse/TPath` com `TabOrder`).
Cuidado extra: se a navegação para essa tela estiver no mesmo `try` de uma operação que já foi
concluída (ex.: envio de pedido), a mensagem de erro mente ("não foi possível enviar"). Dê à
navegação um `try` próprio.

## 2. Largura de cards criados manualmente numa `TVertScrollBox`
Na hora em que a tela monta a lista (no `Render`, antes do primeiro realinhamento), no Android:
`ScrollBox.Width` já é a largura real do aparelho (ex.: 411,4), mas o conteúdo interno
(`ParentControl` do card) mede ~50. Consequências medidas:
- `Anchors := [akLeft, akTop, akRight]` mede a partir do 50 e **estica** os cards da 1ª página
  além dos criados depois (página 2): larguras diferentes na mesma lista.
- Calcular a largura pelo `ParentControl.Width` dá card com largura negativa ou quase zero.
O que funciona: `Width := ScrollBox.Width - margens`, sem âncora. Limitação: não acompanha a
rotação de tela. Para isso, refaça as larguras no `OnResized` da ScrollBox.

## Relacionado
- [fmx-tform-para-tframe-lista-dinamica.md](fmx-tform-para-tframe-lista-dinamica.md)
- [android-emulador-x86-traducao-arm.md](android-emulador-x86-traducao-arm.md)
