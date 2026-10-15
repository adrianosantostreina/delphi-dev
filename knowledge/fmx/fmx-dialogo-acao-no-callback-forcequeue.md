# [FMX] Ação no callback de um diálogo: adiar com `TThread.ForceQueue`

## Sintoma

Diálogo de confirmação (ex.: MultiDialog4FMX, ou outro diálogo FMX desenhado, não nativo)
com um botão cujo callback **faz o trabalho e abre outro diálogo** ("Pedido cancelado").
Tudo parece funcionar: a ação acontece e o segundo diálogo aparece e fecha. Mas depois
disso **um botão da tela (o Voltar da toolbar) para de responder** até trocar de tela. Os
outros botões continuam funcionando, o que torna o defeito difícil de enxergar.

Visto no Android (emulador) em 2026-10-02, no TMV30, com MultiDialog4FMX v1.4.2.

## Causa

O callback roda **dentro** do evento de clique do botão do primeiro diálogo, antes de ele
terminar de fechar e de desmontar o overlay e a captura de toque. Abrir um segundo diálogo
nesse meio tempo (ou navegar, ou recarregar a tela) intercala dois ciclos de vida de
diálogo. O estado de foco/captura da tela fica inconsistente.

## Correção

Não executar a ação dentro do clique: enfileirar para depois que o diálogo terminar.

```pascal
.AddButton(ATextoSim,
  procedure
  begin
    TThread.ForceQueue(nil,
      procedure
      begin
        ASeSim();   // a ação de verdade (pode abrir outro diálogo, navegar...)
      end);
  end,
  TAlphaColorRec.Null, 'BtnRedLight')
```

`ForceQueue` (e não `Queue`) porque o callback já está na main thread: `TThread.Queue`
chamado da própria main thread executa **na hora**, o que não resolveria nada.
`ForceQueue` sempre posterga para o próximo ciclo da fila de mensagens.

## Regra

Em fachada de diálogo (`TDialogo.Confirmar` etc.), aplicar o `ForceQueue` **dentro da
fachada**, uma vez só, para que nenhuma tela precise lembrar disso.

Relacionado: [fmx-showmodal-callback-cafree.md](fmx-showmodal-callback-cafree.md).
