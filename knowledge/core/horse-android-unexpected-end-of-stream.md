# Horse + app Android: "unexpected end of stream" e requisição com status 0 (de vez em quando)

## Sintoma

App FMX no Android chama a API Horse em sequência (login e logo depois a lista). Na maioria das
vezes funciona. Às vezes a segunda chamada volta com **`StatusCode = 0` e corpo vazio**, sem exceção
no Delphi. A tela fica vazia (lista sem itens, "Lotação: 00") ou um `DataSetAdapter` deixa o memtable
**fechado** e o próximo acesso dá `Cannot perform this operation on a closed dataset`.

No logcat:

```
W System.err: java.net.ProtocolException: unexpected end of stream
W System.err:   at com.android.okhttp.internal.http.Http1xStream$FixedLengthSource.read(...)
```

No Windows nunca acontece. No Android piora quando o usuário toca duas vezes seguidas (o tempo
entre as requisições muda e cai na janela).

## Causa

Por padrão o Horse (provider console, Indy) responde com **`Connection: close`** e fecha o socket
logo depois de responder. O cliente HTTP do Android (okhttp, por baixo do `THTTPClient`) às vezes
lê o corpo de uma conexão que o Indy já está derrubando e recebe menos bytes que o `Content-Length`.

Confira com:

```bash
curl -s -D - -o /dev/null http://localhost:3000/version | grep -i connection   # Connection: close
```

## Correção

No servidor, antes do `Listen`:

```pascal
THorse.KeepConnectionAlive := True;   // responde Connection: keep-alive
```

Medido: 10 de 10 logins seguidos de toque duplo no emulador sem nenhum `unexpected end of stream`
(antes: 2 a 3 falhas em cada 8).

No app, não confie em lista vazia: cheque o `StatusCode` e levante um erro claro quando não for
200, senão uma falha de rede aparece como "não há registros".

Visto em: Horse 3.0.2 (console, Indy), Delphi 13, Android 16 (emulador), 2026-10-06.
