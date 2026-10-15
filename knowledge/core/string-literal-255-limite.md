# E2056 `String literals may have at most 255 elements` (downgrade p/ Delphi ≤ 11)

## Sintoma

Ao compilar em **Delphi ≤ 11.x / 10.x** um código que vinha do **Delphi 12 (Athens)**:

```
[dcc32 Error] Unidade.pas(NN): E2056 String literals may have at most 255 elements
```

## Causa

Até o Delphi 11, **um literal de string entre aspas pode ter no máximo 255 caracteres**.
O **Delphi 12 (Athens) removeu esse limite** — passou a aceitar literais longos. Por isso
código com um literal único > 255 chars compila no 12 e quebra ao "compatibilizar" para baixo.

Comum em **paths de SVG embutidos, base64, JSON/SQL inline** guardados como `const X = '...';`.

## Correção — quebrar em pedaços ≤ 255 concatenados com `+`

O compilador faz *constant folding* da concatenação — o valor final é **idêntico**:

```pascal
SVG_QUESTION = 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 ...(≤255)' +
               '-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z';
```

Script (quebra todos os `const Nome = '...';` longos do arquivo em chunks de 200):
```perl
perl -i -pe '
  if (/^(\s*\w+\s*=\s*)\x27(.*)\x27;\s*$/ && length($2) > 255) {
    my ($pre,$s)=($1,$2); my @c=($s =~ /(.{1,200})/gs);
    $_ = $pre . join(" +\n    ", map { "\x27$_\x27" } @c) . ";\n";
  }' Unidade.pas
```

### Validação
- Confirmar que a **concatenação reproduz o original char-a-char** (comparar contra backup;
  cuidado se houver aspas simples internas — `''` conta como 1 char e não pode ser cortado no meio).
- `length` do valor concatenado == `length` do original.

## Notas
- Alternativas: ler de recurso (`{$R}` + `TResourceStream`) ou de arquivo externo, em vez de
  literal gigante — ver [recursos-rcdata.md](recursos-rcdata.md).
- Outros erros típicos de downgrade de versão: [fmx-stylebook-resourcesbin-versao.md](fmx-stylebook-resourcesbin-versao.md),
  e binários (`.dcu`/`.dcp`/`.bpl`) são **específicos da versão** do compilador — recompilar do fonte.
