# Programação Assíncrona em Delphi

## TTask vs TThread

Preferir `TTask` (PPL — Parallel Programming Library) sobre `TThread` herdado.
`TTask` gerencia um pool de threads automaticamente; `TThread` cria uma thread por instância.

## Captura de variáveis em closures

```delphi
// PROBLEMA: LId muda no loop antes da task executar
for LId in LIds do
  TTask.Run(procedure begin ProcessarId(LId); end);

// CORRETO: capturar por valor antes da task
for LId in LIds do
begin
  LCapturado := LId; // cópia local capturada pela closure
  TTask.Run(procedure begin ProcessarId(LCapturado); end);
end;
```

## Synchronize vs Queue

- `Synchronize` — bloqueia a background thread até a UI thread executar o bloco → usar quando precisa do resultado antes de continuar
- `Queue` — enfileira sem bloquear → usar para notificações de progresso

## IFuture<T> — resultado de task

```delphi
var LFutura: IFuture<TRelatorio>;
LFutura := TTask.Future<TRelatorio>(
  function: TRelatorio
  begin
    Result := GerarRelatorio; // executa em background
  end);

// ... faz outra coisa ...
LRelatorio := LFutura.Value; // bloqueia aqui se ainda não terminou
```

## TCriticalSection — proteção de estado compartilhado

```delphi
var FLock: TCriticalSection;
// No construtor:
FLock := TCriticalSection.Create;
// No destructor:
FLock.Free;
// No acesso ao recurso:
FLock.Enter;
try
  // acesso exclusivo ao recurso
finally
  FLock.Leave;
end;
```
