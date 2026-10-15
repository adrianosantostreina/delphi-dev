# TFlowLayout pinta filhos em posição diferente da reportada (Delphi ≤ 10.4 vs 12+)

## Sintoma

Um `TFlowLayout` criado **em runtime** (`TFlowLayout.Create` + filhos com `Align := TAlignLayout.None`
implícito via fluxo, ou filhos adicionados via `Parent :=`) renderiza os filhos **visualmente
deslocados** (tipicamente para baixo, ultrapassando os limites do container pai) em **Delphi
10.3.3 Rio (CompilerVersion 33.0)** — mas o mesmo código renderiza corretamente em **Delphi 12.x
Athens (CV 36.0)**.

A armadilha: `Control.Position`, `Control.Height` e até `Control.AbsoluteRect` (medidos tanto na
construção quanto depois, em runtime, ex. no `OnClick` de um filho) **reportam coordenadas
consistentes e dentro dos limites do pai** — a divergência só aparece no *pixel pintado na tela*,
não em nenhuma propriedade consultável via código. Redimensionar a janela/form **não corrige**
(descarta a hipótese de realign pendente).

Exemplo real: uma `TRectangle` (caixa de diálogo) com um `TFlowLayout` (`Align := Bottom`,
`Justify/JustifyLastLine := Center`) contendo `TButton`s de 40dp numa faixa de 56dp — no 12.3 os
botões ficam centralizados dentro da faixa; no 10.3.3 os mesmos botões aparecem **abaixo da borda
arredondada** do container, como se o `TFlowLayout` os pintasse ancorados no fundo do seu próprio
espaço (ou além dele), apesar de `AbsoluteRect` afirmar que estão dentro.

## Causa

Não confirmada a fundo no código-fonte do `FMX.Layouts` (não foi rastreada até o `Paint`/`DoRealign`
interno). O que foi **confirmado empiricamente**: é uma divergência entre o algoritmo de fluxo
(`TFlowLayout`) e o pipeline de pintura entre as duas versões do FMX — a API pública de geometria
(`Position`, `AbsoluteRect`) não é uma fonte confiável de verdade sobre onde o `TFlowLayout`
realmente desenha os filhos no 10.3.3.

## Correção — não usar `TFlowLayout` para posicionamento crítico; posicionar manualmente

Trocar o `TFlowLayout` por um `TLayout` comum (`Align := TAlignLayout.Bottom` ou o que for) e
posicionar cada filho com `Align := TAlignLayout.None` + `Position.X`/`Position.Y` calculados
explicitamente a partir das larguras/gaps desejados:

```pascal
LBtnLayout := TLayout.Create(AParent);
LBtnLayout.Parent := AParent;
LBtnLayout.Align  := TAlignLayout.Bottom;
LBtnLayout.Height := C_RowHeight;

LCurX := (LUsableWidth - LRowTotalWidth) / 2;   // centralização manual
LCurY := (C_RowHeight - C_BtnHeight) / 2;        // centralização vertical manual

for I := 0 to Count - 1 do
begin
  LBtn := TButton.Create(LBtnLayout);
  LBtn.Parent     := LBtnLayout;
  LBtn.Align      := TAlignLayout.None;   // crítico: sem isso o pai pode tentar re-fluir
  LBtn.Width      := LBtnWidth;
  LBtn.Height     := C_BtnHeight;
  LBtn.Position.X := LCurX;
  LBtn.Position.Y := LCurY;
  LCurX := LCurX + LBtnWidth + C_Gap;
end;
```

Determinístico e **idêntico em qualquer versão do Delphi**, porque não depende do algoritmo de
fluxo interno — cada coordenada é calculada e atribuída explicitamente.

### Diagnóstico que levou à causa (útil para casos parecidos)

1. Medir geometria **na construção** (antes do form ficar visível) — só prova o estado inicial.
2. Medir de novo **em runtime**, num evento que só dispara depois do primeiro paint real (ex.
   `OnClick` de um filho), usando `Control.AbsoluteRect` (força cálculo absoluto, não só o
   `Position` relativo). Comparar os dois: se ambos "dizem" que está tudo dentro dos limites mas a
   tela mostra transbordamento, a fonte de verdade da geometria **não é o que o objeto reporta** —
   suspeitar do próprio algoritmo de layout/paint (não de margins/align/ordem de criação).
3. Testar a hipótese mais barata primeiro (redimensionar a janela, forçar realign) antes de assumir
   causa mais profunda — só migrar para "o layout container é a causa" depois de descartar timing.

## Notas

- `TFlowLayout.Realign` é **protected** — não dá para chamar de fora para forçar um recálculo
  como diagnóstico (`E2362 Cannot access protected symbol`). Atribuir a uma propriedade que já
  dispara realign internamente (ex. `Height`) é a alternativa para instrumentação.
- Ver também [compilerversion-tabela-condicional.md](compilerversion-tabela-condicional.md) — mas
  este bug **não é de compilação** (compila igual nas duas versões), é puramente de runtime/render,
  então não aparece em nenhuma tabela de erros de compilador.
- Vale suspeitar do mesmo padrão em outros containers de fluxo/auto-layout do FMX (`TGridPanelLayout`
  com `ControlCollection` malformado já tem armadilha própria documentada em
  [fmx-gridpanellayout-controlcollection.md](fmx-gridpanellayout-controlcollection.md); `TFlowLayout`
  parece ter uma classe de problema distinta, específica de divergência entre versões).
