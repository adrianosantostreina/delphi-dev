# [Android] IDE não encontra KeyTool.exe/JarSigner.exe nas configurações Java (RAD Studio 13 / 37.0)

## Sintoma
No RAD Studio, ao compilar/assinar Android, a IDE reclama que não encontra `KeyTool.exe` (ou
`JarSigner.exe`) nas configurações de Java do SDK — geralmente visível em Tools ▸ Options ▸
Deployment ▸ SDK Manager, na seção Java do SDK Android selecionado.

## Causa raiz
O RAD Studio guarda o caminho do JDK usado para assinatura Android **por SDK cadastrado**, no
registro:

```
HKCU\Software\Embarcadero\BDS\<ver>\PlatformSDKs\<NomeDoSDK>.sdk
  JDKPath            = C:\Program Files\Eclipse Adoptium\jdk-XX.Y.Z-hotspot\
  JDKJarsignerPath   = ...\bin\JarSigner.exe
  JDKKeyToolPath     = ...\bin\KeyTool.exe
```

Distribuições de JDK que se autoatualizam (Eclipse Adoptium é o caso mais comum) trocam o nome da
pasta a cada patch (ex.: `jdk-21.0.7.6-hotspot` → `jdk-21.0.11.10-hotspot`). O instalador atualiza o
JDK no disco, mas **não avisa o RAD Studio** — o registro continua apontando pra pasta antiga, que
deixou de existir. Resultado: "não encontra KeyTool.exe", mesmo com um JDK válido instalado.
Reincide toda vez que o Adoptium atualiza de novo (sintoma recorrente, não é um bug único).

## Diagnóstico
```powershell
# 1. Ver o que está registrado por SDK (repetir para cada *.sdk sob PlatformSDKs)
Get-ItemProperty "HKCU:\Software\Embarcadero\BDS\<ver>\PlatformSDKs\<NomeDoSDK>.sdk" |
  Select-Object JDKPath,JDKJarsignerPath,JDKKeyToolPath

# 2. Conferir se o caminho registrado ainda existe
Test-Path "<JDKPath>\bin\KeyTool.exe"

# 3. Achar o JDK realmente instalado agora
Get-ChildItem "C:\Program Files\Eclipse Adoptium" -Directory
```
Se `Test-Path` no passo 2 for `False`, é isso.

## Correção
Apontar as 3 chaves para a pasta do JDK atualmente instalado, em **todas** as entradas `.sdk`
Android relevantes (normalmente existem duas: `...Android64_Xbit.sdk` e `...Android_Xbit.sdk`/32-bit
— corrigir as duas, cada uma tem sua própria cópia dessas chaves):

```powershell
$newBase = "C:\Program Files\Eclipse Adoptium\jdk-XX.Y.Z-hotspot\"
$keys = @(
  "HKCU:\Software\Embarcadero\BDS\<ver>\PlatformSDKs\<SDK64>.sdk",
  "HKCU:\Software\Embarcadero\BDS\<ver>\PlatformSDKs\<SDK32>.sdk"
)
foreach ($k in $keys) {
  Set-ItemProperty -Path $k -Name "JDKPath" -Value $newBase
  Set-ItemProperty -Path $k -Name "JDKJarsignerPath" -Value ($newBase + "bin\JarSigner.exe")
  Set-ItemProperty -Path $k -Name "JDKKeyToolPath" -Value ($newBase + "bin\KeyTool.exe")
}
```

**Alternativa via IDE** (equivalente, sem PowerShell): Tools ▸ Options ▸ Deployment ▸ SDK Manager ▸
selecionar o SDK Android ▸ campo Java ▸ apontar de novo para a pasta do JDK instalado. Repetir para
o SDK de 32 e 64 bits.

Se o RAD Studio já estava aberto durante a correção via registro, **reiniciar a IDE** (ou reabrir o
SDK Manager) para os campos refletirem o novo caminho.

## Notas
- Não é preciso reinstalar nada — o JDK novo já está no disco, só o registro da IDE ficou obsoleto.
- Mesma família de sintoma do [android-deploy-e8712-buildtools.md](android-deploy-e8712-buildtools.md)
  (SDK Android com caminho de ferramenta ausente/obsoleto no registro), mas essa é especificamente
  sobre o **JDK** (assinatura), não sobre `build-tools` (empacotamento/aapt2/zipalign/apksigner).
- Ver também [[project_g2_android_signing]] (projeto G2/Guto) para o outro lado do assunto:
  configuração de keystore/alias — problema diferente, mesma área (assinatura Android).
