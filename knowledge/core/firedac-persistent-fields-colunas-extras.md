# FireDAC — Campos persistentes ignoram colunas extras do SELECT

## Sintoma

Um `TFDQuery` que **tem campos persistentes** (objetos `TField` definidos no `.dfm`,
do tipo `QryXXXcampo: TStringField`) abre normalmente, mas `FieldByName('NOVA_COLUNA')`
lança **`Field 'NOVA_COLUNA' not found`** mesmo que a coluna esteja no `SELECT` e exista
na tabela.

Se isso acontece dentro de um loop de render por item (lista), cada item lança exceção;
quando o loop usa `TThread.Synchronize`, a main thread fica inundada e a UI **trava**
(ex.: um Loading que nunca fecha).

## Causa

Com **campos persistentes**, o FireDAC expõe **apenas** os fields pré-definidos e mapeia
o resultado para eles **por nome**. Colunas do resultado que **não** têm um field
persistente correspondente são **silenciosamente ignoradas** — nenhum field dinâmico é
criado para elas. Logo `FieldByName` não as encontra.

(Datasets com **campos dinâmicos** — sem fields no `.dfm` — criam um field por coluna do
resultado; aí `FieldByName` da coluna nova funciona. O problema é exclusivo de datasets
com fields persistentes.)

> Observação prática: **adicionar o field persistente à mão no `.dfm`** (um `object
> QryXXXNOVA: TStringField ... end`) nem sempre passa a expor a coluna em runtime de
> forma confiável. Mais seguro evitar depender disso.

## Soluções (em ordem de robustez)

1. **Adicione a coluna como campo persistente** (o caminho normal). Funciona quando a
   coluna é **nativa** (tem `decltype`, ex.: `VARCHAR(40)`) → o FireDAC mapeia para
   `ftString` e um `TStringField` casa. **Regra de ouro:** todo SELECT que aquele
   `TFDQuery` executa precisa incluir a coluna, senão o `Open` quebra (field persistente
   sem coluna correspondente). Gerar pela IDE (Fields Editor → Add Fields) ou, se editar
   o `.dfm` à mão, manter `.pas` e `.dfm` 1:1 e fazer **rebuild limpo + redeploy**.

2. **Compute no SQL e carregue num field persistente existente — CUIDADO com o tipo.**
   ```sql
   COALESCE(NULLIF(TRIM(APELIDO), ''), NULLIF(TRIM(CONTATO), '')) AS APELIDO
   ```
   ⚠️ **Armadilha:** uma **EXPRESSÃO** (COALESCE/CAST/concat) **não tem `decltype`**, então
   o FireDAC/SQLite infere o resultado como **`ftWideString`**. Se a coluna aliasada tem
   um field persistente `TStringField` (`ftString`), dá:
   `Type mismatch for field 'X', expecting: String actual: WideString` (e o dataset volta
   vazio). `CAST(... AS VARCHAR(n))` **não** resolve — `sqlite3_column_decltype` retorna
   NULL para expressões. Só use esta opção se o field for `TWideStringField` **e** o mesmo
   field não for usado também com a coluna crua noutra query (senão inverte o mismatch).
   Em geral, **prefira a opção 1 (coluna nativa)** e faça o fallback em código Pascal.

3. **Coluna só para uma tela →** usar um **TFDQuery separado com campos dinâmicos** (sem
   fields persistentes) selecionando exatamente as colunas daquela tela.

**Leitura defensiva:** no loop de render, ler com `FindField` (nil → `''`) em vez de
`FieldByName` evita que um eventual campo ausente derrube/trave a tela.

## Como reconhecer rápido

- Erro `Field 'X' not found` **com** registros carregando normalmente (o `Open` não
  quebrou) ⇒ dataset tem fields persistentes e X não é um deles.
- Erro `no such column: X` (SQLite) / `column unknown` (Firebird) ⇒ aí sim a coluna não
  existe na tabela; problema diferente.
