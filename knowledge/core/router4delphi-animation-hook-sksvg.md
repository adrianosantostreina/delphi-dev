# Router4D: o hook `Animation` some com ícone `TSkSvg` dentro de `TButton`

## A técnica (que funciona em outros projetos)

Um único registro dá fade-in a **toda** navegação do app, sem tocar em nenhuma
view:

```pascal
TRouter4D.Link.Animation(
  procedure(AContainer: TFMXObject)
  begin
    if AContainer is TControl then
    begin
      TControl(AContainer).Opacity := 0;
      TAnimator.AnimateFloat(AContainer, 'Opacity', 1, 0.22,
        TAnimationType.Out, TInterpolationType.Cubic);
    end;
  end);
```

Restrição do Router4D que define o escopo: o `Link` **remove a tela antiga e só
então adiciona a nova**, chamando o hook com o container já contendo apenas a
tela nova. Dá para animar a **entrada**, nunca a saída — não adianta procurar
transição de "empurrar a tela para fora".

## O sintoma

Numa base cuja toolbar tem um **`TSkSvg` dentro de um `TButton`**, ligar o hook
faz o botão **sumir E parar de responder ao clique** nas telas roteadas. O ícone
não aparece e o menu simplesmente não abre. Nada no log; o build passa.

Confirmado por A/B: com a chamada, o botão some; recompilando sem ela, volta.

## Hipótese

O hook zera a `Opacity` do container **no exato instante em que a tela nova é
adicionada**, e o `TSkSvg` parece rasterizar nesse momento — guardando um raster
vazio. Num projeto onde a toolbar não usa `TSkSvg` dentro de `TButton` a mesma
técnica funciona sem ajuste.

## Solucao validada (2026-10-01, Delphi 13, Win32 + build Android64)

Os tres caminhos juntos resolvem -- icone visivel e clicavel apos navegar, e o
fade aparece (conferido capturando a tela no meio da transicao com a duracao
esticada para 2 s so para o teste):

```pascal
TRouter4D.Link.Animation(
  procedure(AContainer: TFMXObject)
  var
    LTela: TControl;
  begin
    // A tela que ENTROU e o ultimo filho (o Link acabou de adiciona-la).
    // Nunca animar o container: ele costuma hospedar tambem o drawer.
    if (AContainer = nil) or (AContainer.ChildrenCount = 0) or
       not (AContainer.Children[AContainer.ChildrenCount - 1] is TControl) then
      Exit;
    LTela := TControl(AContainer.Children[AContainer.ChildrenCount - 1]);

    // Um tick depois e partindo de 0.2 (nao 0): o Skia ja rasterizou o SVG.
    TThread.ForceQueue(nil,
      procedure
      begin
        LTela.Opacity := 0.2;
        TAnimator.AnimateFloat(LTela, 'Opacity', 1, 0.22,
          TAnimationType.Out, TInterpolationType.Cubic);
      end);
  end);
```

Nao foi isolado qual dos tres e o essencial -- aplicar os tres.

## Caminhos que estavam em aberto (historico)

- Animar um **filho** do container em vez do container.
- Começar em `Opacity := 0.01` em vez de `0`.
- Disparar o fade **um tick depois** (`TThread.ForceQueue`), para o Skia
  rasterizar antes de a opacidade cair.

## Recomendação prática

Se o app usa `TSkSvg` em botões, **não ligue o hook global sem testar a toolbar
de cada rota**. O ganho visual é pequeno perto de perder a navegação, e a falha
não aparece em build nem em log — só olhando a tela.

## Relacionado

- [router4delphi-has-fmx-define.md](router4delphi-has-fmx-define.md)
- [fmx-stylebook-form-separado.md](fmx-stylebook-form-separado.md) — conteúdo reparented e cena raiz
