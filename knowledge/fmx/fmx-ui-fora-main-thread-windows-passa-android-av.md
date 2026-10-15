# FMX: tela montada dentro de thread "funciona" no Windows e dá Access Violation no Android

## Sintoma

Carga de lista feita com `TThread.CreateAnonymousThread` (ou um helper tipo `CustomThread(AOnStart,
AOnProcess, AOnComplete)`) funciona no Windows há anos. No Android, logo depois de abrir a tela:

```
Access violation at address 0000..., accessing address 0000000000000000
```

seguido de `Duplicates not allowed` (a segunda carga encontra a primeira pela metade). Às vezes a
tela fica sem pintar partes.

## Causa

Dentro do `AOnProcess` (que roda na thread de fundo) o código mexia direto em componentes:
`Label.Text := ...`, `ListBox.ItemHeight := ...`, `ItemModelo.Visible := False`, leitura de
`ListBox.ClientWidth`, `Clone` de itens. Só o pedaço do `Clone` estava num `Synchronize`. VCL/FMX
não são thread-safe; no Windows a corrida raramente aparece, no Android ela aparece na primeira vez.

## Correção

Na thread fica **só** o que é lento e não toca tela (a chamada REST que enche o memtable). Todo o
resto vai para um único `Synchronize`:

```pascal
CustomThread(
  procedure begin TLoading.Show('Carregando...'); end,          // main thread
  procedure
  begin
    ServiceMesas.ListarMesas;                                   // thread: REST
    TThread.Synchronize(nil, procedure begin MontarMesas; end); // main thread: tela
  end,
  procedure begin TLoading.Hide; end, ...);
```

Se o corpo antigo tiver `TThread.Synchronize`/`TThread.Queue` internos, pode deixá-los: chamados da
main thread eles executam na hora.

Também vale trocar o `AOnError` vazio por `ShowMessage(...)`: com o except vazio a falha some e só
se vê a tela incompleta.

Relacionado: [fmx-android-rest-sincrono-anr.md](fmx-android-rest-sincrono-anr.md) (o oposto: REST na
main thread). Visto em: Delphi 13, Android 16, app Garçom do CEM 3.0, 2026-10-06.
