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

---

## Fluxo adicional para projeto FMX

Quando o usuário escolher **FMX** no Passo 1, faça estas perguntas extras antes de gerar:

1. **Plataformas alvo:** Windows / Android / iOS / macOS / Linux? (múltipla escolha)
2. Se Android ou iOS selecionado:
   - Orientação: Portrait / Landscape / Both?
   - Banco de dados local: SQLite via FireDAC? (s/n)
   - Permissões necessárias: câmera / GPS / storage / contatos? (múltipla escolha)
   - Push notifications FCM/APNS? (s/n)

### Estrutura gerada para projeto mobile

```
NomeApp/
├── src/
│   ├── model/
│   ├── interfaces/
│   ├── service/
│   ├── repository/
│   ├── presentation/
│   │   ├── forms/
│   │   └── frames/
│   └── shared/
├── assets/          # config.ini, .db, .json para deployment
├── resources/       # ícones, splash, .dres
├── tests/
├── docs/
└── NomeApp.dproj
```

### Regras aplicadas (consultar a KB FMX antes de gerar)

Antes de gerar qualquer form/unit mobile, consultar `knowledge/fmx/INDEX.md`:

- `knowledge/fmx/dimensoes-form-mobile.md` → ClientWidth=400, ClientHeight=750
- `knowledge/fmx/unit-naming-android.md` → sem pontos no nome da unit
- `knowledge/fmx/uses-fmx-components.md` → uses corretos FMX/FireDAC
- `knowledge/core/firedac-registro-drivers.md` → DataModule com registro explícito de drivers
- `knowledge/fmx/deployment-arquivos-extras.md` → Deployment pré-configurado de assets
