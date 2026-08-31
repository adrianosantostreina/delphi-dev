# Unit de logging mínima

Uma das duas ofertas de instrumentação quando o `/e2e` não encontra log (ver
`SKILL.md` → "Descoberta de log", caso *d*). Sem log, cada clique vira "entreguei a
mensagem, não sei se surtiu efeito" — a skill degrada para veredito visual e diz isso
no relatório. Esta unit fecha essa lacuna: o app passa a gravar o que faz, e o
`/e2e` correlaciona clique com efeito real via `Get-DelphiLogDelta`.

**Nunca aplicar sem aceite explícito do usuário** — é código do projeto dele, não
scaffold descartável. Apresentar a unit, explicar os dois ou três pontos de chamada
sugeridos, e esperar confirmação antes de gerar o arquivo.

## Por que arquivo próprio, nunca stdout

Um app FMX não tem console por padrão, mas mesmo num app `{$APPTYPE CONSOLE}` o
`Writeln` não é uma opção confiável de log:

- Com a saída redirecionada para arquivo/pipe, o runtime usa buffer cheio — a linha
  só sai quando o buffer enche, o processo termina **normalmente**, ou alguém chama
  `Flush(Output)` depois de cada escrita.
- Automação de teste normalmente **mata o processo à força** entre cenários (ver
  "Isolamento" no `SKILL.md`) — e matar descarta o buffer inteiro. A última dúzia de
  linhas, exatamente as que explicariam o que aconteceu, nunca chega a existir.

Gravar em arquivo próprio, com append imediato por linha, evita as duas armadilhas.

## Por que gravar a cada linha, não no fim

Se o app travar no meio de um cenário, um log que só grava tudo de uma vez no
encerramento não deixa rastro nenhum do que rodou até ali — o mesmo problema do
`Writeln` sem flush, por outro caminho. Gravando linha a linha, a última linha do
arquivo é o último evento que de fato aconteceu: é o que diferencia, no relatório do
`/e2e`, um ⛔ BLOQUEADO informativo ("parou depois de X") de um "não sei o que
houve".

## A unit

```pascal
unit App.Log;

interface

procedure Log(const AMensagem: string);

implementation

uses
  System.SysUtils,
  System.IOUtils,
  System.SyncObjs;

var
  FLock: TCriticalSection;

procedure Log(const AMensagem: string);
var
  LArquivo: string;
  LLinha: string;
begin
  LArquivo := TPath.Combine(ExtractFilePath(ParamStr(0)), 'app.log');
  LLinha := Format('%s  %s', [FormatDateTime('yyyy-mm-dd hh:nn:ss.zzz', Now), AMensagem]);
  FLock.Enter;
  try
    TFile.AppendAllText(LArquivo, LLinha + sLineBreak, TEncoding.UTF8);
  finally
    FLock.Leave;
  end;
end;

initialization
  FLock := TCriticalSection.Create;

finalization
  FLock.Free;

end.
```

Notas de implementação:

- `TFile.AppendAllText` abre, escreve e fecha o arquivo a cada chamada — é o que
  garante o append imediato sem depender de flush manual em cima de um stream
  mantido aberto.
- `TCriticalSection` torna `Log` seguro para chamar de qualquer thread (ex.: uma
  requisição HTTP assíncrona) sem intercalar linhas de duas chamadas simultâneas.
- `app.log` fica ao lado do executável — é onde a ordem (b)/(c) da descoberta de log
  do `SKILL.md` já procura por padrão (`config.ini` primeiro, senão `*.log` mais
  recente que o start), então uma vez adicionada a unit o `/e2e` a encontra sozinho
  na próxima execução, sem precisar de configuração adicional.

## Onde chamar `Log`

Não instrumentar tudo — só os pontos que o `/e2e` precisa para diferenciar "cliquei e
nada mudou" (⛔ BLOQUEADO) de "cliquei e o app respondeu errado" (❌ FALHOU):

- Início e fim de cada handler de ação relevante (`btnSalvar.OnClick`, `btnLogin.OnClick`).
- Antes e depois de uma chamada de rede/dados — com resultado (sucesso/erro) e, em
  erro, a mensagem da exceção.
- Navegação entre telas (`Log('Abriu FormPedido')`).

Exemplo de chamada:

```pascal
procedure TFormLogin.btnEntrarClick(Sender: TObject);
begin
  Log('btnEntrar clicado');
  try
    FAuthService.Autenticar(edtUsuario.Text, edtSenha.Text);
    Log('Autenticacao OK');
  except
    on E: Exception do
    begin
      Log('Autenticacao FALHOU: ' + E.Message);
      raise;
    end;
  end;
end;
```

## Contrato com o `/e2e`

O harness lê o log por offset, não por conteúdo (`Get-DelphiLogOffset` no início do
cenário, `Get-DelphiLogDelta` depois de agir) — por isso o formato de linha acima
(timestamp + mensagem livre) já é suficiente: a skill correlaciona pela **posição no
tempo**, não por parsing estruturado. Não é preciso adotar JSON nem um formato fixo
de campos para a unit funcionar com o `/e2e`.
