# Horse + FireDAC: conexão POR REQUISIÇÃO, nunca singleton

## O sintoma

Num servidor Horse, sob **duas ou mais requisições simultâneas**, começam a
aparecer erros que não têm relação óbvia entre si:

```
Access violation at address XXXXXXXX. Read of address 00000000
[FireDAC][Phys][FB]invalid transaction handle (expecting explicit transaction start)
List index out of bounds (4).  TList<System.Pointer> range is 0..3
```

O detalhe que engana: **depois do primeiro erro, a conexão fica corrompida** e
até requisições **sequenciais** passam a devolver 500. Parece que "o servidor
caiu", quando na verdade foi uma corrida.

## A causa

Um helper de conexão implementado como singleton:

```pascal
type
  TConnection = class
    private
      class var FConnection: IADRConnection;   // <-- compartilhado
    public
      class function Connection: IADRConnection;
  end;
```

O Horse atende requisições em **threads paralelas**. Um `TFDConnection` (e o
`IADRConnection` que o embrulha) **não é thread-safe**: duas threads mexendo na
mesma conexão corrompem as listas internas do FireDAC — daí o
`List index out of bounds` vindo de dentro da própria RTL.

## A correção

Devolver uma conexão **nova a cada chamada**:

```pascal
class function TConnection.Connection: IADRConnection;
begin
  Result := ADRConn.Model.Interfaces.CreateConnection;
  Result
    .Params
      .Driver(LDriver)
      .Database(TSettings.Database)
      // ...
      ;
  Result.Connect;
end;
```

Como é interface, cada requisição libera a sua no fim do escopo. Para volume
maior, o passo seguinte é um **pool** — mas nunca uma instância global.

## Como isso passa despercebido

Testar a API com `curl` ou Postman é **sequencial**: nunca dispara a corrida.
O bug só aparece quando um cliente real faz requisições em paralelo — por
exemplo, uma tela de catálogo que baixa **uma miniatura por produto** ao mesmo
tempo. Vale ter no teste automatizado um caso que dispare N requisições em
paralelo (`TParallel.For`) e, logo depois, verifique que o servidor **continua
respondendo** — é o segundo cheque que pega a corrupção persistente.

## Dois anti-padrões vizinhos, na mesma unit

```pascal
  finally
    FConnection.Disconnect;   // desconecta o que acabou de conectar
  end;
```

Um `finally Disconnect` logo após o `Connect` devolve ao chamador uma conexão
fechada. Costuma "funcionar" porque algo reconecta adiante — e mascara a causa
quando falha.

```pascal
  case AnsiIndexStr(TSettings.DriverID, CDriverDB) of
    0: LDriver := adrFirebird;
    1: LDriver := adrPostgres;
  end;                        // sem ELSE
```

Um `case` sem `else` sobre valor vindo de `.ini`: driver desconhecido deixa a
variável **sem valor** e a conexão é montada com lixo, falhando de forma
incompreensível. Sempre `else raise` com mensagem dizendo o que é aceito.

## Relacionado

- [horse-linux-docker-firebird.md](horse-linux-docker-firebird.md)
- [firedac-console-firebird.md](firedac-console-firebird.md)
- [adrconnection-query-builder.md](adrconnection-query-builder.md)
- [fmx-automacao-windows-sem-foco.md](fmx-automacao-windows-sem-foco.md) — como automatizar o cliente que expõe esse tipo de corrida
