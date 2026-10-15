# Delphi FMX Knowledge Base

Conhecimentos específicos do FireMonkey (FMX) e desenvolvimento mobile Android/iOS.
Conhecimento geral de Delphi fica em [`../core/INDEX.md`](../core/INDEX.md).

## Consultar ANTES de qualquer build mobile
- [../core/delphi-android-ios-versions.md](../core/delphi-android-ios-versions.md) — Tabela Delphi × SDK × exigências das lojas
- [unit-naming-android.md](unit-naming-android.md) — Sem pontos no nome da unit Android
- [dimensoes-form-mobile.md](dimensoes-form-mobile.md) — ClientWidth=400, ClientHeight=750

## UI e Designer
- [cores-argb.md](cores-argb.md) — Notação `#FFxxxxxx` no designer e `$FFxxxxxx` no código
- [inherited-forms.md](inherited-forms.md) — Forms herdados, bug de event handlers
- [campos-orfaos-fmx.md](campos-orfaos-fmx.md) — Diálogo "Field X does not have a component"
- [fmx-stylebook-form-separado.md](fmx-stylebook-form-separado.md) — StyleBook em form separado
- [fmx-skia-tsksvg-stylebook.md](fmx-skia-tsksvg-stylebook.md) — Skia: TSkSvg + StyleBook

## Listas, Grids e Scroll
- [fmx-lista-dinamica-ordem-align-top.md](fmx-lista-dinamica-ordem-align-top.md) — Lista dinâmica: ordem com Align=Top
- [fmx-stringgrid-colunas.md](fmx-stringgrid-colunas.md) — Colunas de TStringGrid no FMX
- [fmx-scrollbox-scroll-vs-toque.md](fmx-scrollbox-scroll-vs-toque.md) — TScrollBox: scroll vs toque

## Forms, Modais e Frames
- [fmx-modalresult-close.md](fmx-modalresult-close.md) — ModalResult e Close em FMX
- [fmx-showmodal-callback-cafree.md](fmx-showmodal-callback-cafree.md) — ShowModal com callback + caFree
- [fmx-frames-clone-render-streaming.md](fmx-frames-clone-render-streaming.md) — Frames: clone, render e streaming

## Android / iOS
- [onclick-vs-ontap-mobile.md](onclick-vs-ontap-mobile.md) — OnClick vs OnTap no iOS
- [imei-device.md](imei-device.md) — Identificador único do dispositivo
- [ssl-tls-android.md](ssl-tls-android.md) — Trust anchor error, network_security_config.xml

## Build e Deployment
- [deployment-arquivos-extras.md](deployment-arquivos-extras.md) — Deployment de assets no APK/IPA
- [android-deploy-e8712-buildtools.md](android-deploy-e8712-buildtools.md) — Erro E8712 / Android build-tools no deploy

## Windows Desktop
- [fmx-automacao-windows-sem-foco.md](fmx-automacao-windows-sem-foco.md) — Dirigir um app FMX no Windows sem roubar foco nem mexer no cursor: `PostMessage` (clique), `WM_CHAR` (texto, imune a acento morto ABNT), `PrintWindow` flag 2 (captura mesmo coberta). Cinco armadilhas: `MainWindowHandle` devolve a fantasma `TFMAppClass`; escolher a `FMT*` visível de maior área (só "maior área" traz órfã e a captura sai preta); restaurar ANTES de escolher; `SW_SHOWNOACTIVATE` para app minimizado; recortar na área de cliente para as coordenadas baterem 1:1

## Uses e Componentes
- [uses-fmx-components.md](uses-fmx-components.md) — Tabela tipo → unit FMX/FireDAC/RTL

## Breaking changes
- [delphi13-breaking-changes.md](delphi13-breaking-changes.md) — Quebras Delphi 12→13

## Importados via /sync-kb
- [dfm-fmx-sem-bom.md](dfm-fmx-sem-bom.md) — `.dfm`/`.fmx` com BOM UTF-8 → `Invalid stream format`
- [firedac-sqlite-mobile-beforeconnect.md](firedac-sqlite-mobile-beforeconnect.md) — [FMX/Mobile] FireDAC + SQLite no Android/iOS — caminho do banco no BeforeConnect e OpenMode
- [fmx-android-edge-to-edge-safe-area.md](fmx-android-edge-to-edge-safe-area.md) — FMX — Edge-to-edge e safe-area (status bar / notch) em Android 15+ e iOS
- [fmx-android-migrar-projeto-antigo-delphi13.md](fmx-android-migrar-projeto-antigo-delphi13.md) — FMX Android: projeto antigo (Delphi 10.x/11/12) não gera APK no Delphi 13 — os 5 tropeços em ordem
- [fmx-android-navegar-no-clique-toque-perdido.md](fmx-android-navegar-no-clique-toque-perdido.md) — [FMX/Android] Trocar de tela dentro do OnClick: o próximo toque se perde
- [fmx-android-rest-sincrono-anr.md](fmx-android-rest-sincrono-anr.md) — [Android] REST síncrono na main thread → "app não está respondendo" (ANR)
- [fmx-android-taborder-em-shape-e-largura-scrollbox.md](fmx-android-taborder-em-shape-e-largura-scrollbox.md) — [FMX/Android] TabOrder em TRectangle quebra a tela; TVertScrollBox.Content mede ~50 antes do realinhamento
- [fmx-android16-teclado-voltar-escurece-tela.md](fmx-android16-teclado-voltar-escurece-tela.md) — [FMX/Android 16] Tela escurecida depois de fechar o teclado (Voltar ou diálogo nativo)
- [fmx-camera-lifecycle-scanner.md](fmx-camera-lifecycle-scanner.md) — [FMX/Android] Ciclo de vida da câmera (TCameraComponent) e scanner de código de barras
- [fmx-clipparent-retangulo-some-android.md](fmx-clipparent-retangulo-some-android.md) — FMX: `TRectangle` com `ClipParent = True` pinta no Windows e some no Android
- [fmx-defeitos-que-so-aparecem-rodando.md](fmx-defeitos-que-so-aparecem-rodando.md) — [FMX] Quatro defeitos que compilam, passam no teste e so aparecem rodando o app
- [fmx-dialogo-acao-no-callback-forcequeue.md](fmx-dialogo-acao-no-callback-forcequeue.md) — [FMX] Ação no callback de um diálogo: adiar com `TThread.ForceQueue`
- [fmx-eventos-disparam-em-atribuicao.md](fmx-eventos-disparam-em-atribuicao.md) — [FMX] Eventos de "mudança" disparam em atribuição por código, não só na interação
- [fmx-flowlayout-posicao-diverge-versoes.md](fmx-flowlayout-posicao-diverge-versoes.md) — TFlowLayout pinta filhos em posição diferente da reportada (Delphi ≤ 10.4 vs 12+)
- [fmx-gridpanellayout-controlcollection.md](fmx-gridpanellayout-controlcollection.md) — [FMX] TGridPanelLayout exige ControlCollection explícita no .fmx
- [fmx-progresso-sync-por-registro-anr.md](fmx-progresso-sync-por-registro-anr.md) — [FMX/Android] `TThread.Synchronize` por registro em loop de worker = ANR
- [fmx-propriedade-nao-publicada-streaming.md](fmx-propriedade-nao-publicada-streaming.md) — [FMX] Propriedade não publicada no `.fmx` quebra o form inteiro em runtime
- [fmx-scaledlayout-design-fixo-tablet.md](fmx-scaledlayout-design-fixo-tablet.md) — [FMX/Mobile] TScaledLayout — design em tamanho fixo que escala para o device
- [fmx-skia-android-fonte-monoespacada.md](fmx-skia-android-fonte-monoespacada.md) — [FMX] Fonte de largura fixa no Android (Skia) — e por que os valores "somem"
- [fmx-skia-fontes-customizadas-svg-icones.md](fmx-skia-fontes-customizadas-svg-icones.md) — [FMX] Fontes customizadas + ícones SVG via Skia (cross-platform Win/Android)
- [fmx-stylebook-resourcesbin-versao.md](fmx-stylebook-resourcesbin-versao.md) — [FMX] StyleBook `ResourcesBin` — `Property X does not exist` ao abrir form em IDE mais antiga
- [fmx-svg-pathdata-numeros-colados.md](fmx-svg-pathdata-numeros-colados.md) — `TPathData.Data` lança EConvertError com números decimais colados sem separador no path SVG
- [fmx-tform-para-tframe-lista-dinamica.md](fmx-tform-para-tframe-lista-dinamica.md) — FMX: item de lista dinâmica como TForm é lento — trocar por TFrame + TVertScrollBox
- [fmx-tmultiview-parent-desanexa.md](fmx-tmultiview-parent-desanexa.md) — FMX: TMultiView.Parent muda sozinho, BringToFront vira no-op silencioso
- [fmx-ui-fora-main-thread-windows-passa-android-av.md](fmx-ui-fora-main-thread-windows-passa-android-av.md) — FMX: tela montada dentro de thread "funciona" no Windows e dá Access Violation no Android
- [fmx-win32-janela-automacao-externa.md](fmx-win32-janela-automacao-externa.md) — [FMX/Windows] Automatizar/inspecionar um app FMX Win32 de fora do processo
- [rodar-app-mobile-no-desktop.md](rodar-app-mobile-no-desktop.md) — [FMX] Rodar um app mobile no Windows para testar (o que costuma impedir)
- [vcl-automacao-janela-externa.md](vcl-automacao-janela-externa.md) — [VCL/Windows] Automatizar um app VCL de fora do processo — muito mais fácil que FMX
