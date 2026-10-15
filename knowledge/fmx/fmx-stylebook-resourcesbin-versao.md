# [FMX] StyleBook `ResourcesBin` — `Property X does not exist` ao abrir form em IDE mais antiga

## Sintoma

Ao **abrir um form em IDE Delphi mais antiga** (ex.: projeto feito no 12/13 sendo
"compatibilizado" no 10.3.3 Rio), a IDE falha ao instanciar o form com:

```
Error creating form: Error reading TSelectionPoint.AutodetectPointLocation:
Property AutodetectPointLocation does not exist.
```

O erro acontece em **runtime/abertura do form** (não na compilação). Costuma estourar
no form que hospeda o `TStyleBook` central (que é `Application.CreateForm` no startup),
então quebra logo no início.

## Causa

O `TStyleBook` grava o estilo como **blob binário** na propriedade `ResourcesBin = { ... }`
(cabeçalho `FMX_STYLE 2.5` = hex `464D585F5354594C4520322E35`). Esse blob foi gerado por
um Delphi mais novo cujos objetos de estilo (`TSelectionPoint`, etc.) ganharam propriedades
novas (ex.: `AutodetectPointLocation`, adicionada após o 10.3). A IDE antiga não conhece a
propriedade e o streaming aborta.

Como o nome da propriedade está **codificado em hex dentro do blob**, um `grep` de texto
**não acha** — é preciso buscar pelo nome em hexadecimal.

## Diagnóstico

Nome da propriedade em ASCII → hex. Ex.: `AutodetectPointLocation` (23 chars = `0x17`):
```
4175746F646574656374506F696E744C6F636174696F6E
```
Buscar no `.fmx` (depois de remover espaços/quebras dentro de `{ }`, pois o hex é quebrado
em linhas):
```bash
perl -0777 -ne 'my @b=/\{\s*([0-9A-Fa-f\s]+?)\}/gs; for(@b){s/\s+//g;
  while(/(..)(4175746F646574656374506F696E744C6F636174696F6E)(..)/g){print "prev=$1 next=$3\n"}}' Form.fmx
```
`prev` deve ser `17` (o byte de comprimento do nome) e `next` o **value-type** TWriter:
`08`=vaFalse, `09`=vaTrue (booleano não tem bytes extras de valor).

## Correção — remover a propriedade do blob binário

No formato binário do DFM/FMX, propriedades são lidas **até um terminador `00`** — **não há
contador de propriedades**. Logo, remover os bytes de uma propriedade inteira é seguro:
o leitor simplesmente não a vê e aplica o **default** (no caso, `False`).

Para um booleano, remover a sequência completa `[len][nome ASCII][08|09]`. Ex.: para
`AutodetectPointLocation = True` (25 bytes): `17` + nome(23) + `09`.

Script (remove todas as ocorrências em todos os blobs `{ }` e reescreve no mesmo formato —
indentação 10 espaços, 64 hex/linha, `}` colado no fim do último trecho):
```perl
use strict; use warnings;
my $file=$ARGV[0]; open(my $fh,'<:raw',$file); local $/; my $d=<$fh>; close $fh;
my $t="174175746F646574656374506F696E744C6F636174696F6E09"; my $rm=0;
$d=~s/(\{)([0-9A-Fa-f\s]+?)(\})/proc($1,$2,$3)/ges;
sub proc{my($o,$in,$c)=@_; my $h=$in; $h=~s/\s+//g;
  return $o.$in.$c unless $h=~/\Q$t\E/i; $rm+=($h=~s/\Q$t\E//gi);
  my $out=$o."\n"; my @ck=($h=~/(.{1,64})/gs);
  for my $i (0..$#ck){$out.=(" "x10).$ck[$i]; $out.=($i==$#ck)?$c:"\n"} return $out}
open(my $w,'>:raw',$file); print $w $d; close $w; print "removidas: $rm\n";
```

### Validação pós-edição
- Total de bytes dos blobs cai **exatamente** `N_ocorrencias * tamanho_da_sequencia`.
- Cada blob com **comprimento de hex par**; chaves `{`/`}` balanceadas.
- O nome (em hex) não aparece mais; os **objetos** do estilo continuam presentes.
- Abrir o form na IDE antiga; se aparecer **outra** `Property Y does not exist`, repetir a
  técnica para `Y` (ajustando o byte de `len` e o value-type — strings usam `06`/`0C`/etc.).

### Depois que abrir
Re-salvar o StyleBook/form na própria IDE antiga normaliza o blob e remove outras
propriedades novas que ainda estejam escondidas. Sempre fazer **backup** do `.fmx` antes.

## Relacionado
- [fmx-stringgrid-colunas.md](fmx-stringgrid-colunas.md) — outro `Property X does not exist` de streaming (sintaxe VCL em grid FMX).
- [delphi13-breaking-changes.md](delphi13-breaking-changes.md) — quebras 12→13.
- [campos-orfaos-fmx.md](campos-orfaos-fmx.md) — erros de streaming `.fmx` ↔ `.pas`.
