# [Android] Deploy falha com E8712 — duas causas diferentes

> **E8712 é um código guarda-chuva.** Leia a segunda linha da mensagem antes de
> investigar: se ela diz `Exception while merging manifests` / `Error parsing
> ...\AndroidManifest.xml`, pule para a seção **"E8712 ao MESCLAR o manifest"**
> no fim deste arquivo — não tem nada a ver com build-tools.

---

## Causa 1 — `java.lang.IllegalArgumentException`: build-tools não amarrado ao SDK

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

## Variante: SDK do catálogo SEM `build-tools` após migração de versão (ex.: Delphi 12 → 13 / RAD 37.0)
Cenário real confirmado: ao migrar para **Delphi 13 (RAD Studio 37.0)**, a SDK Android registrada
(`...\Studio\37.0\CatalogRepository\AndroidSDK-37.0.xxxxx`) vem com `ndk`, `platform-tools`,
`cmdline-tools` e `platforms\android-36.1\android.jar`, **mas SEM a pasta `build-tools`** —
logo `aapt2`/`zipalign`/`apksigner` não existem em lugar nenhum (o RAD **não** os traz embutidos
no `bin`). Compila o `.so`, mas o **empacotamento** falha → página genérica "Cannot Deploy".
- Checagem rápida no disco: `Test-Path "<SystemRoot>\build-tools"` = **False** = causa.
- Bundles default do Delphi 13/37.0: NDK `27.1.12297006`, platform `android-36.1` (API 36).
- Correção Delphi-nativa (sem Android Studio): **Tools ▸ Manage Platforms ▸ Android** (reinstala/completa
  a SDK, baixando `build-tools`), ou o SDK Manager. Alternativa: apontar `SystemRoot` para uma SDK que
  já tenha `build-tools` (ex.: a do Android Studio em `%LOCALAPPDATA%\Android\Sdk\build-tools`).

## Pegadinha relacionada: deploy quebra ANTES do empacotamento por arquivo inexistente no `.deployproj`
A fase de **cópia de arquivos do deploy** acontece **antes** do empacotamento. Se o `.dproj`
(`<Deployment>`) / `.deployproj` listar um `DeployFile` cujo arquivo local **não existe mais**
(ex.: imagens renomeadas/removidas num refactor mas as entradas de deploy ficaram para trás),
o deploy aborta com `Required local file "<x>" not found. Deployment failed.` — também caindo na
mesma página genérica. Como o `.deployproj` é **gerado** a partir do `<Deployment>` do `.dproj`,
limpar só o `.deployproj` não resolve (a IDE regenera): **remover as entradas órfãs do `.dproj`**.
Diagnóstico programático: parsear o `.deployproj` como XML, expandir `$(BDS)`/`$(ProjectName)`/`$(Platform)`
e `Test-Path` cada `DeployFile Include`.

## Notas
- Erro de **ferramenta Java que executou** (IllegalArgumentException) ≠ "arquivo não encontrado";
  por isso parece misterioso — o caminho está vazio, não ausente do disco.
- Reproduzir por linha de comando (`msbuild .dproj /t:Deploy`) costuma **falhar por outro motivo**
  (`MSB6003`/`command-line too long`) quando o *Library Path global* é gigante (ACBr/TMS/etc.);
  nesses casos a reprodução fora da IDE não é confiável — diagnostique pelo registro/SDK Manager.

---

## Causa 2 — E8712 ao MESCLAR o manifest: `--` dentro de comentário XML

### Sintoma

```
[PAClient Error] Error: E8712 Error: Exception while merging manifests
[PAClient Error] Error: E8712 Error: Error parsing <projeto>\Android64\Debug\<App>\AndroidManifest.xml
```

A **compilação passa** e o erro só aparece no Deploy. Diferente da Causa 1, aqui a
mensagem cita explicitamente *merging manifests* e um caminho de `AndroidManifest.xml`.

### Causa-raiz

`AndroidManifest.template.xml` com XML malformado. O caso mais fácil de cair:

**XML proíbe a sequência de dois hifens dentro de um comentário.** Escrever um travessão
duplo num comentário do template gera manifest inválido:

```xml
<!-- ...falha com "Cleartext HTTP traffic not permitted" -- e no desktop funciona -->
                                                          ^^ ILEGAL
```

O compilador Delphi **não valida** o template: ele só substitui os placeholders. O erro
nasce no merge, um passo depois, e a mensagem aponta para o arquivo **gerado**, não para
o template que você editou — por isso a tendência é procurar no lugar errado.

Outros jeitos de quebrar o mesmo arquivo: tag não fechada, `&` solto (usar `&amp;`),
aspas desbalanceadas num atributo.

### Diagnóstico em 10 segundos

Valide o **template** resolvendo os placeholders (é o que o Delphi faz no Deploy):

```python
import io, re, xml.dom.minidom as m
s = io.open('AndroidManifest.template.xml', encoding='utf-8').read()
s = re.sub(r'<%[a-zA-Z\-]+%>', '', s)   # blocos:    <%uses-permission%>
s = re.sub(r'%[a-zA-Z]+%', 'x', s)       # atributos: %label%
try:
    m.parseString(s); print('TEMPLATE OK')
except Exception as e:
    print('INVALIDO:', e)               # da linha e COLUNA do defeito
```

Sem resolver os placeholders, o parser reclama do `<%uses-permission%>` da linha 10 e
esconde o defeito real.

Para conferir o manifest **gerado**, `xml.dom.minidom.parse()` direto nele — mas apague-o
antes e rode um Deploy, senão você valida a versão velha.

### Correção

Reescrever o comentário sem `--`. Ponto, ponto e vírgula ou vírgula resolvem.

### Por que isso vale a pena saber

Editar `AndroidManifest.template.xml` é rotina em app FMX que precisa de
`usesCleartextTraffic`, `networkSecurityConfig`, provider ou intent-filter. Um comentário
explicando **por que** aquela linha existe é boa prática — e é justamente aí que o `--`
entra sem ninguém notar, porque em quase toda outra linguagem `--` num comentário é inócuo.
