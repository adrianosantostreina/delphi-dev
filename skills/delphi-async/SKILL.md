---
name: delphi-async
description: >
  Especialista em programação assíncrona Delphi. Auto-ativa quando detectar:
  TTask, TParallel, IFuture, TThread, Synchronize, Queue, TMonitor, TEvent,
  TCriticalSection, "thread", "assíncrono", "background", "worker", "parallel".
---

# Delphi Async

## Idioma de saída
Detecte o idioma da primeira mensagem. Padrão: pt-BR. Respeite overrides explícitos.

## Referência completa
Consulte `knowledge/core/delphi-async.md` para padrões detalhados.

## Padrão TTask (preferido sobre TThread)

```delphi
procedure TRelatorioService.GerarRelatorioAsync(
  AOnConcluido: TProc<TRelatorio>);
begin
  TTask.Run(
    procedure
    var
      LRelatorio: TRelatorio;
    begin
      LRelatorio := GerarRelatorio; // trabalho pesado na thread background

      TThread.Synchronize(nil, // retorna para a thread principal
        procedure
        begin
          AOnConcluido(LRelatorio);
        end);
    end);
end;
```

## Synchronize vs Queue

| | `Synchronize` | `Queue` |
|--|--|--|
| Bloqueia? | Sim — aguarda a UI executar | Não — dispara e esquece |
| Quando usar | Preciso do resultado na UI antes de continuar | Notificação, atualização de progresso |

## Cancelamento com TTask

```delphi
var LTask: ITask;
LTask := TTask.Run(
  procedure
  begin
    while not (LTask.Status = TTaskStatus.Canceled) do
    begin
      // trabalho...
      TTask.CurrentTask.CheckCanceled; // lança EOperationCancelled se cancelado
    end;
  end);

// Para cancelar:
LTask.Cancel;
```

## Regras
- **Nunca acessar VCL/FMX fora da thread principal** — sempre via `Synchronize` ou `Queue`
- **TCriticalSection** para proteção de recursos compartilhados — sempre `try/finally`
- **TMonitor** para sincronização mais granular (Delphi XE2+)
- **IFuture<T>** quando precisa do resultado da task

## Armadilha: captura de variáveis locais

```delphi
// ERRADO — LId é capturado por referência, pode ter mudado quando a task roda
for LId in LIds do
  TTask.Run(procedure begin ProcessarId(LId); end);

// CORRETO — captura por valor via variável local
for LId in LIds do
begin
  LIdLocal := LId; // cópia local
  TTask.Run(procedure begin ProcessarId(LIdLocal); end);
end;
```
