# FMX Android: projeto antigo (Delphi 10.x/11/12) não gera APK no Delphi 13 — os 5 tropeços em ordem

Projeto FMX que compila Win32 e até Android64 (`/t:Build` gera o `.so`), mas o APK não sai. Os erros
aparecem **um de cada vez**, cada um escondendo o seguinte. Em ordem:

| # | Erro | Causa | Correção |
|---|---|---|---|
| 1 | `MSB4057: The target "Deploy" does not exist in the project` | não existe `<Projeto>.deployproj` (a IDE gera ao abrir; nunca foi versionado) | abrir na IDE uma vez **ou** montar a partir de um projeto que gera APK: copiar o `ItemGroup` do `Android64`, trocar o nome do projeto, tirar os arquivos próprios do outro app (imagens, `.db`, `config.ini`) |
| 2 | `E8712 ... android:exported needs to be explicitly specified for element <activity#...FMXNativeActivity>` | `AndroidManifest.template.xml` anterior ao Android 12 | acrescentar `android:exported="true"` na `<activity>` da `FMXNativeActivity`; aproveitar e usar `configChanges="orientation|keyboard|keyboardHidden|screenSize|screenLayout|uiMode"` do template novo |
| 3 | `E7688 ... NoSuchFileException ... annotation-1.2.0.dex.jar` (dezenas) | `<EnabledSysJars>` do `.dproj` lista JARs de outra versão | ver [android-e7688-enabledsysjars-desync.md](android-e7688-enabledsysjars-desync.md); copiar a lista de um projeto que já gera APK no 13 |
| 4 | `E8712 Error: Exception while merging manifests` / `Error parsing ...AndroidManifest.xml` | atributo **duplicado** na `<application>` (ex.: `usesCleartextTraffic` vindo do template E das opções do projeto) | validar o manifest gerado: `python -c "import xml.dom.minidom;xml.dom.minidom.parse('Android64/Debug/<P>/AndroidManifest.xml')"` aponta a linha |
| 5 | `E8200 ... resource xml/provider_paths ... not found` | `<EL_SecureFileSharing>true</EL_SecureFileSharing>` (Entitlement "Secure File Sharing") sem o `provider_paths.xml` no deploy | se o app não compartilha arquivo, desligar (`false`); senão, incluir o arquivo no deploy (classe `AndroidFileProvider`) |

Comando de build que gera o APK (depois do `rsvars.bat` do 37.0):

```bat
msbuild Projeto.dproj /t:Build;Deploy /p:Config=Debug /p:Platform=Android64 /p:DCC_ForceExecute=true ^
  /p:DCC_DebugInformation=0 /p:DCC_LocalDebugSymbols=false /p:DCC_SymbolReferenceInfo=0
```

Saída: `Android64\Debug\<Projeto>\bin\<Projeto>.apk`.

## E depois de instalar

- **HTTP para servidor da LAN**: `targetSdk` ≥ 28 bloqueia HTTP em claro — `android:usesCleartextTraffic="true"`
  na `<application>` (uma vez só, ver item 4).
- **Topo por baixo da barra de status**: ver [fmx-android-edge-to-edge-safe-area.md](fmx-android-edge-to-edge-safe-area.md).
- **Retângulos que somem**: ver [fmx-clipparent-retangulo-some-android.md](fmx-clipparent-retangulo-some-android.md).
- **Números com ponto (`R$ 27.45`)**: o emulador vem em inglês; fixar `FormatSettings := TFormatSettings.Create('pt-BR')`
  no início se o app é só para o Brasil.

Visto em: 3 apps FMX do curso Comanda Eletrônica (vindos do Delphi 11/12) no Delphi 13, 2026-10-06.
