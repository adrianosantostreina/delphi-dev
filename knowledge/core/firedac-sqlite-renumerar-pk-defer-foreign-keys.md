# FireDAC + SQLite: renumerar PK com filhos → `PRAGMA defer_foreign_keys`

## Contexto

App offline-first: registro criado sem rede nasce com **ID temporário negativo** (`-1`,
`-2`...). Quando sobe, o servidor devolve o ID real e o app precisa **trocar o ID** na
própria linha e em todas as filhas (endereço → cliente, pedido → cliente...).

## Sintoma

As FKs do SQLite local (`REFERENCES TB_PESSOA(PES_ID)`) não têm `ON UPDATE CASCADE`, e o
FireDAC abre o SQLite com `foreign_keys` ligado. Qualquer ordem dá erro de FK no meio do
caminho:

- trocar o pai primeiro: os filhos ficam apontando para um ID que não existe mais;
- trocar os filhos primeiro: eles apontam para um ID que ainda não existe.

## Correção

Adiar a checagem de FK para o `COMMIT`, numa transação só:

```pascal
TConnection.Connection.StartTransaction;
try
  CreateQuery(TConnection.Connection).SQL('PRAGMA defer_foreign_keys = ON').ExecSQL;

  // filhos
  CreateQuery(TConnection.Connection)
    .SQL('UPDATE TB_ENDERECO SET END_ID_PESSOA = :pNovo WHERE END_ID_PESSOA = :pAntigo')
    .ParamAsInteger('pNovo', ANovo).ParamAsInteger('pAntigo', AAntigo).ExecSQL;
  // ... demais filhas ...

  // pai
  CreateQuery(TConnection.Connection)
    .SQL('UPDATE TB_PESSOA SET PES_ID = :pNovo WHERE PES_ID = :pAntigo')
    .ParamAsInteger('pNovo', ANovo).ParamAsInteger('pAntigo', AAntigo).ExecSQL;

  TConnection.Connection.Commit;   // a checagem de FK acontece aqui
except
  TConnection.Connection.Rollback;
  raise;
end;
```

- `defer_foreign_keys` vale só para a transação corrente e volta a OFF sozinho no
  `COMMIT`/`ROLLBACK`. Precisa de SQLite 3.8.0 ou superior (o do FireDAC atende).
- **Caso a tratar:** a linha com o ID real **já existir** (o sincronismo baixou o
  registro do servidor antes da troca). Aí, em vez de renumerar o pai, **apague a linha
  temporária** depois de mover os filhos. Senão ficam duas.
- Faça a troca com o mesmo lock da conexão usada pelo sincronismo em thread.

Visto no TMV30 (Sprint 9, 2026-10-02): `TDAOCadastro.TrocarID`.
