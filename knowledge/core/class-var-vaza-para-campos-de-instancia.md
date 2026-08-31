# `class var` contamina os campos seguintes — `E2356 Property accessor must be an instance field or method`

Armadilha de sintaxe que atinge com força **código gerado** (agente, template, scaffold), porque
o layout "bonito" — `class var` no topo, linha em branco, campos de instância embaixo — é
exatamente o que produz o bug.

## Sintoma

```
MinhaUnit.pas(26): error E2356: Property accessor must be an instance field or method
MinhaUnit.pas(27): error E2356: Property accessor must be an instance field or method
...
```

Um erro por **propriedade**, todas apontando para campos que estão visivelmente declarados na
classe. O `F` do campo existe, o tipo bate, a visibilidade permite. Nada parece errado.

## O código que causa

```pascal
type
  TApiConfig = class
  strict private
    class var FInstancia: TApiConfig;

    FPorta: Integer;      // <-- AINDA é class var
    FJwtSecret: string;   // <-- AINDA é class var
    FDbHost: string;      // <-- AINDA é class var
  public
    class function Instancia: TApiConfig;

    property Porta: Integer read FPorta;        // E2356
    property JwtSecret: string read FJwtSecret; // E2356
    property DbHost: string read FDbHost;       // E2356
  end;
```

## Causa

**`class var` abre uma seção que permanece ativa até o próximo especificador de visibilidade
(`private`, `public`, …) ou um `var` explícito. Linha em branco NÃO fecha a seção.**

Ou seja: `FPorta`, `FJwtSecret` e `FDbHost` são todos **variáveis de classe**, não campos de
instância. E uma **propriedade de instância não pode ter como acessor uma variável de classe** —
daí o `E2356`.

O erro é apontado na linha da **propriedade**, não na do campo, o que empurra a investigação para
o lado errado.

## Correção

Três formas, em ordem de preferência:

**1. `var` explícito para voltar aos campos de instância** (mais claro sobre a intenção):

```pascal
strict private
  class var FInstancia: TApiConfig;

  var
  FPorta: Integer;
  FJwtSecret: string;
```

**2. Declarar o `class var` por último**, antes de trocar a visibilidade:

```pascal
strict private
  FPorta: Integer;
  FJwtSecret: string;
  class var FInstancia: TApiConfig;
public
```

**3. Isolar o `class var` na sua própria seção de visibilidade:**

```pascal
strict private
  FPorta: Integer;
  FJwtSecret: string;
strict private
  class var FInstancia: TApiConfig;
```

## Por que aparece tanto em singleton

O padrão singleton clássico em Delphi coloca a instância em `class var` no topo da seção privada
e os campos de estado logo abaixo. É o layout natural — e é exatamente o layout defeituoso.
Qualquer classe que misture `class var` com campos de instância na mesma seção está exposta.

## Como detectar antes de compilar

Procurar `class var` seguido, na mesma seção de visibilidade, de outras declarações de campo:

```
grep -n -A6 "class var" *.pas
```

Se houver campo declarado depois do `class var` sem um `var` ou novo especificador de
visibilidade no meio, o campo é de classe — mesmo que a intenção fosse outra.

## Regra prática

**Ao gerar código, nunca deixe `class var` e campos de instância na mesma seção de
visibilidade.** É custo zero separar, e o erro que isso evita não se parece nem um pouco com a
sua causa.
