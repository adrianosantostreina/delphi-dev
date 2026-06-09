# [FMX] Lista dinâmica com `Align = Top`: ordem inverte ao remontar

## Sintoma

Você monta uma lista em runtime adicionando vários controles (cards) num
`TVertScrollBox`/`TLayout` com `Align := TAlignLayout.Top`, iterando uma query.
Na **primeira** montagem a ordem fica correta (1º adicionado no topo). Mas quando
você **limpa e remonta** a mesma lista (ex.: voltar de outra tela/aba e recarregar),
a ordem aparece **invertida** — como se a query tivesse trocado ASC/DESC.

O log prova que a ordem dos dados está correta nas duas montagens (mesmos índices
0..N na mesma sequência) — o problema é puramente o **empilhamento visual** dos
filhos `Align=Top`, que não é estável entre montagens.

## Causa

Com `Align=Top`, o FMX empilha os filhos seguindo a **ordem deles na lista de
filhos do pai** (o `Index`). Ao adicionar via `AddObject`/`Parent :=`, o esperado
é append (vai para o fim). Mas após `Free` em massa + re-adição, a posição em que
os novos filhos entram na lista **não é garantida** — em containers que já foram
populados/realinhados, o resultado pode sair invertido. Confiar só na ordem de
adição é frágil.

## Correção

Fixar **explicitamente o `Index`** de cada filho na ordem desejada (0 = topo) logo
após definir o `Parent`, e envolver a remontagem em `BeginUpdate/EndUpdate` (um
único realign limpo no fim, sem flicker nem reordenação incremental):

```pascal
// No montador de cada item (recebe o indice da iteracao):
LRow := TRectangle.Create(AScroll);
LRow.Parent := AScroll;
LRow.Align  := TAlignLayout.Top;
if AIndice < LRow.Parent.ChildrenCount then
  LRow.Index := AIndice;   // trava a posicao na lista de filhos = ordem desejada
// ... resto da montagem do card ...

// No loop que monta a lista:
AScroll.BeginUpdate;
try
  LIndice := 0;
  Qry.First;
  while not Qry.Eof do
  begin
    CriarRow(..., LIndice);
    Inc(LIndice);
    Qry.Next;
  end;
finally
  AScroll.EndUpdate;
end;
AScroll.ViewportPosition := TPointF.Create(0, 0); // volta o scroll ao topo
```

## Armadilha relacionada (NÃO faça)

Tentar resolver trocando `Align=Top` por **posição Y absoluta** (`Align=None` +
`Anchors=[akLeft,akTop,akRight]` + `Width := Parent.Width - 8`) quebra a **largura**:
no momento da remontagem (aba recém-ativada) o scroll ainda não tem largura final,
então a âncora trava uma margem direita errada e os cards encolhem. `Align=Top`
calcula a largura a cada realign (à prova desse estado transitório) — mantenha
`Align=Top` e resolva a ordem pelo `Index`, como acima.

## Diagnóstico

Logar `Codigo`/`Index` na montagem ajuda a separar "ordem dos dados" de "ordem
visual": se o índice sai igual nas duas montagens mas a tela difere, é o
empilhamento `Align=Top` (aplicar a correção acima), não a query.

Relacionado: [fmx-scrollbox-scroll-vs-toque.md](fmx-scrollbox-scroll-vs-toque.md),
[componentes-designer-vs-runtime.md](componentes-designer-vs-runtime.md).
