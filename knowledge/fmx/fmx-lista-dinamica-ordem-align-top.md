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

## ⚠️ Leia primeiro: `Index` só decide quando o `Position.Y` empata

Corrigido em 2026-08-05, depois de aplicar a receita abaixo num caso de
**controles de design-time** e ela **não funcionar**.

Com `Align=Top`, o realign do FMX ordena os irmãos alinhados pelo **`Position.Y`
corrente**. O `Index` só governa quando os Y estão **empatados**:

| Cenário | Y dos filhos | Quem decide a ordem |
|---|---|---|
| Controles criados em runtime | todos `0` (empatados) | **`Index`** — a receita abaixo vale |
| Controles vindos do `.fmx` | cada um com o Y de projeto, todos diferentes | **`Position.Y`** — mexer no `Index` não faz nada |

Sintoma do segundo caso: a tela aparece numa ordem que não é a de projeto nem a
programada, e reordenar por `Index` (ou até mover o bloco no `.fmx`) não muda
nada — porque o `Position.Y` de projeto continua mandando.

Correção para controles de design-time: reescrever o `Position.Y` em ordem
crescente, usando-o **apenas como chave de ordenação** (o `Align=Top` recalcula o
Y real logo em seguida):

```pascal
MainLayout.BeginUpdate;
try
  for I := 0 to High(FOrdem) do
  begin
    FOrdem[I].Position.Y := I * 100;  // chave de ordenacao; o Align recalcula
    FOrdem[I].Index := I;             // mantem a lista de filhos coerente
  end;
finally
  MainLayout.EndUpdate;
end;
```

---

## Causa (caso original: controles criados em runtime)

Com `Align=Top` e todos os filhos com `Position.Y = 0`, o FMX empilha seguindo a
**ordem deles na lista de filhos do pai** (o `Index`). Ao adicionar via `AddObject`/`Parent :=`, o esperado
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

## Variante em layout ESTÁTICO editado à mão: ordem segue `Position.X/Y`, não a declaração

Ao inserir/editar controles `Align=Top` (ou `Align=Left`) **direto no `.fmx`** (fora do
Designer), o FMX empilha os irmãos pela **`Position.Y`** (Top) / **`Position.X`** (Left),
**não** pela ordem em que aparecem no arquivo. Sintoma real: um `TLayout` novo declarado
logo após o primeiro irmão, mas com `Position.Y` alto (sobra de outro bloco), aparece
**lá embaixo**; botões `Align=Left` com `Position.X = 0` (default, não informado) **pulam
para a frente** de um label que tem `Position.X = 4`.

**Regra:** ao montar `.fmx` à mão, definir `Position.Y` (Top) / `Position.X` (Left)
**crescente na ordem visual desejada** para TODOS os irmãos do grupo — não basta a ordem
de declaração. Ex.: stepper `Quantidade: [-] [campo] [+]` → `Position.X` 4, 129, 190, 290;
coluna Resumo→Plano→Entrada→... → `Position.Y` 12, 140, 200, 270, ...
(O Designer grava esses valores automaticamente; o erro só aparece quando se edita o texto
do `.fmx` na mão. Compila normal — quebra/desalinha só no runtime ao abrir o form.)

## Diagnóstico

Logar `Codigo`/`Index` na montagem ajuda a separar "ordem dos dados" de "ordem
visual": se o índice sai igual nas duas montagens mas a tela difere, é o
empilhamento `Align=Top` (aplicar a correção acima), não a query.

Relacionado: [fmx-scrollbox-scroll-vs-toque.md](fmx-scrollbox-scroll-vs-toque.md),
[componentes-designer-vs-runtime.md](componentes-designer-vs-runtime.md).
