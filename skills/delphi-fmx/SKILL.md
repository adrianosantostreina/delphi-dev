---
name: delphi-fmx
description: >
  Especialista em FireMonkey (FMX) e desenvolvimento mobile Delphi.
  Auto-ativa quando detectar: arquivos .fmx, menções a FireMonkey, Android, iOS,
  mobile, FMX, TForm (em contexto FMX), TFrame (FMX), TLabel/TButton (FMX),
  TListView, TScrollBox, TTabControl, StyleBook, Skia, ou imports FMX.* no código.
---

# Delphi FMX

## Idioma de saída
Detecte o idioma da primeira mensagem. Padrão: pt-BR. Respeite overrides explícitos.

## Regra antes de qualquer build mobile

**OBRIGATÓRIO:** Consultar `knowledge/fmx/INDEX.md` e verificar:
1. `knowledge/core/delphi-android-ios-versions.md` — versão do Delphi × API Android × exigência da loja
2. `knowledge/fmx/unit-naming-android.md` — unidades Android não podem ter pontos no nome
3. `knowledge/fmx/dimensoes-form-mobile.md` — todo form mobile: ClientWidth=400, ClientHeight=750

## Base de conhecimento FMX

Carregar sob demanda conforme o tema (índice completo em `knowledge/fmx/INDEX.md`):

- **Cores:** `knowledge/fmx/cores-argb.md`
- **Uses:** `knowledge/fmx/uses-fmx-components.md` — consultar ANTES de escrever uses
- **Drivers FireDAC:** `knowledge/core/firedac-registro-drivers.md`
- **Deployment de assets:** `knowledge/fmx/deployment-arquivos-extras.md`
- **Inherited forms:** `knowledge/fmx/inherited-forms.md`
- **Campos órfãos:** `knowledge/fmx/campos-orfaos-fmx.md`
- **OnClick vs OnTap:** `knowledge/fmx/onclick-vs-ontap-mobile.md`
- **IMEI/DeviceID:** `knowledge/fmx/imei-device.md`
- **SSL Android:** `knowledge/fmx/ssl-tls-android.md`
- **Listas/Grids/Scroll:** `fmx-lista-dinamica-ordem-align-top.md`, `fmx-stringgrid-colunas.md`, `fmx-scrollbox-scroll-vs-toque.md`
- **Modais/Frames:** `fmx-modalresult-close.md`, `fmx-showmodal-callback-cafree.md`, `fmx-frames-clone-render-streaming.md`
- **StyleBook/Skia:** `fmx-stylebook-form-separado.md`, `fmx-skia-tsksvg-stylebook.md`

## Padrões FMX obrigatórios

- Form mobile: `ClientWidth = 400`, `ClientHeight = 750`
- Nome da unit Android: sem pontos (`TelaLogin` não `Tela.Login`)
- Cores no designer: `#FFxxxxxx` | no código: `$FFxxxxxx` | alpha sempre `FF`
- Registrar driver FireDAC explicitamente no DataModule (ver `firedac-registro-drivers.md`)
- Usar `OnTap` além de `OnClick` em TShape/TRectangle para iOS
