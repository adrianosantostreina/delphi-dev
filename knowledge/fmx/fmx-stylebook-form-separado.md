# [FMX] StyleBook num form separado + resolução de estilo com conteúdo reparented

## TStyleBook centralizado num form/módulo só

Padrão comum: colocar um único `TStyleBook` (custom style com ícones/botões)
num form dedicado (ex.: `TViewStyleGeral` com `StyleGeral: TStyleBook`) e
reaproveitá-lo em todos os forms do app.

**Pegadinha 1 — o form do StyleBook precisa existir em runtime.** O StyleBook só
é instanciado quando o form que o contém é criado. Se o form estiver só na
cláusula `uses` do `.dpr` mas **não** for `Application.CreateForm`, o
`StyleGeral` é `nil` e nenhum estilo resolve. Auto-criar no `.dpr`.

**Pegadinha 1b — criar DEPOIS do MainForm, nunca antes.** O **primeiro `TForm`
criado com `Application.CreateForm` vira o `MainForm`** (o form que abre
automaticamente). `TDataModule` não conta. Se o portador do StyleBook for criado
**antes** do form principal, ele vira o MainForm e o app abre numa **tela branca**
(o form do StyleBook não tem UI). Criar **depois** do MainForm — o StyleBook só é
consumido quando as telas renderizam (durante o `Application.Run`), então chega a
tempo:

```pascal
Application.CreateForm(TFrmMain, FrmMain);              // 1o form = MainForm exibido
Application.CreateForm(TViewStyleGeral, ViewStyleGeral); // portador do StyleBook, DEPOIS
Application.Run;
```

**Pegadinha 2 — vincular StyleBook de OUTRO form é em código, não no Designer.**
O Object Inspector só lista StyleBooks do próprio form. Para usar um StyleBook
de outro módulo, atribua em código (ex.: no `FormCreate`/`FormShow`):

```pascal
uses LojaTenis.Style;
...
StyleBook := ViewStyleGeral.StyleGeral;
```

Um mesmo `TStyleBook` pode ser referenciado por vários forms — é só leitura.

## Resolução de estilo com conteúdo reparented (Router4D / frames)

`TStyledControl` resolve `StyleLookup` pela **cena raiz (root form)** do controle
**no momento em que aplica o estilo** — ou seja, `Scene.StyleBook` do form que
realmente contém o controle na árvore visual.

Quando um framework de navegação (ex.: Router4D `SetElement`) **reparenta** o
layout de um "frame-form" para dentro do form hospedeiro, a cena raiz passa a ser
o **hospedeiro**. Logo:

- Setar `StyleBook` só no frame-form filho **não estiliza** os controles depois
  de reparented — a cena deles agora é o hospedeiro.
- **Setar `StyleBook` no form hospedeiro** (o que de fato exibe o conteúdo) é o
  que faz os estilos resolverem.
- Setar no hospedeiro **antes** de renderizar/reparentar o filho, para que
  controles criados em runtime (chips, cards) já encontrem o StyleBook ao aplicar
  o estilo.

Regra prática: atribua `StyleBook` no **form hospedeiro** (MainForm). Atribuir
também nos filhos é inofensivo (vale se forem exibidos standalone), mas não é o
que resolve o caso reparented.

## Aplicar StyleLookup custom em runtime

Em controle clonado/criado dinamicamente: `Ctrl.StyleLookup := 'NomeDoStyle';`.
Para abas/chips com estado, alterne entre dois estilos do StyleBook
(ex.: `BtnAbaSelecionada` x `BtnAbaNaoSelecionada`) trocando `StyleLookup` no
clique, em vez de depender só de `IsPressed`.
