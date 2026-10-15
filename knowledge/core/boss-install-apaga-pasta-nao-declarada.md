# Boss: `boss install` apaga de `modules/` o que nao esta no boss.json

Validado 2026-10-01 (boss v3.0.9).

## O problema

Lib copiada a mao para `modules/<lib>` (vendorizada) e referenciada no search
path do `.dproj` funciona na maquina de quem copiou -- ate o proximo
`boss install`. O boss **remove** de `modules/` as pastas que nao estao no
`boss.json`/`boss-lock.json`. Num clone limpo (ou num zip entregue a aluno) a
pasta nunca existe e o build quebra com `F2613 Unit ... not found`.

## Correcao

Se a lib tem repositorio git (mesmo sem `boss.json` proprio), declare-a:

```json
"github.com/<dono>/<lib>": "v1.4.2"
```

- **Versao exata, sem `^`**, quando a copia vendorizada corresponde a uma tag
  antiga: `^1.4.2` puxaria a ultima 1.x (no caso real, 1.9.2, com API
  incompativel). Descubra a tag comparando o `src/` vendorizado com cada tag
  (`git archive <tag> src | tar -x` + `diff -rq`).
- O nome da pasta criada e o nome do repo em minusculo -- confira que bate
  com o search path do `.dproj`.

## Como testar de verdade

Copiar o projeto **sem** `modules/` para uma pasta nova, `boss install`,
compilar todas as plataformas. Foi assim que este problema e o do `HAS_FMX`
do Router4D apareceram -- os dois invisiveis na maquina de origem, porque la a
pasta vendorizada e o `.inc` editado a mao ja existiam.

`boss install` tambem reescreve o `DCC_UnitSearchPath` do `.dproj` (insere
`$(DCC_UnitSearchPath)`) e as hashes do `boss-lock.json` -- esperado.

## Relacionado
- [router4delphi-has-fmx-define.md](router4delphi-has-fmx-define.md)
