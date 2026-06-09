# Rule: Arquitetura e SOLID em Delphi

## Camadas obrigatórias

```
Presentation (Forms/Frames)
    ↓ chama
Service (regras de negócio)
    ↓ chama
Repository (acesso a dados)
    ↓ chama
Model (entidades)
```

Camadas superiores não conhecem detalhes de camadas inferiores.
`TClienteForm` não acessa `TFDQuery` diretamente — passa pelo service.

## SOLID aplicado

**S — Single Responsibility:** Uma classe = uma razão para mudar.
`TClienteService` salva clientes. Não envia email, não formata relatório.

**O — Open/Closed:** Adicione comportamento por interface, não por modificação.
Novo tipo de notificação: nova classe que implementa `INotificacao`, não if/case no service.

**L — Liskov Substitution:** Subclasse deve funcionar onde a superclasse funciona.
`TPedidoEspecial` deve passar onde `TPedido` é esperado.

**I — Interface Segregation:** Interfaces pequenas e focadas.
`IClienteReader` + `IClienteWriter` em vez de `IClienteRepository` monolítico.

**D — Dependency Inversion:** Dependa de abstrações, não de implementações.
`TClienteService` recebe `IClienteRepository` no construtor, não instancia `TClienteFDRepository`.

## Constructor injection

```delphi
// CORRETO
constructor TClienteService.Create(ARepository: IClienteRepository);
begin
  FRepository := ARepository;
end;

// ERRADO — viola DIP
constructor TClienteService.Create;
begin
  FRepository := TClienteFDRepository.Create; // dependência hardcoded
end;
```

## Uma responsabilidade por try..finally

```delphi
// CORRETO — um recurso por bloco
LQuery := TFDQuery.Create(nil);
try
  // usa LQuery
finally
  LQuery.Free;
end;

// ERRADO — dois recursos, liberação parcial em caso de exceção
LQuery := TFDQuery.Create(nil);
LConn := TFDConnection.Create(nil);
try
  // ...
finally
  LQuery.Free;
  LConn.Free; // se LQuery.Free lançar, LConn vaza
end;
```
