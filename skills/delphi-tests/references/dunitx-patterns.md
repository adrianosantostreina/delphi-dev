# DUnitX: Padroes e Exemplos Completos

## Estrutura de Projeto de Testes

```
MeuProjeto/
  src/
    Servicos/
      PedidoService.pas
      ClienteService.pas
    Repositorios/
      PedidoRepository.pas
  tests/
    Servicos/
      TestePedidoService.pas
      TesteClienteService.pas
    Repositorios/
      TestePedidoRepository.pas
    TestRunner.dpr          <- Projeto DUnitX runner
```

---

## Exemplo Completo: Servico com Dependencias

### Classe alvo: `PedidoService.pas`

```pascal
unit PedidoService;

interface

uses
  System.SysUtils,
  IPedidoRepository,
  IEstoqueService,
  Pedido;

type
  IPedidoService = interface
    ['{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}']
    function CriarPedido(const AClienteId: Integer; const AProdutoId: Integer;
      const AQuantidade: Integer): TPedido;
    procedure CancelarPedido(const APedidoId: Integer);
    function BuscarPorId(const AId: Integer): TPedido;
  end;

  TPedidoService = class(TInterfacedObject, IPedidoService)
  strict private
    FPedidoRepo: IPedidoRepository;
    FEstoqueService: IEstoqueService;
  public
    constructor Create(const APedidoRepo: IPedidoRepository;
      const AEstoqueService: IEstoqueService);
    function CriarPedido(const AClienteId: Integer; const AProdutoId: Integer;
      const AQuantidade: Integer): TPedido;
    procedure CancelarPedido(const APedidoId: Integer);
    function BuscarPorId(const AId: Integer): TPedido;
  end;

implementation

...
```

### Unit de testes: `TestePedidoService.pas`

```pascal
unit TestePedidoService;

interface

uses
  DUnitX.TestFramework,
  Delphi.Mocks,
  PedidoService,
  IPedidoRepository,
  IEstoqueService,
  Pedido;

type
  [TestFixture]
  TPedidoServiceTests = class
  strict private
    FPedidoService: IPedidoService;
    FMockPedidoRepo: TMock<IPedidoRepository>;
    FMockEstoque: TMock<IEstoqueService>;
  public
    [Setup]
    procedure Setup;
    [TearDown]
    procedure TearDown;
  published
    // --- CriarPedido ---
    [Test]
    procedure Test_CriarPedido_DadosValidos_RetornaPedidoCriado;
    [Test]
    procedure Test_CriarPedido_ClienteIdZero_LancaEArgumentException;
    [Test]
    procedure Test_CriarPedido_QuantidadeNegativa_LancaEArgumentException;
    [Test]
    procedure Test_CriarPedido_SemEstoque_LancaEEstoqueInsuficienteException;

    // --- CancelarPedido ---
    [Test]
    procedure Test_CancelarPedido_PedidoExistente_CancelaComSucesso;
    [Test]
    procedure Test_CancelarPedido_PedidoNaoEncontrado_LancaENotFoundException;

    // --- BuscarPorId ---
    [Test]
    procedure Test_BuscarPorId_IdValido_RetornaPedido;
    [Test]
    procedure Test_BuscarPorId_IdZero_LancaEArgumentException;
  end;

implementation

procedure TPedidoServiceTests.Setup;
begin
  FMockPedidoRepo := TMock<IPedidoRepository>.Create;
  FMockEstoque := TMock<IEstoqueService>.Create;
  FPedidoService := TPedidoService.Create(FMockPedidoRepo, FMockEstoque);
end;

procedure TPedidoServiceTests.TearDown;
begin
  FPedidoService := nil;
end;

procedure TPedidoServiceTests.Test_CriarPedido_DadosValidos_RetornaPedidoCriado;
var
  LPedido: TPedido;
  LPedidoEsperado: TPedido;
begin
  // Arrange
  LPedidoEsperado := TPedido.Create;
  LPedidoEsperado.Id := 1;
  LPedidoEsperado.ClienteId := 10;
  LPedidoEsperado.ProdutoId := 5;
  LPedidoEsperado.Quantidade := 3;

  FMockEstoque.Setup.WillReturn(True).When.TemEstoque(5, 3);
  FMockPedidoRepo.Setup.WillReturn(LPedidoEsperado).When.Salvar(It.IsAny<TPedido>);

  // Act
  LPedido := FPedidoService.CriarPedido(10, 5, 3);

  // Assert
  Assert.IsNotNull(LPedido);
  Assert.AreEqual(10, LPedido.ClienteId);
  Assert.AreEqual(5, LPedido.ProdutoId);
  Assert.AreEqual(3, LPedido.Quantidade);
end;

procedure TPedidoServiceTests.Test_CriarPedido_ClienteIdZero_LancaEArgumentException;
begin
  Assert.WillRaise(
    procedure
    begin
      FPedidoService.CriarPedido(0, 5, 3);
    end,
    EArgumentException
  );
end;

procedure TPedidoServiceTests.Test_CriarPedido_QuantidadeNegativa_LancaEArgumentException;
begin
  Assert.WillRaise(
    procedure
    begin
      FPedidoService.CriarPedido(10, 5, -1);
    end,
    EArgumentException
  );
end;

procedure TPedidoServiceTests.Test_CriarPedido_SemEstoque_LancaEEstoqueInsuficienteException;
begin
  FMockEstoque.Setup.WillReturn(False).When.TemEstoque(5, 10);

  Assert.WillRaise(
    procedure
    begin
      FPedidoService.CriarPedido(10, 5, 10);
    end,
    EEstoqueInsuficienteException
  );
end;

procedure TPedidoServiceTests.Test_CancelarPedido_PedidoExistente_CancelaComSucesso;
var
  LPedido: TPedido;
begin
  LPedido := TPedido.Create;
  LPedido.Id := 42;
  LPedido.Status := psPendente;

  FMockPedidoRepo.Setup.WillReturn(LPedido).When.BuscarPorId(42);

  Assert.WillNotRaise(
    procedure
    begin
      FPedidoService.CancelarPedido(42);
    end
  );

  FMockPedidoRepo.Verify.Once.Salvar(It.IsAny<TPedido>);
end;

procedure TPedidoServiceTests.Test_CancelarPedido_PedidoNaoEncontrado_LancaENotFoundException;
begin
  FMockPedidoRepo.Setup.WillReturn(nil).When.BuscarPorId(999);

  Assert.WillRaise(
    procedure
    begin
      FPedidoService.CancelarPedido(999);
    end,
    ENotFoundException
  );
end;

procedure TPedidoServiceTests.Test_BuscarPorId_IdValido_RetornaPedido;
var
  LPedido: TPedido;
  LPedidoMock: TPedido;
begin
  LPedidoMock := TPedido.Create;
  LPedidoMock.Id := 7;
  FMockPedidoRepo.Setup.WillReturn(LPedidoMock).When.BuscarPorId(7);

  LPedido := FPedidoService.BuscarPorId(7);

  Assert.IsNotNull(LPedido);
  Assert.AreEqual(7, LPedido.Id);
end;

procedure TPedidoServiceTests.Test_BuscarPorId_IdZero_LancaEArgumentException;
begin
  Assert.WillRaise(
    procedure
    begin
      FPedidoService.BuscarPorId(0);
    end,
    EArgumentException
  );
end;

initialization
  TDUnitX.RegisterTestFixture(TPedidoServiceTests);
end.
```

---

## TestRunner.dpr — Projeto de Execucao

```pascal
program TestRunner;

{$APPTYPE CONSOLE}

uses
  System.SysUtils,
  DUnitX.TestFramework,
  DUnitX.Loggers.Console,
  DUnitX.Loggers.Xml.NUnit,
  TestePedidoService in 'tests\Servicos\TestePedidoService.pas',
  TesteClienteService in 'tests\Servicos\TesteClienteService.pas';

var
  LRunner: ITestRunner;
  LResults: IRunResults;
  LLogger: ITestLogger;
  LNUnitLogger: ITestLogger;
begin
  try
    TDUnitX.RegisterTestFixture(TPedidoServiceTests);

    LRunner := TDUnitX.CreateRunner;
    LRunner.UseRTTI := True;

    LLogger := TDUnitXConsoleLogger.Create(True);
    LNUnitLogger := TDUnitXXMLNUnitFileLogger.Create(TDUnitX.Options.XMLOutputFile);
    LRunner.AddLogger(LLogger);
    LRunner.AddLogger(LNUnitLogger);

    LResults := LRunner.Execute;

    if not LResults.AllPassed then
      System.ExitCode := EXIT_ERRORS;

  except
    on E: Exception do
    begin
      Writeln(E.ClassName, ': ', E.Message);
      System.ExitCode := EXIT_ERRORS;
    end;
  end;
end.
```

---

## Padroes Avancados

### Verificar chamadas com Verify

```pascal
// Verificar que o metodo foi chamado exatamente uma vez
FMockRepo.Verify.Once.Salvar(It.IsAny<TCliente>);

// Verificar que NUNCA foi chamado
FMockRepo.Verify.Never.Deletar(It.IsAny<Integer>);

// Verificar que foi chamado N vezes
FMockRepo.Verify.Exactly(3).Salvar(It.IsAny<TCliente>);
```

### Testar metodos que retornam strings

```pascal
procedure Test_FormatarNome_CompletoRetornaFormatado;
var
  LResultado: string;
begin
  LResultado := FServico.FormatarNome('joao', 'SILVA');
  Assert.AreEqual('Joao Silva', LResultado);
end;
```

### Testar com multiplos cenarios (DataProvider)

```pascal
[Test]
[TestCase('CPF valido', '123.456.789-09,True')]
[TestCase('CPF invalido', '111.111.111-11,False')]
[TestCase('CPF vazio', ',False')]
procedure Test_ValidarCPF_Cenarios(const ACPF: string; const AEsperado: Boolean);
begin
  Assert.AreEqual(AEsperado, FServico.ValidarCPF(ACPF));
end;
```

### Setup com estado complexo

```pascal
procedure Setup;
var
  LConfig: TConfiguracao;
begin
  LConfig := TConfiguracao.Create;
  LConfig.Timeout := 30;
  LConfig.MaxTentativas := 3;

  FMockConfig := TMock<IConfiguracao>.Create;
  FMockConfig.Setup.WillReturn(LConfig).When.ObterConfig;

  FServico := TMinhaClasse.Create(FMockConfig);
end;
```

---

## Checklist de Qualidade dos Testes

- [ ] Cada teste tem exatamente UM Assert principal
- [ ] Nomes seguem o padrao `Test_Metodo_Cenario`
- [ ] Setup inicializa tudo que e necessario
- [ ] TearDown libera recursos criados manualmente
- [ ] Nenhum teste depende de outro teste
- [ ] Dependencias externas sao mockadas
- [ ] Cenario feliz, edge cases e erros cobertos
- [ ] Codigo de teste segue os mesmos padroes do codigo de producao
- [ ] Unit compilavel sem erros
