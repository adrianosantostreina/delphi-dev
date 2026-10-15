# Delphi 13: `F2613 Unit 'Web.HTTPApp' not found` ao migrar projeto Horse

## Sintoma

Projeto Horse que compilava no Delphi 12 quebra logo no início da migração para
o Delphi 13 (RAD Studio 37.0), com **um único erro**:

```
modules\horse\src\Web.WebConst.pas(61): error F2613: Unit 'Web.HTTPApp' not found.
```

O que engana: a mensagem aponta um arquivo que **não tem cláusula `uses`** e que
muitas vezes nem tem a linha citada (a cópia do Horse tem 59 linhas, e o erro
diz 61). Procurar `Web.HTTPApp` dentro dele não leva a lugar nenhum.

## Causa

`modules/horse/src` traz uma **cópia própria de `Web.WebConst.pas`** — só
resourcestrings, provavelmente para compatibilidade com FPC. Como o
`DCC_UnitSearchPath` do projeto coloca `modules\...` **antes** da library path,
essa cópia **sombreia a unit da RTL**.

No Delphi 13 a RTL passou a declarar 5 resourcestrings que a cópia do Horse não
tem:

```
sCannotGenerateSessionId
sOnlyOneAuthenticator
sOnlyOneAuthorizer
sOnlyOneSessionManager
sStreamingNotSupported
```

O **gbswagger** usa `Web.HTTPApp`. O `Web.HTTPApp.dcu` que veio compilado com o
Delphi 13 referencia essas strings; ao encontrar um `Web.WebConst` incompatível,
o compilador decide **recompilar `Web.HTTPApp` a partir da fonte** — que mora em
`$(BDS)\source\internet` e **não está no search path**. Daí o "not found".

## Como confirmar em 10 segundos

```bash
comm -23 \
  <(grep -oE "^[[:space:]]+s[A-Za-z]+" "$BDS/source/internet/Web.WebConst.pas" | tr -d ' ' | sort -u) \
  <(grep -oE "^[[:space:]]+s[A-Za-z]+" "modules/horse/src/Web.WebConst.pas"     | tr -d ' ' | sort -u)
```

Se listar identificadores, a cópia do módulo está defasada em relação à RTL.

## Correção

Colocar uma cópia do `Web.WebConst.pas` **da RTL da versão em uso** numa pasta
local do projeto (ex.: `patch/`) e garantir que ela venha **antes** de
`modules\horse\src` no `DCC_UnitSearchPath`. `modules/` fica intocado, então
`boss install` não desfaz nada.

Não adianta adicionar `$(BDS)\source\internet` ao search path: isso faz o
WebBroker inteiro compilar da fonte e o problema se espalha.

> **Ao voltar para a versão anterior do Delphi, REMOVA o override** — cada versão
> da RTL tem seu conjunto de strings, e o arquivo certo para o 13 é o errado
> para o 12.

## Regra geral que este caso ilustra

Biblioteca de terceiros que **carrega cópia de uma unit da RTL** é uma bomba-
relógio de migração: funciona enquanto as duas versões coincidem e quebra sem
aviso na primeira atualização do Delphi, com erro apontando o arquivo errado. Ao
migrar, vale varrer os módulos por nomes de units da RTL (`System.*`, `Web.*`,
`Data.*`) antes de investigar qualquer outra coisa.

## Relacionado

- [delphi-android-ios-versions.md](delphi-android-ios-versions.md) — por que migrar (Google Play exige API 36 a partir de 31/08/2026)
- [android-deploy-e8712-buildtools.md](android-deploy-e8712-buildtools.md) — a SDK do Delphi 13 vem **sem `build-tools`**
