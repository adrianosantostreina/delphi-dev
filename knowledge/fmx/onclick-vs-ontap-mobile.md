# [FMX/Mobile] `OnClick` de TShape/TRectangle não dispara no iOS — usar `OnTap`

## Sintoma

Um `TRectangle` (ou outro `TShape` puro: `TCircle`, `TPath`, etc.) usado como
botão custom, com `HitTest := True` e `OnClick := Handler`, **renderiza
normalmente mas o toque não dispara o `OnClick` no iOS**. No Android e no
desktop o mesmo código funciona (o FMX sintetiza `OnClick` a partir do toque
para shapes nessas plataformas; no iOS não).

Resultado típico: tela aparece, usuário toca, "nada acontece", nenhum log do
handler, app parece travado quando na verdade o callback nunca foi invocado.

## Causa

No FMX iOS o input de toque é entregue como **gesto** → evento `OnTap`
(`TGestureEvent = procedure(Sender: TObject; const Point: TPointF) of object`).
Controles estilizados (`TButton`, `TSpeedButton`) traduzem isso para `OnClick`
internamente; **shapes puros não**. Logo `OnClick` de `TRectangle` é não
confiável em mobile/iOS.

## Correção

Atribuir **`OnTap` além de (ou no lugar de) `OnClick`**:

```pascal
procedure TForm1.RectTap(Sender: TObject; const Point: TPointF);
begin
  // mesma lógica do OnClick
end;

MeuRetangulo.HitTest := True;
MeuRetangulo.OnClick := RectClick;   // mantém p/ Android/desktop
MeuRetangulo.OnTap   := RectTap;     // necessário p/ iOS
```

Manter os dois é seguro **se o handler for idempotente** (no Android os dois
podem disparar). Padrão idempotente comum: anular o `TagObject`/estado no
início do handler e sair cedo na 2ª entrada (`if not (Sender ... is X) then
Exit;`).

Alternativa: usar `TButton` com `StyleLookup`/pintura custom em vez de
`TRectangle` — `TButton.OnClick` funciona no iOS.

## Caso real

`MultiDialog4FMX` (módulo Boss): botões **coloridos** eram `TRectangle` só com
`OnClick := ButtonClick`; no iOS o "Sim"/"Não" não disparava o callback e todo
o fluxo subsequente (ex.: sincronismo) nunca iniciava. Botões sem cor já
usavam `TButton`+`OnTap` e funcionavam. Fix: adicionar `OnTap` aos
`TRectangle`, roteando para o mesmo `ButtonClick` (idempotente).
