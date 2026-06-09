# Rule: Nomenclatura Delphi

## Prefixos obrigatórios

| Contexto | Prefixo | Exemplo |
|----------|---------|---------|
| Campo de classe (field) | `F` | `FNome`, `FIdade`, `FCliente` |
| Parâmetro de método | `A` | `ACliente`, `ANome`, `AValor` |
| Variável local | `L` | `LIndex`, `LTotal`, `LResultado` |
| Constante | `C_` | `C_MaxTentativas`, `C_Versao` |
| Tipo (class/record/enum) | `T` | `TCliente`, `TPedido`, `TStatus` |
| Interface | `I` | `IClienteService`, `IRepository` |
| Enum value | `E` | `EStatusAtivo`, `EStatusInativo` |

## Classes
- `T` + PascalCase: `TClienteService`, `TPedidoRepository`
- Interfaces: `I` + PascalCase: `IClienteService`
- Exceptions: `E` + PascalCase: `EClienteNaoEncontrado`

## Métodos
- PascalCase, verbo + substantivo: `BuscarPorId`, `SalvarCliente`, `ValidarCpf`
- Getters/setters: prefixados com `Get`/`Set` ou como property
- Booleanos: `Is`/`Has`/`Can`: `IsAtivo`, `HasPedidos`, `CanDelete`

## Properties
- PascalCase sem prefixo: `Nome`, `Idade`, `Cliente`
- O field correspondente usa `F`: `FNome` ↔ property `Nome`

## Eventos
- `On` + PascalCase: `OnClienteSalvo`, `OnPedidoCancelado`

## Proibido
- Nomes de uma letra (exceto índices `I`, `J`, `K` em loops)
- Abreviações obscuras: `Cli` em vez de `Cliente`, `Cfg` em vez de `Config`
- Underscores no meio do nome (exceto `C_` em constantes e `Test_` em testes)
- Mistura de idiomas: `TClienteManager` (use `TClienteGerenciador` ou `TClientManager`)
