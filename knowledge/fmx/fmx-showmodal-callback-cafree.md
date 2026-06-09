# [FMX] Callback de `ShowModal` com `caFree` — diferir ação com `TThread.ForceQueue`

## Sintoma

Um form modal FMX é exibido com a sobrecarga assíncrona `ShowModal(procedure(AResult: TModalResult))` e fecha-se com `Action := caFree` no `OnClose`. Dentro do callback, ao **abrir outro diálogo** (TMultiDialog4FMX, TDialogService, outro ShowModal) ou **navegar** (Router4D `Link.To`/`GoBack`), **nada acontece**: a ação é engolida silenciosamente. O código aparenta rodar (até grava no banco), mas a UI seguinte não aparece e o fluxo "volta para a tela anterior".

Caso real (PDV): teclado numérico modal `TViewTeclado.MostrarPin(...)`. No callback, validar a senha e abrir o diálogo de "Relatório Z" / mostrar erro / navegar para o login — tudo falhava. A gravação acontecia, mas o diálogo de confirmação e o logout não.

## Causa

Quando o callback do `ShowModal` executa, o form modal ainda está **em processo de destruição** (`caFree` agendou o `Free`). Nesse instante o `Screen.ActiveForm` aponta para o form que está morrendo e o loop modal ainda não devolveu o controle. Abrir um novo overlay/modal ou trocar a rota nesse contexto transitório não tem efeito (o novo diálogo tenta se ancorar no form que vai sumir).

## Correção — `TThread.ForceQueue`

Diferir a execução do callback para o **próximo ciclo de mensagens**, quando o teclado já sumiu e o `ActiveForm` voltou a ser o form chamador:

```pascal
LForm.ShowModal(
  procedure(AResult: TModalResult)
  var
    LConfirm: TProc<Currency>;
  begin
    LConfirm := AOnConfirm;            // captura antes de sair do escopo
    TThread.ForceQueue(nil,           // roda no main thread no proximo ciclo
      procedure
      begin
        if AResult = mrOk then
          if Assigned(LConfirm) then LConfirm(LValor);
      end);
  end
);
```

`TThread.ForceQueue(nil, proc)` (Delphi 10.2+) agenda `proc` no thread principal sem precisar de um signaler — ideal aqui. Difere de `TThread.Queue`, que exige um `TThread`.

## Onde aplicar

A correção é melhor **centralizada no próprio form modal reutilizável** (envolver a invocação do callback do usuário em `ForceQueue` dentro do `Mostrar`/`MostrarPin`), e não em cada tela chamadora — assim todos os fluxos (informar valor, PIN de supervisor, etc.) ficam corrigidos de uma vez.

## Anti-padrão relacionado

Não tente contornar abrindo o diálogo com `Application.ProcessMessages` antes — é frágil e reentrante. `ForceQueue` é a forma idiomática. Também não mova a lógica para `OnClose`: ali o `ModalResult` e o estado do resultado podem ainda não estar consolidados.
