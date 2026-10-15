# [Android] REST síncrono na main thread → "app não está respondendo" (ANR)

## Sintoma

Salvar algo com "online primeiro, fila se falhar" funciona com rede boa e com o aparelho
em modo avião. Mas com **rede presente e servidor inalcançável** (servidor desligado,
porta bloqueada, VPN caída), a tela congela pelo tempo do timeout. Se o usuário tocar na
tela nesse intervalo, o Android mostra **"<app> isn't responding — Close app / Wait"**.

No logcat: `Application Not Responding: com.seu.app` e um `data_app_anr` no DropBox.

## Por que só nesse cenário

- **Modo avião / sem sinal:** a conexão falha na hora (sem rota). Sem espera.
- **Porta fechada num host alcançável:** em rede real costuma vir RST (recusa imediata).
- **Emulador → host (`10.0.2.2`) com a porta fechada:** a conexão **não é recusada**, fica
  pendurada até o timeout (`SocketTimeoutException ... after 30000ms`). É o caso de
  servidor inalcançável que mais engana nos testes.
- O detector de conectividade (`ConnectivityManager`, `NET_CAPABILITY_VALIDATED`) diz
  "online" o tempo todo: a rede existe, só o servidor não responde.

O ANR do Android dispara quando um evento de toque fica **mais de 5 s** sem ser
processado. Qualquer chamada bloqueante na main thread maior que isso é ANR em potencial.

## Correção

1. **Tirar a chamada da main thread:** `TTask.Run` para a requisição e `TThread.Queue`
   para voltar à tela com o resultado. Overlay de "Salvando..." e botão desabilitado
   enquanto roda.
2. **Timeout explícito e curto** na requisição (ex.: 8 s, RESTRequest4D `.Timeout(8000)`).
   Sem `.Timeout`, vale o padrão da plataforma, que pode passar de 30 s.
3. **Atalho offline:** se o detector de conectividade diz **sem rede**, nem tente: vá
   direto para a fila. O estado "desconhecido" deve contar como online.

```pascal
class procedure TServiceCadastro.SalvarAsync(const ACad: TCadastroLocal;
  const ARegistro: TJSONObject; const AOnFim: TProcFimSalvar);
begin
  TTask.Run(
    procedure
    var
      LResultado: TResultadoSalvar;
      LErro     : string;
    begin
      LErro := EmptyStr;
      try
        try
          LResultado := Salvar(ACad, ARegistro);   // pode levar até o timeout
        except
          on E: Exception do
            LErro := E.Message;   // SÓ a mensagem: o objeto morre no fim do except
        end;
      finally
        ARegistro.Free;
      end;

      TThread.Queue(nil,
        procedure
        begin
          AOnFim(LResultado, LErro);   // main thread: dialogo, navegacao
        end);
    end);
end;
```

## Armadilhas

- **Ler os controles da tela antes do `TTask`** (montar o JSON, pegar texto de edits):
  tocar em componente FMX fora da main thread é proibido.
- **Não passar o objeto da exceção** para o `TThread.Queue`: ele já foi destruído quando
  a fila roda. Passe a mensagem (ou a classe, como texto).
- **Não usar rotina aninhada** dentro das anônimas: veja
  [anonima-nao-captura-rotina-aninhada.md](anonima-nao-captura-rotina-aninhada.md).
- O que o `TTask` chama precisa ser thread-safe: acesso ao SQLite por conexão com lock,
  ver [thread-freeonterminate-referencia.md](thread-freeonterminate-referencia.md) e
  [fmx-progresso-sync-por-registro-anr.md](fmx-progresso-sync-por-registro-anr.md).
- Router4D reaproveita a instância da tela: o callback encontra o form vivo mesmo que o
  usuário tenha navegado. Ainda assim, só altere controles da própria tela.

## Teste que pega o problema

Derrubar o servidor com o app na mesma rede, salvar e **tocar na tela durante a espera**.
Sem toque, a espera passa sem ANR e o defeito fica escondido.
