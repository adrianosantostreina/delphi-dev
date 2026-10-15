# Router4D: UnRender da tela atual dispara em navegacao para OUTRO container; Render<T> exige rota registrada

**[FMX]** Router4D (boss4delphi). Delphi 13, validado 2026-10-01.

## 1. `Link.To(path, container)` chama `UnRender` da tela atual do container PRINCIPAL

Padrao comum no form hospedeiro:

```pascal
TRouter4D.Render<TViewSplash>.SetElement(LytMain, LytMain);  // tela inicial
TRouter4D.Link.&To(C_ViewMenu, LytMenu);                      // drawer em outro container
```

O segundo `Link.To` renderiza o menu em `LytMenu`, mas o Router4D chama
`InstanteObject.UnRender` -- o `UnRender` da tela inicial (splash), **no mesmo
milissegundo do Render dela**, sem tira-la da tela.

Sintoma real: splash com `TTimer` ligado no `Render` e desligado no `UnRender`
ficava parado para sempre (sem erro, sem log). Achado instrumentando com log no
`Render`/`UnRender`/`OnTimer`.

**Regra:** na tela inicial (e em qualquer tela que coexista com um `Link.To`
para outro container), nao pare timers/animacoes nem libere estado no
`UnRender`. Deixe o proprio evento desligar o que ligou.

## 2. `Render<T>` precisa da classe registrada

`TRouter4D.Render<TViewX>` resolve a classe pelo registro do Router4D. Tela nova
usada so como inicial, sem `TRouter4D.Switch.Router('ViewX', TViewX)`, compila
limpo e quebra na abertura com:

`EClassNotFound: Class TViewX not found`

Registrar junto das outras rotas resolve.

## Relacionado
- [router4delphi-has-fmx-define.md](router4delphi-has-fmx-define.md)
- [router4delphi-animation-hook-sksvg.md](router4delphi-animation-hook-sksvg.md)
- [fmx-frames-clone-render-streaming.md](fmx-frames-clone-render-streaming.md) -- Render<> nao dispara OnShow
