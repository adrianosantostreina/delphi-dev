# DataSet-Serialize: número com casa decimal em campo inteiro vira 0 (e pode zerar a chave)

## Sintoma

Um `PUT` que só devia marcar uma mesa como ocupada faz o registro **sumir das listas**. No banco, a
linha está lá, com `ID = 0`, `NUM_MESA = 0` e `OCUPADA = 0`. O servidor respondeu 201, sem erro no log.

O cliente mandou:

```json
{"ID":7.0,"NUM_MESA":7.0,"OCUPADA":1.0}
```

e o servidor fez `LDataSet.MergeFromJSONObject(Req.Body)` num `SELECT ... WHERE ID = :id`.

## Causa

Duas metades, uma em cada ponta:

1. **Cliente.** Um `TFDMemTable` preenchido por `DataSetAdapter`/`LoadFromJSON` **sem campos
   persistentes** cria os campos numéricos como `ftFloat`. Depois, `ToJSONObject`/`ToJSONObjectString`
   exporta `7` como `7.0`.
2. **Servidor.** No import (`MergeFromJSONObject`, `LoadFromJSON`) o DataSet-Serialize converte campo
   inteiro com `StrToIntDef(LJSONValue.Value, 0)` (`DataSet.Serialize.Import.pas`). `"7.0"` não é um
   inteiro válido, então vira **0 em silêncio**. Isso vale para todos os campos inteiros do JSON,
   **inclusive a chave primária**. Se não houver outro registro com ID 0, o UPDATE passa.

A mesma coisa acontece com qualquer número em notação decimal (`1.0`, `1e0`) num campo
`ftInteger`/`ftSmallint`/`ftLargeint`.

## Correção

No servidor, que é onde vale a pena blindar:

- **Não deixe o body alterar a chave.** O ID vem da rota. Antes do merge, tire o par `"ID"` do JSON
  (`TJSONObject(LJSON).RemovePair('ID').Free`) e faça o merge com `LJSON.ToJSON`.
- **Para campo de estado, prefira UPDATE explícito a merge genérico.** Leia com
  `TryGetValue<Double>` (aceita `1` e `1.0`), converta e grave com parâmetro:

```pascal
if not (Assigned(LJSON) and LJSON.TryGetValue<Double>('OCUPADA', LOcupada)) then
  raise EHorseException.New.Status(THTTPStatus.BadRequest).Error('Envie {"OCUPADA": 0 ou 1}.');

FQuery
  .SQL('UPDATE MESA SET OCUPADA = :pOCUPADA WHERE ID = :pID')
  .ParamAsInteger('pOCUPADA', Ord(Round(LOcupada) <> 0))
  .ParamAsInteger('pID', AID)
  .ExecSQL;
```

No cliente, mande só o que muda, montado à mão (`'{"OCUPADA":1}'`), ou crie **campos persistentes**
(`TIntegerField`) no memtable para o export sair inteiro.

## Como achar

Coloque o corpo da requisição no log do Horse: placeholder `${request_content}` no
`SetLogFormat` do `horse-logger`. O `7.0` aparece na hora.

Um teste que trava a regressão (bash + curl):

```bash
curl -X PUT -d '{"ID":6.0,"NUM_MESA":6.0,"OCUPADA":1.0}' localhost:9000/mesas/6   # deve manter ID 6
curl -X PUT -d '{"ID":99,"OCUPADA":0}' localhost:9000/mesas/6                    # nao pode virar 99
```

Visto em: CEM 3.0 (Servidor Horse + app Garçom FMX), DataSet-Serialize 2.3.x, 2026-10-06.
