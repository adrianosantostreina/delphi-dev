# RAD Studio 37.0 (Delphi 13): BRCC32 via MSBuild usa motor novo (resinator) por padrão — `CompilerToUse=brcc` documentado está quebrado

## Sintoma

Build por linha de comando (`msbuild Projeto.dproj /t:Build`) falha na etapa de recurso com:

```
G2ServiceForcaVendas.vrc : error :  invalid line command in the preprocessed source
note: this is likely to be a bug, please report it
```

O `.vrc` gerado é um `VERSIONINFO` padrão, ASCII puro, sem BOM, sintaticamente correto — compilar ele manualmente com `brcc32.exe` (fora do MSBuild) funciona sem erro nenhum. O erro só acontece **via MSBuild**.

Pode acontecer tanto pela IDE quanto por `msbuild`/`dcc32` puro — é o mesmo motor por trás dos dois.

## Causa raiz

A partir do RAD Studio 37.0 (Delphi 13), a task MSBuild `BRCC32` (`Borland.Build.Tasks.Shared.dll`) passou a suportar 3 motores de compilação de recurso, selecionáveis pela propriedade `BRCC_CompilerToUse`:

| Valor | Motor | Executável |
|---|---|---|
| `brcc` | Borland Resource Compiler (clássico) | `brcc32.exe` |
| `rc` | External Resource Compiler (novo) | `cgrc.exe` + `resinator.exe` (clone do `rc.exe` em Zig) |
| `msrc` | Microsoft Windows SDK Resource Compiler | `cgrc.exe` + `rc.exe` (Windows SDK) |

A metadata oficial da própria task (embutida em `Borland.Build.Tasks.Shared.dll`, resource `brcc32task.xml`) documenta:

```xml
<Option Name="CompilerToUse">
  <DefaultValue>brcc</DefaultValue>
  ...
</Option>
```

Ou seja, o **default documentado é `brcc`** (o clássico `brcc32.exe`, o mesmo de sempre). Só que na prática:

- Sem `BRCC_CompilerToUse` definido no `.dproj`, a task usa `rc` (resinator) — não `brcc`.
- Definir explicitamente `<BRCC_CompilerToUse>brcc</BRCC_CompilerToUse>` **não muda nada** — a task continua caindo em `rc`. Confirmado via `/v:diag`: `Task Parameter:CompilerToUse=rc` mesmo com a propriedade setada para `brcc`.
- Definir `<BRCC_CompilerToUse>msrc</BRCC_CompilerToUse>` **funciona** — a task realmente roteia para `rc.exe` do Windows SDK.

Ou seja: **o valor "brcc" está inacessível/quebrado nesta versão da task**; só `msrc` (e implicitamente `rc`, que é o efetivo default de fato) são alcançáveis. É um bug real do toolchain, não do projeto — a própria mensagem de erro do `resinator` ("this is likely to be a bug, please report it") reforça isso.

## Diagnóstico (como confirmar antes de aplicar a correção)

1. Rodar `brcc32.exe NomeDoProjeto.vrc` manualmente (fora do MSBuild, no diretório do projeto) — se compilar limpo, o problema é do motor novo, não do `.vrc`.
2. Rodar a build com `/v:diag` e procurar `Task Parameter:CompilerToUse=` e a linha do comando `cgrc.exe`/cake `resinator.exe` executado — confirma qual motor está realmente em uso.
3. Testar `<BRCC_CompilerToUse>msrc</BRCC_CompilerToUse>` no `.dproj` (grupo de propriedades da plataforma, ex. `Base_Win32`) e rebuildar.

## Correção

No `.dproj`, dentro do `PropertyGroup` da plataforma (`Base_Win32`/`Base_Win64`):

```xml
<BRCC_CompilerToUse>msrc</BRCC_CompilerToUse>
```

Isso força o uso do `rc.exe` do Windows SDK (via o wrapper `cgrc.exe`) em vez do `resinator.exe` problemático — sem perder nenhuma metadata de versão (`VerInfo_Keys` continua funcionando normalmente, gera `.res` completo com `VERSIONINFO`).

**Não usar como primeira alternativa:** `VerInfo_IncludeVerInfo=False` — isso "resolve" evitando o passo de recurso inteiro, mas descarta toda a metadata de versão do executável (FileVersion, ProductName, etc.). Só considerar isso se `msrc` também falhar (não deveria, no ambiente testado funcionou de primeira).

**Pré-requisito:** `rc.exe` do Windows SDK precisa estar instalado (normalmente já vem com o Windows Kits / Visual Studio Build Tools). Confirmar em `C:\Program Files (x86)\Windows Kits\10\bin\<versão>\x86\rc.exe` (ou caminho equivalente) se `msrc` não for encontrado.

## Contexto de descoberta

Confirmado no RAD Studio 37.0 (compiler version 37.0), Windows 11, MSBuild puro (fora da IDE). Não testado em versões anteriores do Delphi (a suspeita, por comparação com `CodeGear.Common.Targets` usado pelo C++Builder, é que esse bug seja específico do pipeline Delphi.Targets desta versão — o C++ pipeline tem fallback explícito para "rc" no próprio `.targets`, o Delphi não tem fallback nenhum, só repassa a propriedade crua).
