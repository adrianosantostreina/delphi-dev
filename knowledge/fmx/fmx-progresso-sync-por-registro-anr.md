# [FMX/Android] `TThread.Synchronize` por registro em loop de worker = ANR

## Sintoma

Uma rotina em thread de trabalho (importação, sincronismo, carga em massa) que
atualiza um rótulo/barra de progresso **congela o app** no meio do processamento.
No Android o sistema mata ou trava a tela (ANR). O tamanho do lote parece não
explicar: coleções **maiores** processadas por outro caminho passam sem travar.

## Causa

O loop chama `TThread.Synchronize` **uma vez por item** só para refletir o
progresso:

```pascal
for I := 0 to Pred(LRegistros.Count) do
begin
  AplicarRegistro(LRegistros[I]);

  TThread.Synchronize(nil,           // <- por REGISTRO
    procedure
    begin
      Inc(LFeitos);
      LblProgresso.Text := Format('%d%%', [LFeitos * 100 div LTotal]);
      ArcProgress.EndAngle := ...;   // repaint completo
    end);
end;
```

Cada chamada:

1. **bloqueia a thread de trabalho** até a main thread atender (é síncrona);
2. enfileira e executa um closure na main thread;
3. se houver event bus/observers, aloca objeto e percorre inscritos;
4. atribuir `Text`/propriedade visual **dispara repaint**.

Com 5.000 itens são 5.000 repaints. A main thread não sobra para processar
input — e é exatamente isso que o watchdog do Android classifica como ANR.

O custo é **por item**, não por byte: uma tabela de 5.000 registros trava,
enquanto outra de 10.000 processada em lotes não trava.

## Correção — notificar por lote, não por item

```pascal
// 1 notificacao por pagina/lote
Inc(LAplicados, LLote.Count);
if LTotal > 0 then LPct := (LAplicados * 100) div LTotal else LPct := 0;

TThread.Synchronize(nil,
  procedure
  begin
    NotificarProgresso(LPct);
  end);
```

Sem paginação, dá para obter o mesmo efeito com um **throttle por percentual
inteiro**, que reduz de N para ~100 notificações:

```pascal
LPctAtual := (LFeitos * 100) div LTotal;
if LPctAtual <> LPctAnterior then
begin
  LPctAnterior := LPctAtual;
  TThread.Queue(nil, procedure begin NotificarProgresso(LPctAtual) end);
end;
```

## Preferir `TThread.Queue` a `TThread.Synchronize`

Para progresso **não** é preciso esperar a UI: `Queue` é assíncrono e não bloqueia
o worker. `Synchronize` só se faltar ler algo de volta da main thread.

## Como diagnosticar

- Comparar dois caminhos do mesmo app: se o que trava notifica por item e o que
  não trava notifica por lote, a causa é essa — não o volume.
- Contar as sincronizações: `N registros` vs. `N/tamanho_do_lote`.
- Um percentual que **avança e depois congela** (ex.: para em 27%) é típico:
  a UI ainda desenha no começo e satura conforme a fila cresce.

## Ver também

- [fmx-lista-dinamica-ordem-align-top.md](fmx-lista-dinamica-ordem-align-top.md)
