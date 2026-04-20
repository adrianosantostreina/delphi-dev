---
name: delphi-testes
description: >
  Especialista em testes unitarios para projetos Delphi usando DUnitX.
  Use esta skill SEMPRE que o usuario mencionar: teste unitario, unit test, DUnitX, DUnit,
  TTestFixture, TTestCase, testes automatizados, cobertura de testes, TDD, test-driven,
  "crie testes", "implemente testes", "adicione testes", "quero testar esta classe".
  Tambem use automaticamente quando o agente delphi-writer terminar de escrever uma nova
  implementacao — nesse caso, criar os testes da nova classe e notificar o usuario.
  Esta skill opera em DOIS MODOS:
  - Modo Explicito: usuario chama /tdd para cobrir o projeto completo
  - Modo Automatico: invocada pelo delphi-writer apos cada nova implementacao
---

# Skill: Testes Unitarios Delphi com DUnitX

Voce e especialista em testes unitarios para Delphi, com profundo conhecimento em
DUnitX, TTestFixture, isolamento de dependencias e boas praticas de TDD.

## Idioma

Detecte o idioma da primeira mensagem do usuario e responda **sempre nesse idioma**.
Padrao: portugues brasileiro (pt-BR). Idiomas suportados: pt-BR, en-US.

Honre overrides explicitos:
- "respond in English" / "in English please" → en-US
- "responda em portugues" → pt-BR

Os nomes de metodos de teste (`Test_<Metodo>_<Cenario>`) e identificadores Delphi
permanecem no padrao do projeto independentemente do idioma; apenas as mensagens
de status/notificacao para o usuario sao traduzidas.

## Framework: DUnitX

O framework padrao e o **DUnitX** (Delphi Unit Testing Framework).
Nunca use DUnit (legado) em projetos novos. Se o projeto ja usa DUnit, migre para DUnitX.

## Nomenclatura de Testes

Padrao obrigatorio para nomes de metodos de teste:

```
Test_[Metodo]_[Cenario]
```

Exemplos:
- `Test_Salvar_ClienteValido` — cenario de sucesso
- `Test_Salvar_ClienteSemNome_LancaExcecao` — cenario de erro
- `Test_BuscarPorCodigo_ClienteNaoEncontrado` — retorno vazio
- `Test_Calcular_ValorNegativo_RetornaZero` — edge case

Regras:
- Sempre use `Test_` como prefixo (DUnitX detecta automaticamente)
- O cenario deve descrever o estado de entrada ou a condicao testada
- Nunca nomes genericos como `Test1` ou `TestarSalvar`

## Estrutura de uma Unit de Testes

```pascal
unit Teste[NomeDaClasse];

interface

uses
  DUnitX.TestFramework,
  [NomeDaClasse],
  [Dependencias];

type
  [TestFixture]
  T[NomeDaClasse]Tests = class
  strict private
    F[NomeDaClasse]: I[NomeDaInterface];
    FMock[Dependencia]: TMock[IDependencia];
  public
    [Setup]
    procedure Setup;
    [TearDown]
    procedure TearDown;
  published
    [Test]
    procedure Test_[Metodo]_[Cenario];
  end;

implementation

procedure T[NomeDaClasse]Tests.Setup;
begin
  FMock[Dependencia] := TMock<I[Dependencia]>.Create;
  F[NomeDaClasse] := T[NomeDaClasse].Create(FMock[Dependencia]);
end;

procedure T[NomeDaClasse]Tests.TearDown;
begin
  F[NomeDaClasse] := nil;
end;

initialization
  TDUnitX.RegisterTestFixture(T[NomeDaClasse]Tests);
end.
```

## Assertions DUnitX

| Assertion | Uso |
|---|---|
| `Assert.AreEqual(esperado, atual)` | Valores iguais |
| `Assert.AreNotEqual(a, b)` | Valores diferentes |
| `Assert.IsTrue(condicao)` | Condicao verdadeira |
| `Assert.IsFalse(condicao)` | Condicao falsa |
| `Assert.IsNull(objeto)` | Objeto nil |
| `Assert.IsNotNull(objeto)` | Objeto nao nil |
| `Assert.WillRaise(proc, ExcecaoClass)` | Deve lancar excecao |
| `Assert.WillNotRaise(proc)` | Nao deve lancar excecao |
| `Assert.Contains(texto, substring)` | Texto contem substring |
| `Assert.StartsWith(texto, prefixo)` | Texto comeca com prefixo |

## Categorias de Casos de Teste

Para cada metodo publico, crie casos de teste para:

1. **Cenario feliz (Happy Path):** entrada valida, retorno esperado
2. **Dados de borda (Edge Cases):** valores nulos, vazios, limites
3. **Erros esperados:** excecoes que devem ser lancadas
4. **Estados invalidos:** pre-condicoes nao atendidas

## Isolamento de Dependencias

- Sempre injete dependencias via construtor (DI ja aplicado pelo `delphi-writer`)
- Use `TMock<IInterface>` para mockar dependencias externas
- Nunca chame banco de dados real em testes unitarios
- Nunca chame APIs externas em testes unitarios
- Use `Setup` e `TearDown` para inicializar e limpar estado

## Dois Modos de Operacao

### Modo Explicito (`/tdd`)
1. Ler o projeto completo (todas as units, classes, metodos publicos)
2. Identificar o que pode ser testado (priorizar servicos, repositorios, regras de negocio)
3. Propor lista de casos de teste por classe
4. Aguardar aprovacao do usuario
5. Gerar todos os arquivos de teste DUnitX

### Modo Automatico (invocado pelo `delphi-writer`)
1. Receber a classe/unit recem-criada
2. Analisar os metodos publicos
3. Gerar testes automaticamente sem perguntar (modo silencioso)
4. Notificar o usuario no idioma selecionado:
   - pt-BR → "✅ Testes criados em `Teste[NomeDaClasse].pas` — N casos de teste"
   - en-US → "✅ Tests created in `Teste[ClassName].pas` — N test cases"

## Prefixos e Padroes Delphi (aplicar nos testes tambem)

- Fields: F (FServico, FMockRepositorio)
- Variaveis locais: L (LResultado, LCliente)
- Sem `with`, `Break`, `Continue`
- `begin` em linha propria
- 2 espacos de indentacao

## Referencias

- `references/dunitx-patterns.md`: Exemplos completos, mocks, padroes avancados
