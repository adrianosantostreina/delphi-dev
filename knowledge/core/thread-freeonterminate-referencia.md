# `FreeOnTerminate := True` + guardar a referência da thread = leitura de memória liberada

## Sintoma

Um serviço de segundo plano guarda a `TThread` num campo para poder responder
"está rodando?" e para não subir dois. Funciona por muito tempo e um dia dá
`Access violation` — ou pior, responde "está rodando" para uma thread que já morreu, e
o serviço nunca mais reinicia.

```pascal
class var FThread: TThread;

class function Ativo: Boolean;
begin
  Result := FThread <> nil;        // <- pode ler instancia ja destruida
end;

class procedure Iniciar;
begin
  if FThread <> nil then Exit;     // <- e uma corrida, alem de tudo
  FThread := TThread.CreateAnonymousThread(procedure begin ... end);
  FThread.FreeOnTerminate := True; // <- a instancia se destroi sozinha
  FThread.Start;
end;
```

## Causa

`FreeOnTerminate := True` faz a própria thread se destruir ao terminar. A partir daí o
campo `FThread` aponta para memória liberada. Zerá-lo de dentro do `Execute` reduz a
janela mas **não a fecha**: entre o fim do corpo e a destruição efetiva ainda há tempo,
e quem lê o campo em outra thread não tem como saber em que ponto está.

O `if FThread <> nil then Exit` também é uma **corrida**: entre testar e atribuir cabe
outra chamada, e nascem duas threads.

## Correção — flag atômica, não a referência

```pascal
class var FRodando: Integer;   // 0/1
class var FParar: Integer;

class function Ativo: Boolean;
begin
  Result := TInterlocked.CompareExchange(FRodando, 0, 0) = 1;
end;

class procedure Iniciar;
var
  LThread: TThread;             // LOCAL: ninguem guarda a referencia
begin
  // Testa e liga num passo so: entre "if" e "atribuicao" cabia outra chamada.
  if TInterlocked.CompareExchange(FRodando, 1, 0) <> 0 then
    Exit;

  TInterlocked.Exchange(FParar, 0);

  LThread := TThread.CreateAnonymousThread(
    procedure
    begin
      try
        while TInterlocked.CompareExchange(FParar, 0, 0) = 0 do
          ...
      finally
        TInterlocked.Exchange(FRodando, 0);
      end;
    end);

  LThread.FreeOnTerminate := True;
  LThread.Start;
end;

class procedure Parar;
begin
  TInterlocked.Exchange(FParar, 1);
end;
```

Pontos que fazem a diferença:

- A variável da thread é **local**. Depois do `Start` ninguém tem a referência, e
  ninguém pode lê-la depois.
- `FRodando` é `Integer` manipulado por `TInterlocked` — não `Boolean`. Um `Boolean`
  lido e escrito por threads diferentes não tem garantia de visibilidade.
- `CompareExchange(F, 1, 0)` é *testar-e-ligar* atômico: só entra quem conseguir trocar
  0 por 1.
- `CompareExchange(F, 0, 0)` é a forma de **ler** atomicamente sem alterar.
- O `finally` garante que a flag baixe mesmo se o corpo levantar.

## Parada responsiva

Um laço que dorme o intervalo inteiro só obedece ao `Parar` no fim do intervalo. Dormir
em fatias resolve:

```pascal
LEspera := 0;
while (LEspera < C_IntervaloMs) and
      (TInterlocked.CompareExchange(FParar, 0, 0) = 0) do
begin
  Sleep(250);
  Inc(LEspera, 250);
end;
```

## Quando guardar a referência é legítimo

Quando você **não** usa `FreeOnTerminate` e chama `WaitFor` + `Free` você mesmo. Aí a
referência é sua e vive enquanto você quiser. As duas coisas não se combinam: ou a
thread se destrói sozinha e você não guarda o ponteiro, ou você guarda o ponteiro e
destrói na mão.

## Ver também

- [fmx-progresso-sync-por-registro-anr.md](fmx-progresso-sync-por-registro-anr.md)
