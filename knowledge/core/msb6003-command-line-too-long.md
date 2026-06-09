# MSB6003 / MSB6002 — "command line too long" no build (dcc)

## Sintoma

O build via msbuild/`dcc*` falha com:

```
MSB6003: The specified task executable "dccaarm64.exe" could not be run.
The filename or extension is too long
```
(ou `MSB6002: The command-line for the ... task is too long.`)

Compila no IDE em projetos menores, mas falha na linha de comando — especialmente em
**Android64/iOS** e em ambientes com **muitas bibliotecas globais instaladas**
(TMS, ACBr, DevExpress, etc.), que incham `DCC_UnitSearchPath`. O limite do
`CreateProcess` do Windows é ~32.000 caracteres; o comando do compilador pode
passar de 50.000.

## Correção (preferida): arquivo de resposta do compilador

Adicionar ao `.dproj`, numa `PropertyGroup` base (sem condição de plataforma):

```xml
<DCC_ForceExecute>true</DCC_ForceExecute>
```

Isso faz o msbuild gravar um arquivo de resposta (`<Projeto>.cmds`) e passar
apenas `@Projeto.cmds` ao `dcc` — eliminando o limite de tamanho da linha de comando.
É a opção menos invasiva: não remove paths nem altera a estrutura do projeto.

## Alternativas (se ainda estourar ou não puder mexer no .dproj)

- Encurtar `DCC_UnitSearchPath`: remover paths de libs não usadas pelo projeto.
- Mover `.dcu` pré-compilados das libs para um único diretório e referenciar só ele.
- Usar caminhos curtos (8.3) ou mapear a raiz das libs num drive (`subst`).

## Relacionado

- [build-via-bat-com-log.md](build-via-bat-com-log.md) — padrão de build via `.bat` + log
- [delphi-android-ios-versions.md](delphi-android-ios-versions.md) — validar antes de build mobile
