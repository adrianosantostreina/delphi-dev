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

> Gerar também o **`.dproj`** (o arquivo MSBuild — sem ele não há build) com `ProjectGuid`
> hexadecimal válido, as plataformas escolhidas no Passo 1 e `DCC_UnitSearchPath` cobrindo as
> pastas de `src/`. **Conferir os tipos das propriedades** na seção "Armadilhas conhecidas"
> abaixo antes de escrever — valor de tipo errado quebra o build com mensagem sem relação com a
> causa.


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

---

## REGRA ZERO deste comando — o scaffold só é entregue se COMPILAR

Gerar arquivos não é entregar um projeto. **Todo scaffold termina em build verde**, sem exceção.
Falhas de geração que não são óbvias na leitura aparecem no compilador — e três delas foram
observadas em projeto real (ver `knowledge/core/`).

### Passo 4 — Build obrigatório (não pular)

Após gerar todos os arquivos:

1. Gerar o `build.bat` conforme `knowledge/core/build-via-bat-com-log.md` (redireciona a saída
   para `build_log.txt`).
2. Se o projeto usa Boss, rodar `boss install` **antes** do build.
3. Carregar a skill `delphi-build` e compilar.
4. Ler o `build_log.txt` e diagnosticar o **primeiro** erro (os seguintes costumam ser cascata).
5. Corrigir e recompilar. **Repetir até `Build OK`.**
6. Só então apresentar o projeto ao usuário, informando o caminho do `.exe`.

**Se o build não puder rodar** (RAD Studio não instalado, `rsvars.bat` ausente), **não fingir
sucesso**: entregar o projeto declarando explicitamente que a compilação não foi validada e por
quê.

**pt-BR:** "⚠️ Projeto gerado, mas **não foi possível validar a compilação** ({motivo}). Rode
`build.bat` e me traga o `build_log.txt` se houver erro."
**en-US:** "⚠️ Project generated, but **the build could not be validated** ({reason}). Run
`build.bat` and send me `build_log.txt` if it fails."

---

## Armadilhas conhecidas do scaffold (consultar ANTES de gerar)

Estas três já quebraram um projeto gerado por este comando. Consultar a KB e aplicar.

### 1. Tipos das propriedades do `.dproj`

`knowledge/core/dproj-dcc-debuginformation-nao-booleano.md` e
`knowledge/core/dproj-projectguid-valido.md`.

- **`DCC_DebugInformation` NÃO é booleana** — é enum numérico (`0` em Debug, `2` em Release).
  O booleano correspondente é `DCC_DebugInfoInExe`. Escrever `true` produz
  `F1026 File not found: 'true.dpr'` **antes de compilar qualquer linha**, e a mensagem não tem
  relação com a causa.
- **`ProjectGuid` precisa ser hexadecimal válido** (`0-9 A-F`). Placeholder "bonitinho" com
  letras não-hex compila pela CLI mas o RAD Studio recusa abrir o projeto.

**Nunca inventar o tipo de uma propriedade do `.dproj`.** Na dúvida, conferir contra um `.dproj`
gerado pela IDE — o tipo varia entre versões do RAD Studio.

Alinhar também `ProjectVersion` / `Borland.Personality` à versão do RAD Studio que o `build.bat`
vai chamar; gerar um apontando para 12 e outro para 13 é incoerência do gerador.

### 2. `class var` misturado com campos de instância

`knowledge/core/class-var-vaza-para-campos-de-instancia.md`.

`class var` abre uma seção que **linha em branco não fecha**. Num singleton (padrão comum em
config/factory), declarar `class var FInstancia` e logo abaixo os campos de estado transforma
**todos** em variáveis de classe → `E2356 Property accessor must be an instance field or method`
em cada propriedade.

**Ao gerar classes, nunca deixar `class var` e campos de instância na mesma seção de
visibilidade.**

### 3. Código de framework escrito de memória

**Depois do `boss install`, o fonte de toda dependência fica em `modules/`. Ler a interface real
ali antes de escrever qualquer linha contra Horse, gbswagger, horse-jwt, ACBr ou qualquer lib
vendorizada.** A superfície muda entre versões, e escrever de memória produz cascata de
`E2003`/`E2066`/`E2250` no `.dpr`.

Erros reais já cometidos (ver `knowledge/core/horse-gbswagger-rotas-jwt.md`):

| De memória (errado) | Real |
|---|---|
| `Swagger.Title(...)` | `Swagger.Info.Title(...) … .&End` |
| `THorse.Use(Horse.GBSwagger.Middleware)` | `THorse.Use(HorseSwagger)` |
| `SkipRoutes(['/swagger'])` | `SkipRoutes(['/swagger/doc/html', '/swagger/doc/json'])` |

E: os atributos `Swag*` exigem **`GBSwagger.Path.Attributes`** no `uses`. Sem ela sai apenas
`W1074 Unknown custom attribute` — **warning, não erro** — e as rotas anotadas **somem em
runtime**. Tratar `W1074` como erro em controller gbswagger.

---

## Consulta à KB vale para TODOS os tipos de projeto

O bloco "Regras aplicadas" do fluxo FMX não é exclusivo de mobile. Antes de gerar, consultar
`knowledge/core/INDEX.md` **sempre**, e adicionalmente `knowledge/fmx/INDEX.md` quando FMX.

| Tipo | Consultar também |
|---|---|
| REST API / Horse | `horse-gbswagger-rotas-jwt.md`, `horse-conexao-por-requisicao.md`, `firedac-console-firebird.md`, `firedac-registro-drivers.md` |
| VCL | `componentes-designer-vs-runtime.md`, `encoding-utf8-bom.md` |
| Library / pacote | `dpr-uses-project-manager.md`, `uses-uma-unit-por-linha.md` |
| Qualquer um | `build-via-bat-com-log.md`, `dproj-*.md`, `class-var-vaza-para-campos-de-instancia.md` |

---

## Fechamento do scaffold

Depois do `Build OK`:

1. **Arquivos de runtime ao lado do `.exe`.** `config.ini`, `.db`, `.dll` etc. precisam estar no
   diretório de saída (`DCC_ExeOutput`), não só na raiz do projeto — código que resolve caminho
   via `ExtractFilePath(ParamStr(0))` não enxerga a raiz. Copiar, ou configurar o pós-build.
2. **Semear `tests/`** invocando o agente `delphi-tester` para a suíte inicial DUnitX.
3. **Rodar a skill `delphi-claudeignore`** para criar o `.claudeignore`.
4. Informar ao usuário: caminho do `.exe`, como rodar, e o que ainda precisa ser configurado
   (banco de dados, credenciais).
