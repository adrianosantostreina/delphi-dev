# ADRConnection — IADRQuery: comportamento do builder SQL

## Como funciona o acúmulo de SQL

`FQuery.SQL(fragment)` **sempre APPEND** ao buffer interno (`FSQL: TStrings`). Nunca reseta.

```pascal
FQuery.SQL('select t.*')
      .SQL('from tabela t')
      .SQL('where t.id = :id')
      .ParamAsInteger('id', 1)
      .OpenDataSet;
```

Após cada operação (`.Open`, `.OpenDataSet`, `.ExecSQL`, `.ExecSQLAndCommit`), o buffer é limpo automaticamente em `finally`:
```pascal
FSQL.Clear;
FParams.Clear;
```

**Consequência:** sempre que escrever um método DAO que monta SQL em partes, chamar as partes de base (ex: `Select`) ANTES de chamar `.OpenDataSet` na mesma chamada do método. Se `Select` e a cláusula extra forem chamadas em chamadas separadas de `FQuery.SQL(...)` (não encadeadas), funciona porque ambas fazem `FSQL.Add`.

## .Open vs .OpenDataSet

| Método | Onde executa | Como ler resultado |
|---|---|---|
| `.Open` | No `FDQuery` interno (singleton do DAO) | `FQuery.DataSet.FieldByName(...)` após a chamada |
| `.OpenDataSet` | Cria um `TFDQuery` temporário | Retorna `TDataSet` — **chamar `Free` após uso** |

## Lendo RETURNING após INSERT (Firebird)

```pascal
FQuery
  .SQL('insert into tabela (campo) values (:campo)')
  .SQL('returning id')
  .ParamAsInteger('campo', valor)
  .Open;                                          // executa
AEntidade.Id := FQuery.DataSet.FieldByName('id').AsInteger;  // lê o retorno
```

`FQuery.DataSet` expõe o `FDQuery` interno. Após `.Open`, ele contém o resultado do `RETURNING`. Não chamar `FQuery.DataSet.Free` — o `FDQuery` é de propriedade do DAO.

## Armadilha: Select sem encadeamento

```pascal
// ERRADO — Select é chamado mas depois FQuery.SQL('where...') é nova chamada
// No contexto correto (FSQL acumula), funciona:
procedure TDao.BuscaPorId(AId: Integer): TEntidade;
begin
  Select;                                    // adiciona SELECT...FROM ao FSQL
  LDataSet := FQuery
    .SQL('where t.id = :id')               // adiciona WHERE ao mesmo FSQL
    .ParamAsInteger('id', AId)
    .OpenDataSet;                           // executa tudo, limpa FSQL
  ...
end;
```

Se `Select` não for chamado, a query começa com `where ...` → Firebird lança `Token unknown - line 1, column 1 - where`.
