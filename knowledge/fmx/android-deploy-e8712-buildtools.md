# [Android] Deploy falha com E8712 / `java.lang.IllegalArgumentException` — build-tools não amarrado ao SDK

## Sintoma
Ao fazer **Run/Deploy** para Android (a **compilação passa**, o erro é no empacotamento):

```
[PAClient Error] Error: E8712 Exception in thread "main" java.lang.IllegalArgumentException
```

A IDE abre a página genérica `deployandroidfailedhelppage.html` ("Cannot Deploy an Application for Android"), que **não** mostra a causa real.

## Causa-raiz
O RAD Studio deriva `aapt2` / `zipalign` / `apksigner` de `<SystemRoot do SDK>\build-tools\<versão>`.
Se o SDK Android **registrado** aponta `SystemRoot` para uma pasta **sem** `build-tools`
(ex.: o SDK do catálogo da Embarcadero `...\CatalogRepository\AndroidSDK-25xx...` após um
update/patch que reinstala/re-registra o SDK), a IDE chama a ferramenta Java com **caminho vazio**
→ `IllegalArgumentException`. Como a parte nativa (NDK) está completa, **compila mas não empacota**.

Frequentemente o build-tools **existe** em outro SDK na máquina (ex.: Android Studio em
`%LOCALAPPDATA%\Android\Sdk\build-tools\`), só **não está amarrado** ao SDK que a IDE usa.

## Diagnóstico rápido
1. Registro: `HKCU\Software\Embarcadero\BDS\<ver>\PlatformSDKs\<SDK>.sdk` —
   se **faltam** os valores `SDKAaptPath`, `SDKZipAlignPath`, `SDKApkSignerPath` (só tem NDK/JDK/adb/apilevel) → confirma.
2. Disco: conferir se existe `<SystemRoot>\build-tools\` (se não existe, é a causa).
3. IDE: **Tools ▸ Options ▸ Deployment ▸ SDK Manager** → SDK Android → campos
   *Build Tools / Zip align / APK signer* vazios ou em vermelho.

## Correção (qualquer uma)
- **Re-apontar** o `SystemRoot` do SDK para um que tenha `build-tools` (ex.: o do Android Studio
  `%LOCALAPPDATA%\Android\Sdk`) no SDK Manager; ou
- **Recriar/atualizar** o SDK Android pelo SDK Manager (reescreve os caminhos de aapt2/zipalign/apksigner); ou
- Instalar build-tools no SystemRoot atual via `sdkmanager "build-tools;XX.0.0"` (casar com a `platforms\android-XX` instalada) e re-detectar na IDE.

## Notas
- Erro de **ferramenta Java que executou** (IllegalArgumentException) ≠ "arquivo não encontrado";
  por isso parece misterioso — o caminho está vazio, não ausente do disco.
- Reproduzir por linha de comando (`msbuild .dproj /t:Deploy`) costuma **falhar por outro motivo**
  (`MSB6003`/`command-line too long`) quando o *Library Path global* é gigante (ACBr/TMS/etc.);
  nesses casos a reprodução fora da IDE não é confiável — diagnostique pelo registro/SDK Manager.
