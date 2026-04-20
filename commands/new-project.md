---
description: Scaffold de novo projeto Delphi com estrutura de pastas e arquivos base padronizados
---

Crie a estrutura inicial de um novo projeto Delphi seguindo boas práticas de arquitetura.

**Idioma de saída:** Detecte o idioma da primeira mensagem do usuário e conduza
o levantamento e as explicações nesse idioma. Padrão: pt-BR. Suportados: pt-BR, en-US.
Honre overrides: "respond in English" / "responda em português".
Nomes de pastas e arquivos do scaffold seguem a convenção e não são traduzidos.

**Passo 1 — Levantar requisitos**

Pergunte ao usuário:
- Nome do sistema/projeto?
- Tipo: VCL / FMX / REST API / Library?
- Banco de dados? Componente de acesso?
- Arquitetura desejada: simples (Form + DataModule) / camadas (Model, Service, Repository)?
- Frameworks de terceiros? (ACBr, Horse, FastReport, etc.)

**Passo 2 — Propor estrutura de pastas**

Exemplo para projeto em camadas:
```
NomeProjeto/
├── src/
│   ├── model/          # entidades e DTOs
│   ├── interfaces/     # contratos (IService, IRepository)
│   ├── service/        # regras de negócio
│   ├── repository/     # acesso a dados
│   ├── presentation/   # forms e frames
│   └── shared/         # utilitários, constantes, exceções
├── tests/              # DUnitX
├── docs/
└── NomeProjeto.dproj
```

**Passo 3 — Gerar arquivos base**

Crie os arquivos iniciais:
- `NomeProjeto.dpr` — project file limpo
- Unit de exceções customizadas do domínio
- Interface base de repositório (ICRUDRepository)
- DataModule de conexão (se aplicável)
- Form principal com nomenclatura correta

Aplique todos os padrões do Delphi Style Guide em cada arquivo gerado.
