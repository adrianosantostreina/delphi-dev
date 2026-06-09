# [FMX/Mobile] TVertScrollBox: dilema scroll-vs-toque (HitTest) e como resolver

## O problema
Em um `TVertScrollBox` com itens (cards), há um dilema clássico no mobile:

- Para **rolar** arrastando sobre o conteúdo, o press precisa chegar ao scrollbox →
  os filhos sob o dedo precisam de `HitTest = False` (senão capturam o gesto e a
  rolagem só funciona "na lateral", onde não há filho).
- Mas para **tocar** num card / ♥ / botão `+`, esses controles precisam de
  `HitTest = True` (senão `OnClick`/`OnTap` não recebem o toque).

Ou seja: `HitTest=False` rola mas não clica; `HitTest=True` clica mas bloqueia a rolagem.

Agravante (ver [onclick-vs-ontap-mobile.md](onclick-vs-ontap-mobile.md)): no **iOS**,
`OnClick` de `TShape`/`TRectangle`/`TPath`/`TCircle`/`TLayout` **não dispara** (o toque
vira `OnTap`). Então botões "desenhados" com esses tipos ficam mortos no iOS mesmo com
`HitTest=True`.

## Solução A — lista que só precisa rolar (sem toque no item inteiro)
Itens com botões pequenos internos (ex.: carrinho com stepper/lixeira, desejos com ♥ e
"mover"). Deixe o **retângulo do item `HitTest=False`** (arrasto passa pro scrollbox →
rolagem nativa funciona em cima do item) e mantenha **só os botões internos
`HitTest=True`**. Decorativos (imagem, labels) já são `HitTest=False`/irrelevantes.

```pascal
LCard.HitTest := False;          // arrasto rola; nao intercepta
// botoes internos: HitTest := True + OnTap (ver Solucao C)
```

## Solução B — quero rolar arrastando em QUALQUER lugar do card E tocar o card p/ abrir
Controle o gesto manualmente no próprio card (`HitTest=True`, `AutoCapture=True` para
receber todos os `MouseMove` durante o arrasto). Arrastar move o `ViewportPosition`;
soltar com deslocamento pequeno = toque → ação.

```pascal
// no setup do card:
LCard.HitTest := True;
LCard.AutoCapture := True;        // garante MouseMove durante o arrasto
LCard.OnMouseDown := OnCardMouseDown;
LCard.OnMouseMove := OnCardMouseMove;
LCard.OnMouseUp   := OnCardMouseUp;
// imagem/labels do card: HitTest := False (gesto cai no card)
// botoes ♥/+ : HitTest := True (recebem o toque proprio)

procedure OnCardMouseDown(Sender; Button; Shift; X, Y: Single);
begin
  FDrag := True; FMoved := 0;
  FStartAbsY := TControl(Sender).LocalToAbsolute(PointF(X, Y)).Y;  // coord de tela: estavel
  FStartVP := sb.ViewportPosition.Y;
end;
procedure OnCardMouseMove(Sender; Shift; X, Y: Single);
var d: Single;
begin
  if not FDrag then Exit;
  d := TControl(Sender).LocalToAbsolute(PointF(X, Y)).Y - FStartAbsY;
  if Abs(d) > FMoved then FMoved := Abs(d);
  sb.ViewportPosition := PointF(sb.ViewportPosition.X, FStartVP - d);
end;
procedure OnCardMouseUp(Sender; Button; Shift; X, Y: Single);
begin
  FDrag := False;
  if FMoved < 10 then    // foi toque, nao arrasto
    AbrirDetalhe(TControl(Sender).Tag);
end;
```
Use **coordenada de tela** (`LocalToAbsolute`) no cálculo do delta — a coordenada local
muda enquanto o conteúdo rola sob o dedo.

## Solução C — botões "desenhados" que funcionam em iOS e Android
Para ♥/+/CTAs feitos de shape: dispare no `OnMouseUp` (funciona nos dois SOs), **ou**
ligue `OnTap` além de `OnClick`. Um helper genérico que percorre a árvore e liga
`OnTap`→`OnClick` em todo controle com `OnClick`:

```pascal
TControl(C).OnTap := Bridge.DoTap;   // DoTap chama TControl(Sender).OnClick(Sender)
```
Chame esse helper no fim do `Render`/`FormShow` de cada tela (e sobre clones criados em
runtime). Em iOS só o `OnTap` dispara (sem duplo); em Android pode haver `OnClick`+`OnTap`
— se o duplo-disparo for problema (ex.: "+1" no carrinho), prefira `OnMouseUp` único.

## Resumo da escolha
- Item só rola → **Solução A** (item `HitTest=False`, botões `True`).
- Rolar em qualquer ponto do card **e** tocar o card → **Solução B** (gesto manual).
- Qualquer botão de shape no iOS → **Solução C** (`OnTap`/`OnMouseUp`).
