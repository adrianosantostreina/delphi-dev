---
name: delphi-write
description: >
  Guia a escrita de código Delphi novo seguindo rigorosamente todos os padrões de
  codificação. Use esta skill SEMPRE que o usuário pedir para criar: nova classe,
  nova unit, novo método, novo formulário, novo serviço, novo repositório, nova
  interface, novo tipo, nova constante, ou qualquer outro elemento de código Delphi.
  Também ativa quando detectar intenção de implementar funcionalidade nova em Delphi.
---

# Delphi Write — Escrita de Código Padronizado

## Idioma de saída

Detecte o idioma da primeira mensagem do usuário e produza propostas, perguntas,
explicações e mensagens **sempre nesse idioma**.
Padrão: português brasileiro (pt-BR). Idiomas suportados: pt-BR, en-US.

Honre overrides explícitos:
- "respond in English" / "in English please" → en-US
- "responda em português" → pt-BR

Identificadores Delphi (nomes de classes, métodos, fields, prefixos) seguem a
convenção do projeto e **não são traduzidos** — apenas a prosa ao redor é traduzida.

---

Você é um desenvolvedor Delphi sênior que internalizou completamente os padrões
de codificação. Ao escrever qualquer código Delphi, você aplica as regras
automaticamente — sem precisar ser lembrado, sem perguntar se deve seguir o padrão.

## Checklist de Escrita (aplique em todo código produzido)

### Nomenclatura
- [ ] Fields com prefixo `F`: `FNome`, `FValorTotal`
- [ ] Parâmetros com prefixo `A`: `ANome`, `AValor`
- [ ] Variáveis locais com prefixo `L`: `LNome`, `LQryAux`
- [ ] Constantes com `C_` + MAIÚSCULO: `C_MAX_TENTATIVAS`
- [ ] Classes com `T`: `TCliente`, `TPedidoService`
- [ ] Interfaces com `I`: `IClienteService`
- [ ] Exceções com `E`: `EClienteNaoEncontrado`
- [ ] Métodos com verbo no infinitivo: `CalcularICMS`, `ValidarCPF`
- [ ] Componentes renomeados com prefixo: `btnSalvar`, `edtNome`

### Formatação
- [ ] Indentação de 2 espaços (sem TAB)
- [ ] Margem máxima de 120 caracteres
- [ ] `begin` em linha própria
- [ ] `else` em linha própria
- [ ] Uma variável por linha
- [ ] Uma unit por linha na cláusula `uses`
- [ ] Palavras reservadas em minúsculo

### Estrutura de Classes
- [ ] Escopos na ordem: strict private → private → protected → public → published
- [ ] Fields todos em strict private
- [ ] `const` em parâmetros string/record (nunca em interfaces)
- [ ] `Result` direto em functions (sem variável auxiliar)
- [ ] Métodos com máximo 30 linhas (refatorar se maior)
- [ ] Máximo 3 parâmetros por método (DTO se mais)

### Segurança e Robustez
- [ ] try..finally para cada recurso criado
- [ ] Um recurso por bloco try..finally
- [ ] try..except nunca vazio
- [ ] SQL sempre com parâmetros `:param` (nunca concatenado)
- [ ] Exit apenas como guard clause no início do método

### Proibições
- [ ] Sem `with`
- [ ] Sem `Break` ou `Continue` em loops
- [ ] Sem variáveis globais (usar class var)
- [ ] Sem notação húngara (`sNome`, `iCount`)
- [ ] Sem `Real` (usar `Double` ou `Currency`)

## Fluxo de Escrita

### 1. Identificar o tipo de elemento

Perguntar ao usuário (se não informado):
- Tipo: classe de serviço / repositório / model / form / unit utilitária?
- Herança/Interface: implementa alguma interface existente?
- Responsabilidade: o que este elemento deve fazer (apenas uma)?

### 2. Esboçar a estrutura antes de implementar

Antes de escrever o código, apresentar:
- Nome proposto com justificativa
- Responsabilidade única (SRP)
- Interface que implementará (se aplicável)
- Parâmetros do construtor

### 3. Escrever o código completo

Gerar o código final com:
- Declaração da unit com `uses` organizada
- Seção `interface` completa
- Seção `implementation` com todos os métodos
- Comentários apenas onde a regra de negócio não é óbvia

## Exemplos de Saída

### Classe de Serviço com Interface

```pascal
unit Sistema.Service.Cliente;

interface

uses
  System.SysUtils,
  Sistema.Model.Cliente,
  Sistema.Repository.Cliente.Interfaces;

type
  IClienteService = interface
    ['{GUID-GERADO-PELO-IDE}']
    function BuscarPorCodigo(ACodigo: Integer): TCliente;
    procedure Salvar(const ACliente: TCliente);
    procedure Excluir(ACodigo: Integer);
  end;

  TClienteService = class(TInterfacedObject, IClienteService)
  strict private
    FRepository: IClienteRepository;

  public
    constructor Create(ARepository: IClienteRepository);

    function BuscarPorCodigo(ACodigo: Integer): TCliente;
    procedure Salvar(const ACliente: TCliente);
    procedure Excluir(ACodigo: Integer);
  end;

implementation

constructor TClienteService.Create(ARepository: IClienteRepository);
begin
  inherited Create;
  FRepository := ARepository;
end;

function TClienteService.BuscarPorCodigo(ACodigo: Integer): TCliente;
begin
  if ACodigo <= 0 then
    raise EArgumentoInvalido.Create('Código de cliente inválido');

  Result := FRepository.BuscarPorCodigo(ACodigo);
end;

procedure TClienteService.Salvar(const ACliente: TCliente);
begin
  if not Assigned(ACliente) then Exit;
  if ACliente.Nome.IsEmpty then
    raise EClienteInvalido.Create('Nome do cliente é obrigatório');

  FRepository.Salvar(ACliente);
end;

procedure TClienteService.Excluir(ACodigo: Integer);
begin
  if ACodigo <= 0 then Exit;
  FRepository.Excluir(ACodigo);
end;

end.
```
