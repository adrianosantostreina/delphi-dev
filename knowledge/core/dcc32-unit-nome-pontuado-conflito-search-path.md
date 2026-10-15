# Delphi 13 (dcc32 37.0): unit-fonte com nome pontuado no `-U` quebra resolução de OUTRA unit pontuada da RTL (`F2613 Unit not found`)

## Sintoma

```
F2613 Unit 'Web.HTTPApp' not found.
```

Apontado num arquivo/linha que **não faz sentido** — ex. `Web.WebConst.pas(61)` num arquivo que só tem 59 linhas e nenhuma cláusula `uses` que referencie a unit "não encontrada". Isso é uma pista: o compilador está atribuindo o erro ao **último arquivo compilado com sucesso antes de travar em outra unit**, não ao arquivo real que causa o problema — não perca tempo lendo esse arquivo procurando a causa.

`Web.HTTPApp.dcu` (ou a unit RTL que estiver faltando) **existe** fisicamente no lib path da plataforma/config (`$(BDS)\lib\Win32\debug\`, por exemplo) — não é ausência de arquivo nem falta de `DCC_UsePackage` (unit RTL solta não pertence a pacote nenhum).

Comum em projetos que usam o framework **Horse** (ou qualquer dependência vendorizada que traga um arquivo-fonte shim chamado como uma unit real da RTL, ex. `Web.WebConst.pas`), combinado com `FrameworkType=VCL` ou qualquer build Win32/Win64.

## Causa raiz confirmada

O `dcc32` do RAD Studio 37.0 tem um bug/quirk: **a mera presença, em qualquer pasta do `-U` (`DCC_UnitSearchPath`), de um arquivo-fonte com nome pontuado que compartilha o primeiro segmento com uma unit REAL da RTL** (ex. pasta com `Web.WebConst.pas`, quando a RTL tem `Web.HTTPApp`, `Web.WebReq`, etc.) faz o compilador falhar ao resolver a unit REAL via `.dcu` pré-compilado — mesmo que o programa não referencie o arquivo shim em nada.

Reproduzido de forma isolada e determinística:

```pascal
program TestOrder3;
{$APPTYPE CONSOLE}
uses
  System.Classes,
  Web.HTTPApp;   // <- unidade real da RTL, resolvida via .dcu
begin
  Writeln('ok');
end.
```

- Com `-U"$(BDS)\lib\Win32\debug"` **sozinho** → compila.
- Com `-U"$(BDS)\lib\Win32\debug"` + `-U"<pasta com Web.WebConst.pas>"` (mesmo sem o programa usar nada dessa pasta) → **`F2613 Unit 'Web.HTTPApp' not found`**.
- Ordem das duas `-U` não importa (testado nos dois sentidos).
- Adicionar a pasta de **fonte** do WebBroker (`$(BDS)\source\internet`, que contém `Web.HTTPApp.pas`) à lista `-U` → volta a compilar. O compilador passa a poder recompilar `Web.HTTPApp` a partir do fonte em vez de depender só do `.dcu`, e o conflito desaparece.

Isso é consistente com uma falha na lógica interna de "unit scope"/dotted-unit-name do `dcc32`: ao encontrar um arquivo `Web.*` numa pasta do search path, o compilador parece "travar" a resolução de outras units `Web.*` a essa mesma pasta em vez de continuar procurando nas pastas seguintes — e só se recupera se a unit **também** existir como fonte (não só `.dcu`) em algum lugar do path.

## Como diagnosticar (bissecção rápida)

1. Confirmar que a `.dcu` da unit "não encontrada" existe fisicamente no lib path (`find`/`Get-ChildItem`).
2. Criar um `.dpr` mínimo de console só com `uses <UnidadeReal>;` e as `-U` mínimas — se isolado funciona, o problema é de interação, não da unit em si.
3. Ir adicionando de volta, uma pasta do `DCC_UnitSearchPath` de cada vez (ou por bissecção binária), até o erro reaparecer — geralmente é a pasta de uma dependência vendorizada que carrega um arquivo com nome igual (primeiro segmento) ao de uma unit RTL.
4. Confirmar a teoria testando se adicionar a pasta de **fonte** da RTL correspondente (`$(BDS)\source\<subpasta>`) resolve, sem precisar remover a pasta da dependência (que normalmente é necessária para outras units legítimas dela).

## Correção

No `.dproj`, adicionar a pasta de fonte da RTL relevante ao `DCC_UnitSearchPath` (grupo de propriedades da plataforma, ex. `Base_Win32`):

```xml
<DCC_UnitSearchPath>$(BDS)\source\internet;$(DCC_UnitSearchPath)</DCC_UnitSearchPath>
```

(`source\internet` é onde mora `Web.HTTPApp.pas`/`Web.WebReq.pas` — para outros conflitos, localizar a subpasta certa em `$(BDS)\source\`.)

**Não é necessário** (e não ajuda) remover a pasta da dependência vendorizada do search path — ela normalmente contém dezenas de outras units legítimas que o projeto precisa.

## Caso concreto de origem (Horse)

O framework Horse traz seu próprio `Web.WebConst.pas` em `modules\horse\src\` — um shim de compatibilidade para builds FPC/Lazarus, onde a RTL real do WebBroker não existe. Em builds Delphi normais (dcc32), esse arquivo é irrelevante/nunca deveria interferir, mas por estar na mesma pasta que as demais units do Horse (que **precisam** estar no `-U`), ele acaba disparando o bug acima contra a `Web.HTTPApp` real, necessária pelo **core** do Horse (`Horse.Core`, `Horse.Request`, `Horse.WebModule`) e pelos providers Console/Daemon (via `Web.WebReq`) — isto é, **não é exclusividade do provider VCL** (`Horse.Provider.VCL`); `Web.HTTPApp` é dependência normal do Horse em qualquer provider Delphi (Console, Daemon, ISAPI, Apache, CGI, VCL — todos entram incondicionalmente no `uses` de `Horse.pas` para build não-FPC, só o **alias** `THorseProvider` é condicional).

## Contexto de descoberta

Confirmado no RAD Studio 37.0 (Delphi 13), Windows 11, MSBuild puro. Não testado em versões anteriores — pode ser regressão específica do dcc32 37.0, já que o mesmo projeto/módulo Horse presumivelmente compilava antes em versões anteriores do Delphi.
