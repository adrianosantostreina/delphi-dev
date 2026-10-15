# [FMX/Android 16] Tela escurecida depois de fechar o teclado (Voltar ou diálogo nativo)

## Sintoma

Depois de digitar num campo e fechar o teclado **com a tecla/gesto Voltar**, ou de
confirmar um **`TDialogService.InputQuery`** com o campo do diálogo tendo recebido foco, a
tela inteira do app fica uns 12% mais escura: o branco vira cinza (224) e a toolbar
escurece junto. O toque continua funcionando, mas o app **parece travado**. O efeito
continua depois de trocar de tela e de ir e voltar do launcher. Só some quando o teclado
abre de novo ou o app é reiniciado.

Visto no emulador Android 16 (API 36, `google_apis_playstore`), Delphi 13 FMX com Skia,
em 2026-10-05.

## O que foi descartado

- **Não é nada que o app desenha.** Não há overlay FMX, e o efeito sobrevive a abrir e
  fechar o menu lateral.
- **Não é janela de diálogo presa.** O `dumpsys window windows` não mostra janela extra
  visível. A `PopupWindow` de largura 0 que aparece é o detector de teclado do próprio FMX.
- **Não é a camada "Dim" do SurfaceFlinger.** Ela existe, mas é da System UI e está
  invisível.
- A janela do FMX é `fmt=TRANSLUCENT`, e o papel de parede é escuro. As cores batem com o
  app sendo composto a uns 88% de opacidade sobre o fundo. Isso é hipótese, não
  confirmada.

## O que funciona

- **Fechar pelo ✓ do teclado** (ação do IME) não escurece.
- **Diálogo de entrada desenhado em FMX** (fundo, cartão, `TEdit`, botões, criados em
  código sobre `Application.MainForm`) no lugar do `InputQuery` nativo: ao fechar, o `TEdit`
  é destruído, o FMX esconde o teclado por programa, e não escurece. Usar
  `KeyboardType := DecimalNumberPad` para número. Fechar o overlay com `ForceQueue`, nunca
  dentro do clique de um botão filho dele.

## Pendente

Conferir num aparelho real com Android 16. Pode ser comportamento só do emulador.
