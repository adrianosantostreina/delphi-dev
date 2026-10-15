# [FMX] Fontes customizadas + ícones SVG via Skia (cross-platform Win/Android)

Com **Skia habilitado** (`<Skia>true</Skia>` no `.dproj` + `GlobalUseSkia := True` no `.dpr`
antes de `Application.Initialize`), dá para usar **fontes customizadas** e **ícones SVG
monocromáticos** de forma idêntica em Windows e Android, sem GDI/`AddFontResourceEx`
nem assets de imagem por densidade.

## Fonte customizada (ex.: Nunito) via TSkDefaultProviders

`TSkDefaultProviders.RegisterTypeface` (unit **`FMX.Skia`**, não `System.Skia`) registra
a família para todo o app. Aceita caminho de arquivo **ou** `TStream`.

```pascal
uses System.IOUtils, FMX.Skia;

procedure RegistrarFontes;
var LCaminho: string;
begin
  {$IFDEF ANDROID}
  LCaminho := TPath.Combine(TPath.GetDocumentsPath, 'Nunito.ttf');
  {$ELSE}
  LCaminho := TPath.Combine(ExtractFilePath(ParamStr(0)), 'Nunito.ttf');
  {$ENDIF}
  if TFile.Exists(LCaminho) then
    TSkDefaultProviders.RegisterTypeface(LCaminho); // fallback grácil se não existir
end;
```

Chamar no `.dpr`, **antes** de criar forms:
```pascal
GlobalUseSkia := True;   // FMX.Skia — canvas + provedor de fontes Skia
RegistrarFontes;
Application.Initialize;
```

Depois é só `Font.Family := 'Nunito'` (e remover `Family` de `StyledSettings`):
```pascal
if Supports(AControl, ITextSettings, LTS) then
begin
  LTS.TextSettings.Font.Family := 'Nunito';
  LTS.StyledSettings := LTS.StyledSettings - [TStyledSetting.Family];
end;
```

**Deploy da fonte:**
- **Win32:** o build CLI não copia nada — copiar o `.ttf` para junto do `.exe` (ex.: no `.bat`).
- **Android:** deployar o `.ttf` em `assets\internal\` (Project > Deployment, RemoteDir
  `.\assets\internal\`); `System.StartUpCopy` copia para `TPath.GetDocumentsPath` no 1º start.
- **Fonte variável** (`Nunito[wght].ttf`): funciona; o Skia seleciona o peso por
  `TFontStyle.fsBold` via as instâncias nomeadas embutidas.

## Ícones SVG (Lucide) via TSkSvg + OverrideColor

SVGs monocromáticos (Lucide usa `stroke="currentColor"`, `fill="none"`) embutidos como
**string** numa unit (sem deploy de arquivo, igual em todas as plataformas). `TSkSvg`
(unit `FMX.Skia`); a cor é trocada por `Svg.OverrideColor`.

```pascal
uses FMX.Skia;

LSvg := TSkSvg.Create(AParent);
LSvg.Parent := AParent;
LSvg.Width := 28; LSvg.Height := 28;
LSvg.HitTest := False;                 // ícone decorativo não rouba o clique
LSvg.Svg.Source := '<svg ...>...</svg>';
LSvg.Svg.OverrideColor := TAlphaColors.White; // pinta o traço
LSvg.Svg.WrapMode := TSkSvgWrapMode.Fit;
```

Para colorir um ícone sobre um botão/círculo: criar o `TSkSvg` como filho com
`Align := TAlignLayout.Center` e `HitTest := False`.

## Pegadinhas

- `TSkDefaultProviders`, `TSkSvg`, `TSkSvgWrapMode`, `GlobalUseSkia` estão em **`FMX.Skia`**
  (não `System.Skia`). `RegisterTypeface` aparece como de `System.Skia` por transitividade,
  mas linkar `FMX.Skia` é o que garante.
- **Win32:** `sk4d.dll` não é copiado pelo build CLI — copiar de `...\Studio\XX.0\bin\sk4d.dll`
  para a saída (ver [[fmx-skia-tsksvg-stylebook]]).
- **Android:** `<Skia>true</Skia>` embute `libsk4d.so` automaticamente; nada a copiar.
- `TSkSvgWrapMode` desta versão (RAD 23.0): `Default, Fit, FitCrop, Original, OriginalCenter,
  Place, Stretch, Tile`.

Relacionado: [[fmx-skia-tsksvg-stylebook]], [[cores-argb]], [[deployment-arquivos-extras]].
