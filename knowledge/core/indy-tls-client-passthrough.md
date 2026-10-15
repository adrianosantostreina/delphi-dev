# Cliente TLS com Indy: `PassThrough := False` (wss/https)

**Sintoma:** um cliente TLS feito sobre `TIdTCPClient` + `TIdSSLIOHandlerSocketOpenSSL` **conecta mas
envia tudo em texto puro** (não cifra). O servidor TLS rejeita o handshake. Erros observados, conforme
o proxy/servidor:
- num listener OpenSSL: `SSL routines:tls_validate_record_header:http request` (recebeu HTTP em claro
  onde esperava um ClientHello TLS);
- atrás de Traefik/nginx: `404 Not Found` ou `301 Moved Permanently` (o servidor responde em claro porque
  o cliente falou HTTP puro na porta 443).

## Causa

No Indy, `TIdSSLIOHandlerSocketOpenSSL.PassThrough` vem **`True` por padrão**. `PassThrough = True`
significa "passa sem cifrar" — o modo usado por protocolos **STARTTLS** (conecta em claro e só depois
sobe pra TLS). Para **TLS imediato** (wss/https), é **obrigatório** `PassThrough := False` **ANTES** do
`Connect`; senão o Indy abre o socket e **não faz o handshake TLS**, mandando os bytes em claro.

## Correção

```pascal
LIO := TIdSSLIOHandlerSocketOpenSSL.Create(FTCP);
LIO.SSLOptions.Mode := sslmClient;
LIO.SSLOptions.SSLVersions := [sslvTLSv1_2];   // 1.2 basta; OpenSSL 1.0.2 NÃO tem 1.3
LIO.SSLOptions.VerifyMode := [];               // demo: não valida cadeia (em produção, configurar)
LIO.PassThrough := False;                      // <<< ESSENCIAL: ativa o TLS no Connect
FTCP.IOHandler := LIO;
FTCP.Connect;                                  // agora faz o handshake TLS de verdade
```

`uses` precisa de `IdSSLOpenSSL`.

## Pontos relacionados

- **DLLs OpenSSL no Windows:** o `.exe` precisa de `libeay32.dll` + `libssl... ` — para o Indy clássico,
  o par **`libeay32.dll` + `ssleay32.dll`** (OpenSSL 1.0.2) ao lado do binário. Sem elas, o `Connect`
  lança `Could not load SSL library` (exceção, diferente do caso "manda em claro"). No **Android**, o
  análogo é empacotar `libcrypto.so`/`libssl.so` no APK — ver [[indy-openssl-android]].
- **URL `wss://`:** ao fazer o parse da URL, tratar o esquema `wss://` (porta padrão **443**) além de
  `ws://` (porta **80**). Um parser que só reconhece `ws://` quebra com `wss://` (extrai host errado,
  ex.: host vira `"wss"` → `Host not found`).
- **Host header / path:** atrás de reverse proxy com roteamento por `Host(...) && PathPrefix(/x)`, enviar
  `Host: <dominio>` (porta default pode ser omitida) e o **path correto** (`GET /x HTTP/1.1`). Um log no
  Delphi mostra a variável *pretendida*; para ver o que vai **no fio**, capturar com um listener
  (TCP puro pra ws://, ou TLS com cert self-signed pra wss:// — funciona porque `VerifyMode := []`).
- **ReadTimeout no loop de leitura:** ver [[indy-readtimeout-streaming]] (trocar para `IdTimeoutInfinite`
  após o handshake).
