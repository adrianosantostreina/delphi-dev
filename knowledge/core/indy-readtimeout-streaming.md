# Indy `ReadTimeout` em cliente de streaming (WebSocket): trocar para infinito após o handshake

Num cliente que faz um **handshake e depois fica lendo um stream** (WebSocket,
long-polling, protocolos persistentes) sobre `TIdTCPClient`, o `ReadTimeout`
definido para proteger o **handshake** continua valendo na **fase de leitura**.
Se a conexão fica **ociosa de propósito** (normal num WebSocket entre
mensagens), depois do timeout o Indy lança `EIdReadTimeout` e a thread de
leitura trata como erro fatal → a conexão **cai sozinha**.

## Sintoma

App conecta, troca mensagens, e segundos depois (ex.: 5s) cai com:

```
[erro] Read timed out.   // EIdReadTimeout
```

…mesmo com tudo funcionando — o erro dispara **na ociosidade**, não numa falha real.

## Causa

```pascal
FTCP.ReadTimeout := 5000;   // bom para o handshake nao travar
FTCP.Connect;
// ... handshake (ReadLn das linhas de resposta) ...
// PROBLEMA: esse 5000ms continua valendo no loop de leitura de frames
```

## Correção

Manter o timeout finito só para o handshake e, **assim que o handshake
conclui**, trocar para infinito antes de iniciar a thread de leitura:

```pascal
uses IdGlobal;  // IdTimeoutInfinite
// ...apos validar o handshake, antes de subir a thread de leitura:
FTCP.ReadTimeout := IdTimeoutInfinite;  // bloqueia esperando frames sem cair
```

A thread de leitura passa a bloquear indefinidamente esperando dados. O
encerramento limpo continua funcionando: `FTCP.Disconnect` (no teardown)
desbloqueia o read pendente lançando exceção, e o `WaitFor` faz o join.

## Relacionado

- Detecção de "conexão morta" com timeout infinito exige **keepalive de
  aplicação** (ping/pong WebSocket), não o `ReadTimeout`.
- `Socket Error #10053 / #10054` no **servidor** quando o cliente fecha é
  esperado/benigno (peer foi embora) — apenas logar, não é falha.
