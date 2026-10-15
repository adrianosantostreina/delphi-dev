# RESTRequest4D — o `Timeout` real é maior que o pedido

**Sintoma:** você põe `.Timeout(5000)` esperando que a chamada desista em 5 s, mas ela só desiste em
**~8 s** (`ERESTException: Error receiving data: (12002) O tempo limite da operação foi atingido`).
Qualquer espera calculada "com folga" sobre os 5 s (fechar o app esperando a thread, watchdog) estoura.

**Medido (Delphi 13, Win32, motor padrão `TRESTClient`/WinHTTP, servidor que aceita a conexão e não
responde):**

| `.Timeout(ms)` | desistiu em |
|---|---|
| 5000 | ~8.000 ms |
| 2500 | ~4.000 ms |

Ou seja, **~1,6× o valor**. `TRequestClient.Timeout` só repassa para `TRESTRequest.Timeout`; o tempo
efetivo depende de como o WinHTTP aplica conexão + recebimento.

**Como lidar**
- Dimensione pelo tempo **medido**, não pelo número passado: quer ~4 s? use `Timeout(2500)`.
- Quem espera a thread (ex.: `Destroy` que bombeia `CheckSynchronize` até a rodada terminar) precisa de
  limite **maior** que o tempo real (ex.: 8 s de espera para `Timeout(2500)`).
- Para medir no seu ambiente: servidor Python que dorme 20 s no `do_GET` + console com `TStopwatch`.

Caso real: CEM 3.0 (Cozinha) — fechar a janela com o monitor atualizando travava 8 s porque a espera
do `Destroy` (8 s) empatava com o timeout real de `Timeout(5000)`.
