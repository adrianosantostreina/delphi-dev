# FireDAC + Firebird: `GetLastAutoGenValue('GEN_X')` devolve o ID de OUTRA conexão

## Sintoma

API Horse que insere com `LoadFromJSON`/`Append+Post` e devolve o registro criado assim:

```pascal
LDataSet.LoadFromJSON(AValue);   // INSERT; a trigger BEFORE INSERT pega GEN_ID(GEN_PEDIDO_ID, 1)
LID := TFDQuery(LDataSet).Connection.GetLastAutoGenValue('GEN_PEDIDO_ID');
Result := Find(LID);
```

Com um usuário só, funciona sempre. Com dois ou mais ao mesmo tempo, o `POST` volta com o
registro **de outro cliente**. O app guarda esse ID e passa a gravar os filhos (itens) no pai errado.
Medido: 20 `POST /pedidos` simultâneos → **19** respostas com o pedido de outra requisição.

## Causa

Com o nome de um generator, o `GetLastAutoGenValue` do driver Firebird lê o **valor corrente
global** do generator (`GEN_ID(gen, 0)`), e não "o último gerado nesta conexão". O Firebird não
tem um `LAST_INSERT_ID` por sessão. Entre o INSERT e a leitura, qualquer outra conexão que inseriu
já moveu o generator.

## Correção

Reservar o ID **antes** do insert com `GEN_ID(gen, 1)`, que é atômico (cada chamada recebe um
número só seu), gravar com esse ID e devolver o registro por ele. A trigger `IF (NEW.ID IS NULL OR
NEW.ID <= 0)` respeita o ID que já vem preenchido.

```pascal
function ProximoID(AQuery: IADRQuery; const AGenerator: string): Integer;
var
  LDataSet : TDataSet;
begin
  LDataSet := AQuery.SQL(Format('SELECT GEN_ID(%s, 1) AS ID FROM RDB$DATABASE', [AGenerator])).OpenDataSet;
  try
    Result := LDataSet.FieldByName('ID').AsInteger;
  finally
    LDataSet.Free;
  end;
end;

LID := ProximoID(FQuery, 'GEN_PEDIDO_ID');
LDataSet.LoadFromJSON(JSONComID(AValue, LID));   // troca o "ID" do body pelo reservado
Result := Find(LID);
```

Alternativa equivalente: `INSERT ... RETURNING ID` (ver
[adrconnection-query-builder.md](adrconnection-query-builder.md)), quando o insert é SQL explícito.

**Não funcionou** (testado): `UpdateOptions.GeneratorName` + `AutoIncFields := 'ID'` no `TFDQuery`
antes do `LoadFromJSON`. O insert passou a falhar (exceção engolida pelo DAO → 204).

## Como pegar antes de ir para produção

Teste de concorrência com curl em paralelo, conferindo que cada resposta é a do próprio pedido:

```bash
for i in $(seq 1 20); do
  curl -s -X POST -d "{\"ID\":-1,\"NOME_CLIENTE\":\"RACE $i\"}" localhost:9000/pedidos > r_$i.txt &
done; wait
for i in $(seq 1 20); do grep -q "\"RACE $i\"" r_$i.txt || echo "errado: $i"; done
```

Visto em: CEM 3.0 (Servidor Horse + ADRConnection + Firebird 5), 2026-10-06. O código vinha do 2.0,
onde nunca foi testado com dois garçons ao mesmo tempo.
