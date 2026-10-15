# `TPathData.Data` lança EConvertError com números decimais colados sem separador no path SVG

## Sintoma

Atribuir uma string de path SVG a `TPath.Data.Data` (ou `TPathData.Data`) lança, em runtime:

```
EConvertError: 'X.YZ' is not a valid floating point value
```

Onde `'X.YZ'` é um trecho **literal** do próprio path SVG — não um valor externo, não input do usuário. O erro não aparece em toda versão do FMX/todo path; é específico de uma sequência numérica.

Se essa atribuição acontece **no meio** da montagem de um layout maior (ex. dentro de uma rotina que monta ícone → corpo → calcula altura final), o efeito colateral é pior que só o crash: qualquer código que rodaria **depois** da linha que lançou a exceção nunca executa. Um sintoma clássico: um diálogo/painel fica com altura não definida (0 ou default) enquanto elementos montados **antes** do ponto de falha (ex. botões, header) continuam com tamanho normal — produzindo uma aparência de "layout desconfigurado" que não tem nada a ver com posicionamento/Align, é a exceção abortando o método no meio.

## Causa

O path SVG contém dois números com ponto decimal **colados, sem separador** — ex. `-.9.92` (deveria ser dois números: `-.9` e `.92`). Em SVG, essa forma compacta é válida: a regra padrão é "um segundo `.` sem sinal `-` antes marca o início de um novo número" (já que um número não pode ter dois pontos decimais). O parser de `TPathData` do FMX não implementa essa regra de desambiguação corretamente para todo caso — falha especificamente quando **nenhum** sinal (`+`/`-`) separa os dois números, só o segundo ponto.

Padrão de risco a procurar: `\.[0-9]+\.[0-9]+` (um número terminado em `.dígitos` imediatamente seguido de outro `.dígitos`, sem espaço/vírgula/sinal entre eles).

Isso é **independente de compatibilidade de versão do Delphi** — não é um problema de downgrade/upgrade, é uma lacuna do parser presente em qualquer versão testada. Só aparece quando aquele trecho específico do path é finalmente exercitado (fácil de passar despercebido se o ícone/tipo de diálogo correspondente nunca foi testado).

## Correção — inserir separador explícito (espaço), sem alterar a geometria

Espaço é um separador de número válido em SVG path data — inserir um não muda o resultado renderizado, só desambigua a tokenização:

```pascal
// Antes (ambíguo, quebra o parser):
'...l-.9.92C13.45...'

// Depois (mesma geometria, tokenização inequívoca):
'...l-.9 .92C13.45...'
```

### Validação obrigatória

Ao corrigir, **não editar de olho** — confirme programaticamente que nenhum dígito mudou, só espaços foram inseridos:

```perl
my $orig  = '...'; # string original
my $fixed = $orig =~ s/\.([0-9]+)\./.$1 ./gr;   # insere espaço antes do 2o ponto

(my $o = $orig)  =~ s/\s+//g;
(my $f = $fixed) =~ s/\s+//g;
die "DIVERGIU" unless $o eq $f;   # sem espacos, tem que ser identico byte a byte
```

Verificar TAMBÉM que a correção elimina **todas** as ocorrências do padrão perigoso no path inteiro — pode haver mais de uma (não parar na primeira que aparecer no erro; o parser tipicamente falha na primeira ocorrência e nunca chega nas seguintes, escondendo-as).

## Defesa em profundidade — não deixar essa classe de erro voltar

Se o path vem de uma constante fixa, corrigir a constante resolve esse caso. Mas se o método aceita paths customizados (ex. um parâmetro tipo `SetCustomIcon(ASvg: string)`), qualquer consumidor pode introduzir o mesmo problema com um SVG próprio. Envolver a atribuição num `try..except` que degrada (ex. "sem ícone") em vez de deixar a exceção abortar o método inteiro evita que uma entrada malformada quebre o layout inteiro que depende do método completar:

```pascal
try
  LIconPath.Data.Data := ASvgPath;
except
  // sem icone e melhor que abortar a montagem do layout inteiro
end;
```

## Notas
- Sinal (`+`/`-`) SEMPRE desambigua sem ajuda: `5-.3` nunca é problema (o `-` marca o início do novo número inequivocamente). O risco é só quando **nenhum** sinal separa dois números, e a fronteira depende só do segundo `.`.
- Ver também [fmx-flowlayout-posicao-diverge-versoes.md](fmx-flowlayout-posicao-diverge-versoes.md) — outro caso de bug de runtime do FMX (não de compilação) descoberto por sintoma parecido (layout "desconfigurado"), mas com causa totalmente diferente (aquele é `TFlowLayout` divergindo entre versões; este é o parser de `TPathData` com um path especifico, em qualquer versão).
