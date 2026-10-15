# Nome do `program` igual ao de uma variável global → `E2029` sem relação aparente

## Sintoma

Build falha com um erro puramente sintático, tipicamente na última linha do
`.dpr` (o `Application.CreateForm(...)` ou similar):

```
NomeDoProjeto.dpr(NN): error E2029: '.' expected but ')' found
```

O erro **não aponta para nenhuma unit incluída no projeto** e o código do
`.dpr`/unit principal é sintaticamente correto (às vezes é literalmente o
boilerplate gerado pelo wizard do RAD Studio, ex.: "Service Application").
Remover/trocar units do `uses`, mexer no `.res`, no `.dfm`, renomear a
**classe** — nada disso resolve. Confirmado em Delphi 12 (compiler version
36.0), plataforma Win32, mas a causa é estrutural, não específica de versão.

## Causa

O **nome do `program`** ocupa espaço no escopo de identificadores globais do
executável. Se uma **variável global** declarada em qualquer unit usada pelo
`.dpr` tiver o **mesmo nome** do `program`, o parser do `dcc32` se confunde ao
resolver a expressão que referencia essa variável (tipicamente dentro de
`Application.CreateForm(TClasse, Variavel)`), produzindo um erro de sintaxe
sem relação aparente com a causa real.

Exemplo mínimo que reproduz (nenhum código de projeto necessário — só o
wizard "Windows Service Application"):

```pascal
program Trivial;              // <- nome do program

uses
  Vcl.SvcMgr,
  TrivialMain in 'TrivialMain.pas' {Trivial: TService};

begin
  Application.CreateForm(TTrivial, Trivial);   // Trivial = program name!
  Application.Run;
end.
```

```pascal
unit TrivialMain;
...
var
  Trivial: TTrivial;   // <- MESMO nome do program → E2029 na linha do CreateForm
```

Trocando **apenas** a variável global para outro nome (mantendo a classe
`TTrivial` e o `program Trivial` intactos), o erro desaparece.

Reproduzido tipicamente quando o gerador/autor do projeto usa o **mesmo nome
"amigável"** para o projeto, a classe principal e a variável global (padrão
comum em apps gerados/adaptados por script, ex.: `program MeuServico;` +
`var MeuServico: TMeuServico;`).

## Diagnóstico

Como o erro não aponta a causa, isole por bissecção:
1. Reduza o `.dpr` ao mínimo (só a unit principal, sem as demais units de
   negócio) — se o erro sumir, adicione de volta pela metade até achar o
   grupo culpado.
2. Se reduzir até sobrar só `program` + unit principal (boilerplate puro) e
   o erro **persistir**, suspeite do nome do `program` colidindo com algum
   identificador global (variável, mas também vale testar constantes/types)
   declarado nessa unit.
3. Teste renomeando a variável global (não a classe, não o `program`) para
   confirmar.

## Correção

Renomear a **variável global** (e, se for form/DataModule, o nome do objeto
correspondente no `.dfm`/`.fmx`) para algo diferente do nome do `program`.
**Não** é necessário renomear a classe nem o projeto/exe. Deixe um comentário
no código explicando a armadilha, porque a tentação de "corrigir de volta"
(nome bonito = nome do projeto) é grande e ninguém vai lembrar da causa raiz.

```pascal
var
  SvcMeuServico: TMeuServico;   // NÃO pode se chamar "MeuServico" (= nome do program)
```

## Relacionado

- [build-via-bat-com-log.md](build-via-bat-com-log.md)
- [msb6003-command-line-too-long.md](msb6003-command-line-too-long.md)
