# FMX — Edge-to-edge e safe-area (status bar / notch) em Android 15+ e iOS

**Sintoma.** Os controles do topo do app (botão voltar, menu, título da toolbar) aparecem
**grudados/sobrepostos à barra de status** do Android (relógio/wifi/bateria) em aparelhos
novos. Em aparelhos mais antigos o mesmo build está correto. No rodapé, botões ancorados em
`akBottom` ficam por baixo da barra de navegação por gestos.

Parece regressão de "tela nova"/resolução — **não é**. É a versão do Android.

---

## Causa raiz

Duas coisas se somam:

### 1. O Android passou a forçar edge-to-edge

| Cenário | Resultado |
|---|---|
| `targetSdkVersion` ≤ 34 | Sem edge-to-edge. O sistema recua a content view — conteúdo já nasce abaixo da status bar. |
| `targetSdkVersion` = 35, device Android 15 | Edge-to-edge **forçado**, mas dá pra optar por sair com `android:windowOptOutEdgeToEdgeEnforcement=true`. |
| `targetSdkVersion` = 36, device Android 15 | O opt-out **ainda funciona**. |
| `targetSdkVersion` = 36, device **Android 16** | O opt-out está **deprecated e desabilitado**. Não há como sair do edge-to-edge. |

> "For apps targeting Android 16 (API level 36), `R.attr#windowOptOutEdgeToEdgeEnforcement` is
> deprecated and disabled, and your app can't opt-out of going edge-to-edge."
> — [Android 16 behavior changes](https://developer.android.com/about/versions/16/behavior-changes-16)

Como o Google Play exige **API 36 a partir de 31/08/2026**, baixar o target não é saída:
todo app Delphi mobile vai passar por isso.

**O Delphi 13 (RAD Studio 37.0) já gera o opt-out sozinho** em `bin\<Projeto>\res\values-v35\styles.xml`:

```xml
<resources xmlns:android="http://schemas.android.com/apk/res/android">
    <style name="AppTheme" parent="AppTheme.Base">
        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>
    </style>
</resources>
```

Isso **mascara o problema até o Android 16** — e some quando o usuário troca de aparelho.
Esse arquivo é regenerado a cada build, então editá-lo não adianta.

### 2. O FMX reporta os insets, mas NUNCA os aplica

Confirmado lendo a RTL (Delphi 13, `source\fmx`): não existe **nenhum** ponto do FMX que
aplique `SafeAreaInsets` a layout. Ele só notifica:

- **Android** — `FormView.java` (`setOnApplyWindowInsetsListener`, `systemBars() | displayCutout()`)
  → `TAndroidWindowHandle.HandleWindowInsetChanges` → `ISafeAreaContainer.SafeAreaChanged`
- **iOS** — `TFMXViewBase.safeAreaInsetsDidChange` (`View.safeAreaInsets`) → mesma interface
- Ambos publicam também `IFMXWindowSafeAreaService.GetSafeAreaInsets`

`TCommonCustomForm` implementa `ISafeAreaContainer` e expõe **`OnSafeAreaChanged`**
(publicado em `TForm`, dá pra ligar no Designer). `TCommonCustomForm.DoShow` já faz o *pull*
inicial via `IFMXWindowSafeAreaService` e dispara o evento — ou seja, **assinar o evento
cobre tanto o valor inicial quanto as mudanças** (rotação, teclado, troca de janela).

⚠️ `TFormSystemStatusBar` (`Form.SystemStatusBar.BackgroundColor` / `.Visibility`) **não
resolve**: `IFMXWindowSystemStatusBarService` só é implementado em `FMX.Platform.iOS.pas`.
No Android a propriedade é no-op.

---

## Correção

Reservar a faixa dos insets **no form que tem o handle nativo** — em app de tela única com
roteador (Router4D e afins), é o form hospedeiro, e assim **uma correção vale para todas as
rotas**.

No `.fmx` do form principal, duas faixas com altura 0 (o `Align=Client` do conteúdo se ajusta
sozinho — não precisa mexer em `Padding`):

```dfm
object ViewMain: TViewMain
  OnSafeAreaChanged = FormSafeAreaChanged
  object RecSafeAreaTop: TRectangle
    Align = Top
    Fill.Color = xFF205B6D      // cor do topo da toolbar, pra emendar
    Size.Height = 0.000000000000000000
    Size.PlatformDefault = False
    Stroke.Kind = None
  end
  object RecSafeAreaBottom: TRectangle
    Align = Bottom
    Fill.Color = claWhite       // cor do fundo do conteúdo
    Size.Height = 0.000000000000000000
    Size.PlatformDefault = False
    Stroke.Kind = None
  end
  object LytConteudo: TLayout
    Align = Client
    ...
  end
end
```

```pascal
procedure TViewMain.FormSafeAreaChanged(Sender: TObject; const AInsets: TRectF);
begin
  RecSafeAreaTop.Height    := AInsets.Top;
  RecSafeAreaBottom.Height := AInsets.Bottom;
end;
```

### Por que isso é seguro em aparelho antigo (não dá vão duplicado)

Os insets entregues ao `FormView` são os **não-consumidos**. Em activity clássica (sem
edge-to-edge) a decor view consome os system bars antes de repassar → chegam **zerados** →
as faixas ficam com altura 0 e nada muda. Em edge-to-edge nada é consumido → chegam com o
valor real. O mesmo código se ajusta sozinho às duas situações, sem `{$IFDEF}` de versão.

### Vale igual para iOS

iPhone com notch/Dynamic Island cai no mesmo caso: o FMX desenha em tela cheia e só reporta
`safeAreaInsets`. O mesmo handler resolve as duas plataformas — não é problema
Android-específico.

---

## Como diagnosticar

1. `grep targetSdkVersion` no `.dproj` (`VerInfo_Keys`). ≥ 35 → suspeitar.
2. Conferir se existe `bin\<Projeto>\res\values-v35\styles.xml` com o opt-out — se existe, o
   bug só aparece em **Android 16**, o que explica "só no aparelho novo".
3. Logar os insets no `OnSafeAreaChanged`. `Top=0` em device novo = o evento não está ligado;
   `Top≈24..60` = edge-to-edge ativo e é preciso reservar a faixa.
4. `adb shell getprop ro.build.version.release` para saber a versão do Android do aparelho.

## O que NÃO fazer

- **Não** hardcodar a altura da status bar (varia por aparelho: furo de câmera, notch, 24 a 60dp).
- **Não** editar `bin\...\res\values-v35\styles.xml` — é regenerado a cada build.
- **Não** baixar o `targetSdkVersion` para fugir do edge-to-edge — o Google Play exige API 36
  desde 31/08/2026.
- **Não** tentar `Form.SystemStatusBar` no Android — é no-op (só iOS).
