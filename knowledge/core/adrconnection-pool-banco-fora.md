# ADRConnection pool: banco fora do ar vira Access Violation no controller

Validado 2026-10-01 (Horse + ADRConnection.Pool, Win32).

## Sintoma

Com o Firebird fora (ou porta/caminho errado no `.ini`), a rota responde
`500 Internal Application Error` ou `Access violation ... Read of address
00000000` -- nada que aponte para o banco.

## Causa

`GetPoolItem` (`TryGetItem`) falha de DOIS jeitos diferentes:

1. **1a chamada:** o `Connect` dentro de `OnGetConnection` levanta, e o item
   volta `nil`. `LItem.Acquire` -> AV; e o `LItem.Release` costuma estar FORA
   do `try` -> segunda AV, nao tratada.
2. **Chamadas seguintes:** volta um item VALIDO com `Connection = nil`. Checar
   so `Assigned(LItem)` nao basta.

## Correcao (no controller, sem tocar na lib)

```pascal
function TController.ObterItemPool(out AItem: TPoolItem<TADRConnectionPoolItem>;
  out AConexao: IADRConnection): Boolean;
begin
  AConexao := nil;
  try
    AItem := GetPoolItem;
    if Assigned(AItem) then
    begin
      AConexao := AItem.Acquire.Connection;
      if not Assigned(AConexao) then
      begin
        AItem.Release;
        AItem := nil;
      end;
    end;
  except
    AItem := nil;
    AConexao := nil;
  end;
  Result := Assigned(AConexao);
  if not Result then
    SendError(503, 'Banco de dados indisponivel...');
end;
```

Handler: `if not ObterItemPool(LItem, LConexao) then Exit;` antes de alocar
qualquer coisa; usar `LConexao` no DAO; `LItem.Release` no fim.

## Como reproduzir sem derrubar o banco de quem esta trabalhando

Copie o executavel + `.ini` para outra pasta, aponte `PortDB` para uma porta
sem servidor e `PortAPI` para outra porta, e chame a rota duas vezes (o caso 2
so aparece na segunda chamada).

## Relacionado
- [adrconnection-query-builder.md](adrconnection-query-builder.md)
- [firedac-linux-libfbclient-symlink.md](firedac-linux-libfbclient-symlink.md) -- outro caso em que o pool mascara erro de banco como AV
