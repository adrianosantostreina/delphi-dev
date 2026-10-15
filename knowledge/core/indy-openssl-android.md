# OpenSSL do Indy no Android: empacotar as `.so` em `lib/<abi>/`

**[Android]**

**Sintoma:** cliente TLS com Indy (`TIdSSLIOHandlerSocketOpenSSL`) que funciona no Windows falha no
Android com **`Could not load SSL library`** ao conectar.

**Causa:** no Android moderno (API 24+), o app **não pode** carregar a `libcrypto.so`/`libssl.so` do
sistema (namespace restrito). É preciso **empacotar as próprias `.so` do OpenSSL dentro do APK**, na
pasta de libs nativas (`lib/<abi>/`), de onde o `dlopen` do Indy as carrega pelo nome.

> Diferente de [[ssl-tls-android]], que trata erro de **validação de certificado** (`Trust anchor...`)
> no `TNetHTTPClient`. Aqui o problema é **carregar a biblioteca** OpenSSL no Indy.

## A pegadinha (o que NÃO basta)

Adicionar as `.so` pelo nó **Libraries** (Project Manager → Target Platforms → Android → Libraries)
**pode não empacotá-las** na pasta certa: o Delphi gera entradas de Deployment com `Class="File"` **sem
`RemoteDir`**, que caem no destino padrão (`assets\internal\`) — fora de `lib/<abi>/`. Resultado: as
libs **não entram** em `lib/arm64-v8a/` do APK e o `dlopen` não as acha. (O nó Libraries trata como
link-time; como o Indy carrega em runtime, são ignoradas.)

## Correção (Deployment com RemoteDir correto)

No `.dproj`, cada `.so` precisa de `<RemoteDir>` apontando para a pasta nativa da ABI:

```xml
<DeployFile LocalName="...\openssl-1.0.2u\aarch64-linux-android\Dynamic\libcrypto.so"
            Configuration="Debug" Class="File">
    <Platform Name="Android64">
        <RemoteDir>library\lib\arm64-v8a\</RemoteDir>
        <RemoteName>libcrypto.so</RemoteName>
        <Overwrite>true</Overwrite>
    </Platform>
</DeployFile>
<!-- idem para libssl.so -->
```

`library\lib\arm64-v8a\` é o staging que o empacotador mapeia para `lib/arm64-v8a/` no APK. Pela UI:
Project → Deployment → Add Files → setar **Remote Path** = `library\lib\arm64-v8a\` e habilitar na config
Android 64-bit. (Para 32-bit: `library\lib\armeabi-v7a\` com as `.so` da ABI `arm-linux-androideabi`.)

## Detalhes que importam

- **ABI:** `aarch64-linux-android` = **`arm64-v8a`** (Android 64-bit). Confira a arquitetura da `.so`
  com `file libssl.so` → deve dizer `ELF 64-bit ... ARM aarch64`.
- **Versão:** OpenSSL **1.0.2** (ex.: 1.0.2u) casa com o Indy clássico do Delphi 12. Para Android novo
  com OpenSSL 1.1/3.x, considerar **TaurusTLS** (sucessor moderno do SSL do Indy).
- **Ordem:** `libssl` depende de `libcrypto`; o Indy carrega cripto primeiro. Empacotar as duas.
- **Verificação objetiva:** o APK é um zip — `unzip -l app.apk | grep -i ssl` deve listar
  `lib/arm64-v8a/libssl.so` e `libcrypto.so`. Se só aparecer `lib<app>.so`, as libs NÃO foram
  empacotadas (RemoteDir errado).
- **Sincronia IDE × `.dproj`:** se editar o `.dproj` à mão com o projeto aberto, **reabrir o projeto**
  na IDE antes de buildar (senão a IDE sobrescreve a edição).
- Lembrar do `PassThrough := False` no cliente ([[indy-tls-client-passthrough]]) — é a outra metade do
  TLS funcionar.
