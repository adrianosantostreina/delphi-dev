---
name: delphi-spring4d
description: >
  Especialista em Spring4D (Dependency Injection, Collections e padrões) em Delphi.
  Auto-ativa quando detectar: Spring4D, Spring.Container, GlobalContainer,
  TContainer, RegisterType, IList<T>, IDictionary<T>, IEnumerable<T>, TCollections,
  injeção de dependência, DI container, IoC, "registrar serviço", "resolver dependência".
---

# Delphi Spring4D

## Idioma de saída
Detecte o idioma da primeira mensagem. Padrão: pt-BR. Respeite overrides explícitos.

## Quando usar Spring4D

- **DI Container** — quando o grafo de dependências cresce e o constructor injection
  manual fica trabalhoso de montar (ver `rules/architecture.md` para a base de DI).
- **Collections** — `IList<T>`, `IDictionary<TK,TV>`, `IEnumerable<T>` com semântica
  de interface (ARC) em vez de `TObjectList<T>` manual.

## DI Container — registro e resolução

```delphi
uses
  Spring.Container;

// Registro (na inicialização da aplicação)
GlobalContainer.RegisterType<IClienteRepository, TClienteFDRepository>;
GlobalContainer.RegisterType<IClienteService, TClienteService>;
GlobalContainer.Build;

// Resolução
var LService: IClienteService;
LService := GlobalContainer.Resolve<IClienteService>;
```

O container resolve a cadeia: ao pedir `IClienteService`, injeta automaticamente o
`IClienteRepository` no construtor de `TClienteService`.

## Tempo de vida (lifetime)

```delphi
GlobalContainer.RegisterType<IClienteService, TClienteService>
  .AsSingleton;          // uma instância para toda a aplicação
// .AsTransient (padrão)  // nova instância a cada Resolve
// .PerResolve            // uma instância por grafo de resolução
```

## Collections

```delphi
uses
  Spring.Collections;

var
  LClientes: IList<TCliente>;
begin
  LClientes := TCollections.CreateObjectList<TCliente>(True); // owns objects
  LClientes.Add(TCliente.Create);
  // Sem try/finally manual — ARC libera a lista e seus objetos
end;
```

## Regras
- Registrar **interfaces → implementações**, nunca classes concretas diretamente
- Preferir `AsSingleton` para services/repositories sem estado mutável
- `IList<T>` / `IDictionary<T>` (interface) em vez de `TList<T>` quando quer ARC
- O container não substitui o `rules/architecture.md` — é a ferramenta que automatiza
  o constructor injection que aquele documento exige
