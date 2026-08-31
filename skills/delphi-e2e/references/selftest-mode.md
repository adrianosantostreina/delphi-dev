# Modo `--selftest`

A segunda oferta de instrumentação (a primeira é `references/logging-unit.md`).
**Nunca aplicar sem aceite explícito do usuário** — mexe no `.dpr` do projeto dele.

## Quando oferecer isto em vez de navegação de UI

Automação de UI (o resto desta skill) confere **layout**: o formulário abriu, o
clique chegou, a tela mudou. Para **lógica** — chamada de rede, sessão, cache,
parsing de resposta, concorrência — automação de UI é o caminho mais caro e mais
frágil possível: builda, abre janela, espera render, clica, tira print, só para
verificar algo que nunca dependeu de pixel nenhum.

Sempre que o cenário pedido for de lógica e não de tela — "confere se o login com
token expirado renova sozinho", "confere se duas requisições simultâneas não
corrompem a sessão" — **oferecer o `--selftest` antes de propor navegação**. Se o
usuário recusar ou o cenário for mesmo sobre layout/fluxo visual, seguir com o
protocolo normal do `SKILL.md`.

## O gate no `.dpr`

```pascal
// No .dpr, com App.Selftest (o esqueleto abaixo) no uses do projeto.
// ANTES de criar qualquer form:
// FindCmdLineSwitch REMOVE UM caractere de switch: '--selftest' chega como
// '-selftest' e NAO casa com o switch 'selftest'. Aceitar as duas formas.
if FindCmdLineSwitch('selftest', True) or FindCmdLineSwitch('-selftest', True) then
begin
  Halt(ExecutarAutoteste);   // exit code = numero de falhas
end;
```

A pegadinha não é opcional de tratar: `FindCmdLineSwitch` reconhece o prefixo `-`
**ou** `--` mas devolve o switch **sem** o(s) caractere(s) de prefixo removidos da
comparação — na prática, quando a linha de comando traz `--selftest`, o primeiro `-`
é consumido como marcador de switch e o que sobra para comparar é `-selftest`, que
não bate com o literal `'selftest'`. Testar só a forma sem hífen faz o gate nunca
disparar quando alguém (ou o próprio `/e2e`) chama com `--selftest`. As duas
chamadas em `or` cobrem `-selftest` e `--selftest`.

O `Halt` precisa vir **antes** de qualquer `Application.CreateForm` — senão o
selftest abre a janela principal do FMX por cima, o que tanto atrasa quanto polui o
resultado com efeitos colaterais de UI que o modo existe para evitar.

## `ExecutarAutoteste` — contrato

- Roda a bateria **contra a API/serviço real** (mesmo backend que o app usaria em
  uso normal — nada de mock substituindo a camada que se quer testar).
- Grava `selftest.log` ao lado do executável, **a cada linha** (mesmo motivo do
  `logging-unit.md`: se travar, a última linha gravada diz onde parou).
- Devolve a **contagem de falhas** como `Integer` — é isso que vira exit code via
  `Halt`. Zero falhas = exit code `0`.

Esqueleto — unit inteira, na ordem em que compila:

```pascal
unit App.Selftest;

interface

function ExecutarAutoteste: Integer;

implementation

uses
  System.SysUtils,        // Format, FormatDateTime, Now, Exception, TFunc<T>
  System.IOUtils,         // TPath
  System.StrUtils,        // IfThen(Boolean; string; string)
  System.Net.HttpClient,  // THTTPClient, IHTTPResponse (secao "concorrência")
  System.Threading;       // TParallel (secao "concorrência")

// Object Pascal exige DECLARAÇÃO PRÉVIA: um identificador só pode ser chamado depois
// de declarado. ExecutarAutoteste chama os três casos, e TestarConcorrencia só aparece
// mais abaixo neste documento — daí os `forward` aqui em cima. Sem eles:
// E2003 Undeclared identifier.
function TestarLoginValido: Boolean; forward;
function TestarLoginSenhaErrada: Boolean; forward;
function TestarConcorrencia: Boolean; forward;

// GravarLinha: append imediato por linha (ver adiante). Corpo por sua conta.
procedure GravarLinha(const AArquivo, ALinha: string); forward;

// ExecutarCaso vem ANTES de ExecutarAutoteste, que a chama. Invertido, o compilador
// para em `E2003 Undeclared identifier: 'ExecutarCaso'`.
procedure ExecutarCaso(const AArquivo, ANome: string; const ATeste: TFunc<Boolean>;
  var AFalhas: Integer);
var
  LOk: Boolean;
  LErro: string;
begin
  LErro := '';
  try
    LOk := ATeste();
  except
    on E: Exception do
    begin
      LOk := False;
      LErro := E.Message;
    end;
  end;
  if not LOk then
    Inc(AFalhas);
  GravarLinha(AArquivo, Format('%s  %s  %s  %s', [
    FormatDateTime('yyyy-mm-dd hh:nn:ss.zzz', Now),
    IfThen(LOk, 'PASSOU', 'FALHOU'), ANome, LErro]));
end;

function ExecutarAutoteste: Integer;
var
  LArquivo: string;
  LFalhas: Integer;
begin
  LArquivo := TPath.Combine(ExtractFilePath(ParamStr(0)), 'selftest.log');
  LFalhas := 0;

  ExecutarCaso(LArquivo, 'Login_CredenciaisValidas', TestarLoginValido, LFalhas);
  ExecutarCaso(LArquivo, 'Login_SenhaErrada', TestarLoginSenhaErrada, LFalhas);
  ExecutarCaso(LArquivo, 'Catalogo_NRequisicoesParalelas', TestarConcorrencia, LFalhas);

  Result := LFalhas;
end;
```

**`IfThen` de string é do `System.StrUtils`, não do `System.Math`.** As duas units
exportam `IfThen`, e a do `System.Math` só tem sobrecargas numéricas
(`Integer`/`Int64`/`Double`) — com apenas `System.Math` no escopo, o
`IfThen(LOk, 'PASSOU', 'FALHOU')` acima não compila. Se a unit já usar `System.Math`
para outra coisa, deixar `System.StrUtils` **depois** dela no `uses` (vence a última
declarada) ou qualificar: `System.StrUtils.IfThen(...)`.

`GravarLinha` segue o mesmo padrão de `logging-unit.md`: `TFile.AppendAllText` por
chamada, sob `TCriticalSection` — pode inclusive reaproveitar a unit `App.Log` se o
projeto já tiver aceitado aquela oferta, gravando `selftest.log` como arquivo
separado do `app.log` para não misturar as duas bateladas. `TestarLoginValido` e
`TestarLoginSenhaErrada` são do seu app; escreva as duas em qualquer ponto da
`implementation` — o `forward` só exige que o corpo exista **na mesma unit**.

## Caso obrigatório: concorrência

Um teste sequencial (um `curl`, um clique de cada vez) **nunca** expõe bug de
conexão/estado compartilhado entre requisições — a corrida só acontece quando duas
ou mais chegam ao mesmo tempo. É exatamente o cenário que um app real produz (ex.:
uma tela de catálogo que baixa várias miniaturas ao mesmo tempo) e que um teste
manual, um por um, não reproduz nunca.

Por isso `ExecutarAutoteste` **precisa** incluir um caso que dispare N requisições em
paralelo e confira duas coisas: (1) nenhuma delas falhou, e (2) o serviço **continua
respondendo depois** — um recurso compartilhado corrompido pela corrida costuma
sobreviver à rajada e só quebrar a próxima chamada sequencial, o que faria um
teste que só olha a rajada em si (sem esse segundo cheque) passar por engano.

`THTTPClient` (unit `System.Net.HttpClient`) é a classe correta para a chamada —
não há `IHTTPClient` na RTL, só `THTTPClient` como classe concreta; `IHTTPResponse`
(o retorno de `.Get`) sim é interface, também de `System.Net.HttpClient`. `TParallel.For`
vem de `System.Threading`. As duas units já estão no `uses` do esqueleto acima; o bloco a
seguir entra na mesma unit `App.Selftest` e é o que satisfaz o `forward` de
`TestarConcorrencia`.

```pascal
function TestarConcorrencia: Boolean;
const
  C_N_PARALELAS = 10;
var
  LErros: TArray<Boolean>;
  LTodasOk: Boolean;
  LI: Integer;
begin
  SetLength(LErros, C_N_PARALELAS);
  TParallel.For(0, C_N_PARALELAS - 1,
    procedure(AIndex: Integer)
    var
      LCliente: THTTPClient;
      LResposta: IHTTPResponse;
    begin
      LCliente := THTTPClient.Create;
      try
        try
          LResposta := LCliente.Get('http://localhost:8080/api/produtos');
          LErros[AIndex] := LResposta.StatusCode <> 200;
        except
          LErros[AIndex] := True;
        end;
      finally
        LCliente.Free;
      end;
    end);

  LTodasOk := True;
  for LI := 0 to High(LErros) do
    if LErros[LI] then
      LTodasOk := False;

  // Segundo cheque: depois da rajada, o servico continua respondendo?
  // Conexao/estado compartilhado corrompido pela corrida sobrevive ate a
  // proxima chamada sequencial — e so quebra ali.
  Result := LTodasOk and TestarLoginValido;
end;
```

Esse é o padrão de bug que este caso pega: um serviço com conexão de dados guardada
em variável **compartilhada** (`class var` ou singleton) em vez de uma conexão nova
por chamada — sob paralelismo real, threads diferentes mexendo na mesma conexão
corrompem estruturas internas e o sintoma que aparece depois ("erro estranho",
"servidor caiu") não tem relação óbvia com a causa (a corrida).

## Exit code e leitura pelo `/e2e`

`Halt(ExecutarAutoteste)` faz o processo terminar com o exit code igual ao número de
falhas — `0` é sucesso total, qualquer valor `> 0` é a contagem exata. O `/e2e`
roda `.\App.exe --selftest`, lê o exit code do processo e o conteúdo de
`selftest.log` (cada linha já traz veredito + nome do caso + erro, se houver) para
montar o relatório — sem precisar abrir janela nenhuma nem tirar screenshot para
esses cenários.
