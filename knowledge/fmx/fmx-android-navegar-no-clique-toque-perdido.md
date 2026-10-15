# [FMX/Android] Trocar de tela dentro do OnClick: o próximo toque se perde

## Sintoma

App FMX com navegação por troca de conteúdo (Router4D, `TabControl`, ou "Render" de
outra View no container principal). O botão que navega fica num cartão de lista, ou é o
Voltar da toolbar. Depois de trocar de tela, **o primeiro toque na tela seguinte não faz
nada**. O segundo funciona. Na automação parece "Voltar morto"; para o usuário, parece um
toque que "não pegou".

Visto no Android 16 (emulador, Delphi 13) em 2026-10-05, no TMV30, nos detalhes de
produto e de pedido abertos pelo cartão da lista, e no Voltar deles.

## Causa

A navegação roda **dentro** do `OnClick`, antes de o FMX terminar de processar o toque. A
View de origem sai do container com o toque ainda "capturado" pelo botão que disparou a
troca. O próximo toque é entregue a esse controle, que já não está na tela.

Mesma família de [fmx-dialogo-acao-no-callback-forcequeue.md](fmx-dialogo-acao-no-callback-forcequeue.md).

## Correção: um ponto único de navegação adiada

```pascal
class procedure TLib.Navegar(const ARota: string; const ADepois: TProc);
begin
  TThread.ForceQueue(nil,
    procedure
    begin
      TRouter4D.Link.&To(ARota);
      if Assigned(ADepois) then ADepois();   // ex.: RemoveHistory
    end);

  // Despertador: ver a armadilha abaixo.
  TThread.CreateAnonymousThread(
    procedure
    begin
      Sleep(50);
      TThread.Queue(nil, procedure begin end);
    end).Start;
end;
```

Todo clique que troca de tela chama `TLib.Navegar` em vez de `Link.&To`.

## Armadilhas (as duas foram vistas)

1. **Só `ForceQueue` não basta.** Chamado de **dentro de um callback que já roda na fila
   da thread principal** (ex.: o retorno de um `TTask` via `TThread.Queue`), o
   `ForceQueue` no Android não acorda a thread principal, e a navegação **nunca
   acontece**. O sintoma é o cadastro ficar parado depois de salvar. O `Queue` vazio vindo
   de outra thread acorda a principal, que então processa a fila.
2. **Só "thread + `Queue`" também não basta.** A navegação pode rodar antes de o toque
   terminar, e o toque perdido volta. Precisa do `ForceQueue` para a ordem e do
   despertador para garantir que a fila rode.

## Limite conhecido

Na **primeira abertura** de uma View pesada (o form é criado na hora), o primeiro toque
no Voltar ainda pode se perder. Da segunda vez em diante, não.
