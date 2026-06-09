# Cláusulas `uses` — uma unit por linha, agrupada por namespace

Convenção de formatação para **toda cláusula `uses`** em código Delphi (VCL, FMX, console, package). Aplica-se ao `uses` da `interface`, ao `uses` da `implementation`, e a qualquer `uses` aninhado em `{$IFDEF}`.

## As regras

1. **Uma unit por linha**, com indentação de 2 espaços.
2. Vírgula no fim de cada linha, exceto a última (que termina com `;`).
3. **Units do mesmo namespace ficam contíguas** — todas as `Winapi.*` juntas, todas as `System.*` juntas, todas as `Vcl.*` juntas, etc. "Namespace" = primeiro segmento do nome (antes do primeiro ponto).
4. **Linha em branco entre grupos de namespace** — separação visual entre `Winapi.*`, `System.*`, `Vcl.*`/`FMX.*`, libs, units do projeto. A vírgula da última unit do grupo anterior fica imediatamente antes da linha em branco.
5. Ordem entre grupos: preservar a ordem natural do código existente; em código novo, seguir esta hierarquia padrão (do mais "baixo nível" pro mais "específico"):
   1. `Winapi.*` (API do SO)
   2. `Posix.*`, `Androidapi.*`, `iOSapi.*`, `Macapi.*` (APIs específicas de plataforma)
   3. `System.*` (RTL)
   4. `Data.*`, `Datasnap.*` (dados, RTL extension)
   5. `Vcl.*` ou `FMX.*` (framework de UI — escolha um)
   6. `FireDAC.*`, `REST.*`, `IdHTTP*`, etc (bibliotecas)
   7. Units do próprio projeto (sem prefixo de namespace, ou com prefixo do projeto como `App.*`, `Domain.*`)

## Exemplos

### ❌ Default do RAD Studio (evitar)

```pascal
uses
  Winapi.Windows, Winapi.Messages, System.SysUtils, System.Variants, System.Classes, Vcl.Graphics,
  Vcl.Controls, Vcl.Forms, Vcl.Dialogs, Vcl.StdCtrls;
```

### ✅ Vertical, agrupado, com linha em branco entre grupos

```pascal
uses
  Winapi.Windows,
  Winapi.Messages,

  System.SysUtils,
  System.Variants,
  System.Classes,

  Vcl.Graphics,
  Vcl.Controls,
  Vcl.Forms,
  Vcl.Dialogs,
  Vcl.StdCtrls;
```

### ❌ Vertical mas sem agrupar (evitar — units do mesmo namespace espalhadas)

```pascal
uses
  System.SysUtils,
  Vcl.Forms,
  System.Classes,
  Winapi.Windows,
  Vcl.Controls,
  Winapi.Messages,
  System.Variants,
  Vcl.Graphics,
  Vcl.Dialogs,
  Vcl.StdCtrls;
```

### ❌ Agrupado mas sem linha em branco entre grupos (evitar)

```pascal
uses
  Winapi.Windows,
  Winapi.Messages,
  System.SysUtils,
  System.Variants,
  System.Classes,
  Vcl.Graphics,
  Vcl.Controls,
  Vcl.Forms,
  Vcl.Dialogs,
  Vcl.StdCtrls;
```

### ✅ Em `implementation`

```pascal
implementation

uses
  System.IOUtils,
  System.JSON,

  REST.Client,
  REST.Types,

  FireDAC.Comp.Client,
  FireDAC.Stan.Param;
```

### ✅ Mobile / FMX com APIs nativas

```pascal
uses
  System.SysUtils,
  System.Classes,
  System.IOUtils,

  Androidapi.JNI.JavaTypes,
  Androidapi.JNI.GraphicsContentViewText,
  Androidapi.Helpers,

  FMX.Forms,
  FMX.Dialogs,
  FMX.Platform;
```

### ✅ Com `{$IFDEF}` (cada branch segue a mesma regra; linha em branco separa grupos)

```pascal
uses
  System.SysUtils,
  System.Classes,

  {$IFDEF MSWINDOWS}
  Winapi.Windows,
  Winapi.ShellAPI,
  {$ENDIF}

  {$IFDEF ANDROID}
  Androidapi.JNI.JavaTypes,
  Androidapi.Helpers,
  {$ENDIF}

  FMX.Forms,
  FMX.Dialogs;
```

> Vírgula precisa ficar antes do `{$IFDEF}` e antes do `{$ENDIF}` na unit anterior — o pré-processador lê texto, não tokens. Dentro de cada branch, manter agrupamento por namespace.

## Quando aplicar

- **Sempre** que o Claude gerar código novo (`.pas`, `.dpr`, `.dpk`).
- **Sempre** que o Claude editar uma cláusula `uses` existente — reformata a cláusula inteira (vertical + agrupada), não só a parte tocada.
- **Autorização do usuário (permanente)**: sempre que o Claude encontrar uma cláusula `uses` fora deste padrão num arquivo que está abrindo/lendo/editando por qualquer motivo, está autorizado a ajustar a cláusula sem precisar pedir confirmação. Não é necessário haver outra alteração no arquivo — a não-conformidade da `uses` em si justifica o reformat.
- **Limite**: não rodar uma "varredura global" do projeto reformatando dezenas de arquivos sem o usuário ter pedido por isso — a autorização cobre arquivos que o Claude já está mexendo no contexto da tarefa atual, não uma campanha de reformat em massa proativa.

## Como decidir o "namespace" de uma unit

- Pegar o **primeiro segmento** antes do primeiro ponto: `System.Net.HttpClient` → `System`; `FireDAC.Stan.Param` → `FireDAC`; `Vcl.Forms` → `Vcl`.
- Não subdividir em sub-namespaces: `System.Net.*` e `System.SysUtils` ficam no mesmo grupo `System.*`.
- Units sem ponto (legadas, ex: `Forms`, `Classes`, `Windows`) sempre vão pro fim, em grupo "sem namespace" (raro em código Delphi 11+).
- Units do projeto local (ex: `Domain.Pedido`, `App.Services.Auth`) seguem a mesma regra: o prefixo do projeto vira o "namespace" e fica no fim, depois das libs.

## Por que

- **Diff limpo**: adicionar/remover uma unit é +1/-1 linha, não rearranja o resto.
- **Merge conflict trivial**: cada unit é uma linha independente; conflito de duas branches que adicionaram units fica óbvio de resolver.
- **Code review legível**: agrupamento mostra de onde vem cada unit (RTL, framework, lib, projeto), e a linha em branco entre grupos torna a separação visual instantânea.
- **Consistência**: o RAD Studio gera no padrão horizontal por default; a convenção é manual/explícita.

## Armadilhas

- Ao colar `uses` gerado pelo RAD Studio (após adicionar componente no designer, por exemplo), reformatar antes de commitar — a IDE adiciona horizontalmente no fim da cláusula, ignorando agrupamento.
- A IDE não tem opção nativa para forçar nem o vertical nem o agrupamento.
- Plugins como GExperts → Source Formatter têm opção "one unit per line" mas não fazem agrupamento por namespace; precisa ser disciplina manual ou pre-commit hook customizado.
