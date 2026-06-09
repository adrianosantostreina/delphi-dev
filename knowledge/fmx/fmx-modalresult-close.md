# [FMX] ShowModal: Close() sobrescreve o ModalResult -> callback recebe mrCancel

## Sintoma

Um form modal aberto com `ShowModal(callback)` conclui com sucesso (logs internos
confirmam), mas o `callback(AModalResult)` recebe `mrCancel`/`mrAbort` em vez do
`mrOk` que voce atribuiu. O chamador entao acha que o usuario cancelou / a operacao
falhou.

## Causa

No FMX, **atribuir `ModalResult` a um valor `<> mrNone` JA encerra o ShowModal** e
dispara o callback com aquele valor. Se depois disso voce ainda chamar `Close`,
o `Close` reabre o caminho de fechamento e **sobrescreve o `ModalResult` para
`mrCancel`** — entao o callback recebe `mrCancel`.

```pascal
// ERRADO — Close sobrescreve mrOk por mrCancel
ModalResult := mrOk;
Close;            // <-- callback recebe mrCancel

// CERTO — so atribuir ModalResult (ja fecha o modal)
ModalResult := mrOk;
```

## Regra

Em form modal (`ShowModal`), feche atribuindo **apenas** `ModalResult`. Nao chame
`Close` em seguida. Use `Close` para fechar form modal apenas quando NAO setou
`ModalResult` (e nesse caso o resultado sera `mrCancel`).

Caso real: tela de sincronismo do PDV exibia "Nao foi possivel sincronizar" mesmo
apos o SyncAll concluir com sucesso (0 pendentes) — porque `Finalizar` fazia
`ModalResult := mrOk; Close;`.

## Relacionado
- [fmx-showmodal-callback-cafree.md](fmx-showmodal-callback-cafree.md) — diferir navegacao/dialogo de dentro do callback com `TThread.ForceQueue`
