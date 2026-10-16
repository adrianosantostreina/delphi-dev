# Rule: Testes em Delphi com DUnitX

## Nomenclatura obrigatória

```
Test_{Metodo}_{Cenario}

Exemplos:
  Test_BuscarPorId_QuandoExiste_RetornaCliente
  Test_BuscarPorId_QuandoNaoExiste_LancaException
  Test_CalcularDesconto_ComValorZero_RetornaZero
  Test_SalvarCliente_ComDadosValidos_GravaNoBanco
```

## Padrão AAA (Arrange / Act / Assert)

```delphi
procedure TestClienteService.Test_BuscarPorId_QuandoExiste_RetornaCliente;
var
  LCliente: ICliente;
begin
  // Arrange
  FRepository.AdicionarCliente(TCliente.Create(1, 'João'));

  // Act
  LCliente := FService.BuscarPorId(1);

  // Assert
  Assert.AreEqual('João', LCliente.Nome);
end;
```

## Um Assert por teste (regra geral)
Cada teste verifica um comportamento específico.
Se você precisa de 5 asserts, provavelmente são 5 testes.

## Sem mocks de banco de dados
Testes de repository usam SQLite em memória (`:memory:`), não mocks.
Razão: mocks de banco mascaram bugs de SQL (lição aprendida em produção).

```delphi
procedure TSetup.SetupFixture;
begin
  FConn := TFDConnection.Create(nil);
  FConn.Params.DriverID := 'SQLite';
  FConn.Params.Database := ':memory:';
  FConn.Connected := True;
  CriarEstrutura(FConn); // roda o DDL de criação das tabelas
end;
```

## Cobertura mínima por classe
- Happy path: o cenário principal funciona
- Edge case principal: zero, nil, vazio, limite máximo
- Erro esperado: exception é lançada quando deve ser

## Setup e Teardown
```delphi
[Setup]
procedure SetupFixture;    // roda antes de todos os testes da classe

[TearDown]
procedure TearDownTest;    // roda após cada teste — limpa estado
```
