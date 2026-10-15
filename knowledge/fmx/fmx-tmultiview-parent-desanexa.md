# FMX: TMultiView.Parent muda sozinho, BringToFront vira no-op silencioso

**[FMX]**

## Sintoma

Um drawer (`TMultiView`, `Mode = Drawer`) que abre e fecha normalmente por
várias interações começa, em algum momento da sessão, a **não abrir mais**:
o botão de menu (hambúrguer) responde ao toque, o código roda até o fim sem
exceção, o `Presenter` interno do `TMultiView` até reporta `IsShowed = True`
depois de `ShowMaster` — mas nada aparece na tela.

Não é o bug clássico "`Opened` fica `True` sem o drawer estar visível depois
de navegar por outra rota sem fechar antes" (esse tem solução conhecida:
`BringToFront` no `TMultiView` antes de `ShowMaster`, porque em FMX quem
entra depois na lista de filhos desenha por cima — telas roteadas entram
DEPOIS do drawer). Esse aqui acontece mesmo com o `BringToFront` já
implementado e funcionando em todos os testes anteriores.

## Diagnóstico

`BringToFront` só reordena entre os filhos do **parent atual** do controle.
Se o `TMultiView` deixou de ser filho do container esperado (o `Layout`
hospedeiro onde ele foi originalmente parentado no Designer), `BringToFront`
não tem mais nenhum efeito visível — ele reordena corretamente, só que
dentro da lista de filhos errada.

Instrumentação temporária (removida depois de achar a causa) confirmou isso
comparando um toque de CONTROLE (drawer abrindo normalmente) com um toque
QUEBRADO:

```pascal
TLog.Info('Diag', Format(
  'Index=%d/%d Pos=(%.0f,%.0f) ParentIsHost=%s IsShowed=%s',
  [mtvMenu.Index, LytHost.ChildrenCount - 1,
   mtvMenu.Position.X, mtvMenu.Position.Y,
   BoolToStr(mtvMenu.Parent = LytHost, True),
   BoolToStr(mtvMenu.IsShowed, True)]));
```

- **Controle (funciona):** `ParentIsHost=True`, `Index=1/1` (último filho,
  como esperado depois do `BringToFront`).
- **Quebrado:** `ParentIsHost=False`, `Index=-1` — o `TMultiView` não é mais
  filho do `Layout` hospedeiro nenhum.

Nenhuma unit do projeto, fora do form hospedeiro, referenciava o
`TMultiView` diretamente — a troca de `Parent` não é causada por código de
aplicação. Gatilho observado (não confirmado como causa raiz): reproduziu
de forma consistente depois de uma sequência de UI updates via
`TThread.Queue` (progresso de uma operação assíncrona longa) seguida de
reabrir o drawer — suspeita de efeito colateral do próprio
`TStyleManager`/Presenter do FMX recriando o style do `TMultiView`, mas isso
**não foi confirmado**, só o sintoma e o padrão de reprodução.

## Correção (defensiva, não resolve a causa raiz)

Reatar o `Parent` antes de tentar mostrar, sempre que ele tiver desviado:

```pascal
if mtvMenu.Parent <> LytHost then
  mtvMenu.Parent := LytHost;

mtvMenu.Visible := True;
mtvMenu.BringToFront;
mtvMenu.ShowMaster;
mtvMenu.Enabled := True;
```

Barato (só reatribui quando necessário) e resolve o sintoma de forma
confiável em reprodução ao vivo repetida. Se a causa raiz da troca de
`Parent` aparecer em outro projeto, documentar aqui.

## Ver também

`fmx-defeitos-que-so-aparecem-rodando.md` — o caso #2 (`BringToFront` para
resolver drawer atrás da tela nova) é o problema ANTERIOR a este, mais
comum e mais fácil de reproduzir.
