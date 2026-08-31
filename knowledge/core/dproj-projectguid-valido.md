# `.dproj` escrito à mão precisa de `ProjectGuid` hexadecimal válido

Ao **criar um `.dproj` à mão** (sem o IDE — ex.: agente gerando o projeto), o
`<ProjectGuid>` precisa ser um **GUID válido**: 32 dígitos **hexadecimais**
(`0-9 A-F`) no formato `{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}`.

## Sintoma

Usar um placeholder "bonitinho" com letras não-hex (ex.:
`{A1B2C3D4-0002-4ABC-9DEF-0001DEMOCHAT}` — `M`,`H`,`T`,`O`,`G`... não são hex)
**compila normalmente pela linha de comando** (msbuild/dcc32 ignoram o campo),
mas o **RAD Studio recusa abrir** o projeto:

```
Unable to load project ...\DemoChat.dproj
'{A1B2C3D4-0002-4ABC-9DEF-0001DEMOCHAT}' is not a valid GUID value
```

## Pegadinha

O build CLI (msbuild/dcc32) **não valida** o `ProjectGuid` → um build verde via
`.bat` **não garante** que o IDE vai abrir o projeto. Só o IDE valida.

## Correção

Gerar um GUID real e usar no `<ProjectGuid>`:

- PowerShell: `[guid]::NewGuid().ToString().ToUpper()`
- Delphi: `CreateGUID` / `GUIDToString`

```xml
<ProjectGuid>{C2DA9E20-AA07-4515-999D-4713D17196BB}</ProjectGuid>
```

## Nota

Ao abrir um `.dproj` minimal feito à mão, o RAD Studio costuma **reescrevê-lo
por completo** (expande grupos de plataforma Android/iOS/OSX, VerInfo, jars).
Isso é normal — só confira que os blocos críticos do projeto (ex.:
`DCC_UnitSearchPath`, variáveis de busca de libs) sobreviveram e commite a
versão do IDE. Ver também [build-via-bat-com-log.md](build-via-bat-com-log.md).
