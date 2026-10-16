---
name: delphi-fmx
description: >
  Especialista em FireMonkey (FMX) e desenvolvimento mobile Delphi.
  Auto-ativa quando detectar: arquivos .fmx, menções a FireMonkey, Android, iOS,
  mobile, FMX, TForm (em contexto FMX), TFrame (FMX), TLabel/TButton (FMX),
  TListView, TScrollBox, TTabControl, StyleBook, Skia, ou imports FMX.* no código.
---

# Delphi FMX

> **Notação `kb:`** — `kb:core/arquivo.md` é um arquivo da base de conhecimento. Leia com `kb_get`
> (MCP `delphi-dev-kb`); sem ele, leia o arquivo direto: `core/arquivo.md` em
> `~/.delphi-dev/kb-cache/current/` e, se não estiver lá, em `knowledge/` na raiz do plugin
> (a pasta ao lado de `skills/`; `~/.delphi-dev/plugin/knowledge/` so existe se o plugin foi instalado com `npx delphi-dev --target codex|opencode`).

## Idioma de saída
Detecte o idioma da primeira mensagem. Padrão: pt-BR. Respeite overrides explícitos.

## Regra antes de qualquer build mobile

**OBRIGATÓRIO:** Consultar `kb:fmx/INDEX.md` e verificar:
1. `kb:core/delphi-android-ios-versions.md` — versão do Delphi × API Android × exigência da loja
2. `kb:fmx/unit-naming-android.md` — unidades Android não podem ter pontos no nome
3. `kb:fmx/dimensoes-form-mobile.md` — todo form mobile: ClientWidth=400, ClientHeight=750

## Base de conhecimento FMX

Carregar sob demanda conforme o tema (índice completo em `kb:fmx/INDEX.md`):

- **Cores:** `kb:fmx/cores-argb.md`
- **Uses:** `kb:fmx/uses-fmx-components.md` — consultar ANTES de escrever uses
- **Drivers FireDAC:** `kb:core/firedac-registro-drivers.md`
- **Deployment de assets:** `kb:fmx/deployment-arquivos-extras.md`
- **Inherited forms:** `kb:fmx/inherited-forms.md`
- **Campos órfãos:** `kb:fmx/campos-orfaos-fmx.md`
- **OnClick vs OnTap:** `kb:fmx/onclick-vs-ontap-mobile.md`
- **IMEI/DeviceID:** `kb:fmx/imei-device.md`
- **SSL Android:** `kb:fmx/ssl-tls-android.md`
- **Listas/Grids/Scroll:** `fmx-lista-dinamica-ordem-align-top.md`, `fmx-stringgrid-colunas.md`, `fmx-scrollbox-scroll-vs-toque.md`
- **Modais/Frames:** `fmx-modalresult-close.md`, `fmx-showmodal-callback-cafree.md`, `fmx-frames-clone-render-streaming.md`
- **StyleBook/Skia:** `fmx-stylebook-form-separado.md`, `fmx-skia-tsksvg-stylebook.md`

## Padrões FMX obrigatórios

- Form mobile: `ClientWidth = 400`, `ClientHeight = 750`
- Nome da unit Android: sem pontos (`TelaLogin` não `Tela.Login`)
- Cores no designer: `#FFxxxxxx` | no código: `$FFxxxxxx` | alpha sempre `FF`
- Registrar driver FireDAC explicitamente no DataModule (ver `firedac-registro-drivers.md`)
- Usar `OnTap` além de `OnClick` em TShape/TRectangle para iOS
