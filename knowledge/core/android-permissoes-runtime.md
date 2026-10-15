# [Android] Permissão no manifesto não basta — e os tipos do callback não estão onde parecem

Duas coisas que travam quem vai pedir permissão em runtime pela primeira vez, e nenhuma
delas aparece como erro claro.

## 1. Declarar no manifesto não concede nada desde a API 23

Permissões "perigosas" (localização, câmera, microfone, contatos, armazenamento) exigem
**pedido em runtime**. Só declarar no `AndroidManifest` faz o app instalar e a API
falhar em silêncio: um `TLocationSensor` ativado sem permissão simplesmente **nunca
dispara o evento** — sem exceção, sem log, sem nada. Passa horas parecendo bug do
sensor.

```pascal
uses
  System.Types,          // TClassicStringDynArray  <- ver item 2
  System.Permissions,    // PermissionsService, TPermissionStatus
  Androidapi.Helpers,
  Androidapi.JNI.JavaTypes,
  Androidapi.JNI.Os;     // TJManifest_permission

PermissionsService.RequestPermissions(
  [JStringToString(TJManifest_permission.JavaClass.ACCESS_FINE_LOCATION),
   JStringToString(TJManifest_permission.JavaClass.ACCESS_COARSE_LOCATION)],
  procedure(const APermissions: TClassicStringDynArray;
    const AGrantResults: TClassicPermissionStatusDynArray)
  begin
    if (Length(AGrantResults) > 0) and
       (AGrantResults[0] = TPermissionStatus.Granted) then
      Prosseguir
    else
      Registrar('permissao negada');
  end);
```

O callback **é assíncrono**: roda quando o usuário responde ao diálogo do sistema, que
pode ser bem depois. Não escreva código que dependa do retorno logo abaixo da chamada.

`TPermissionStatus` é **scoped** (`{$SCOPEDENUMS ON}` em `System.Permissions`): escreva
`TPermissionStatus.Granted`, não `Granted`.

## 2. `TClassicStringDynArray` vem de `System.Types`, não de `System.Permissions`

O callback usa dois tipos e eles moram em units diferentes:

| Tipo | Unit |
|---|---|
| `TClassicPermissionStatusDynArray` | `System.Permissions` |
| `TClassicStringDynArray` | **`System.Types`** |

Faltando `System.Types`, o erro é `E2003: Undeclared identifier:
'TClassicStringDynArray'` seguido de `E2250: There is no overloaded version of
'RequestPermissions' that can be called with these arguments` — e o segundo erro faz
procurar sobrecarga, que não é o problema.

## 3. Onde declarar a permissão: template, não o diálogo da IDE

O diálogo *Project → Options → Uses Permissions* grava a lista no `.dproj`, e essa
lista se perde quando alguém recria o `.dproj` ou muda de versão do RAD. Declarar no
`AndroidManifest.template.xml`, ao lado do placeholder, deixa a permissão versionada
junto do código que depende dela:

```xml
<%uses-permission%>
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

⚠️ **`msbuild /t:Build` NÃO regenera o manifesto.** Ele compila e linka a `.so`, mas o
`AndroidManifest.xml` e o `AndroidManifest-merged.xml` em `Android64\Debug\` continuam
sendo os da última **implantação**. Conferir permissão ali depois de um build simples
leva a conclusão errada — o arquivo pode ser de semanas atrás (dá para perceber pelo
`versionName`, que estará desatualizado). Só o deploy do APK regenera.

## 4. Comentário em manifesto não aceita `--`

XML proíbe dois hífens seguidos dentro de comentário. Um travessão duplo num comentário
do template quebra o merge com `E8712 Exception while merging manifests`, e a mensagem
não diz onde.

## Ver também

- [anonima-nao-captura-rotina-aninhada.md](anonima-nao-captura-rotina-aninhada.md) — o
  callback de permissão é anônimo e não pode chamar procedure aninhada
- [android-deploy-e8712-buildtools.md](android-deploy-e8712-buildtools.md)
- [delphi-android-ios-versions.md](delphi-android-ios-versions.md)
