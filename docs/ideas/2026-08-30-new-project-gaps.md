# Diagnóstico — por que o `/new-project` não builda de primeira

> Levantado em 2026-08-30 a pedido do usuário, que testou o comando e reportou:
> *"o comando cria um projeto, mas ele não builda de primeira"*.
> Diagnóstico por leitura de `commands/new-project.md` + confronto com a KB. **Nenhuma correção
> aplicada** — exige brainstorming antes de mexer.
>
> **⚠️ AS SEÇÕES 1 E 2 ESTAVAM ERRADAS.** Foram escritas por leitura do comando, sem
> artefato real. Em 2026-08-30 o usuário forneceu um projeto de verdade e **eu compilei**.
> A **§7** tem o diagnóstico empírico e **substitui** as §§1–2. Ler a §7 primeiro.

## 1. A causa raiz: o `.dproj` nunca é gerado

A árvore de pastas do comando mostra `NomeProjeto.dproj`, mas o **Passo 3** manda gerar apenas:

- `NomeProjeto.dpr`
- unit de exceções do domínio
- interface base de repositório
- DataModule de conexão
- Form principal

**O `.dproj` não está na lista.** E `.dpr` ≠ `.dproj`: o `.dpr` é o fonte Pascal; o `.dproj` é o
arquivo **MSBuild** (XML) que carrega plataformas, configs, `ProjectGuid`, search paths e output
paths. **Sem `.dproj` o msbuild não tem o que construir.** Isto sozinho explica o sintoma.

## 2. Mesmo com `.dproj`, faltaria o `DCC_UnitSearchPath`

O scaffold espalha units por `src/model/`, `src/interfaces/`, `src/service/`, `src/repository/`,
`src/presentation/`, `src/shared/`. A cláusula `uses` do `.dpr` cita as units **pelo nome**; o
`dcc32` só as encontra via `DCC_UnitSearchPath` declarado no `.dproj`.

Sem isso: **`E2003 Unit não encontrada` para cada unit do projeto.** É a razão clássica de um
scaffold em camadas não compilar.

## 3. O comando nunca compila o que gerou

`/new-project` gera arquivos e **termina**. Não há passo de validação.

Isto é o mais fácil de corrigir e o de maior retorno: **existe a skill `delphi-build`** (com
fluxo de `.bat` + log + diagnóstico) **e um agent `delphi-build`**. Fechar o comando com
*"buildar e iterar até `Build OK`"* transforma defeitos de geração em correções automáticas —
mesmo os que não anteciparmos.

**Esta é a mudança que faz o comando "ficar top".**

## 4. Outras lacunas encontradas

| # | Lacuna | Efeito |
|---|---|---|
| 4.1 | Forms gerados **sem `.dfm`/`.fmx`** companheiro | unit de form sem recurso não roda; em FMX ainda esbarra em `dfm-fmx-sem-bom.md` |
| 4.2 | Nenhum `.res` gerado, embora `{$R *.res}` seja padrão no `.dpr` | etapa de recurso falha |
| 4.3 | Consulta à KB **só existe no ramo FMX** | VCL / REST API / Library geram sem consultar conhecimento nenhum |
| 4.4 | `tests/` criado **vazio** | o `delphi-tester` existe e poderia semear a suíte |
| 4.5 | Sem `.claudeignore` | a skill `delphi-claudeignore` existe e auto-ativa, mas o scaffold não a invoca |

## 5. O achado que amarra tudo: a KB já tem a cura, mas o plugin não a tem

**Quatro dos 41 arquivos ausentes** (item 8 do backlog) são **exatamente** sobre por que um
projeto recém-criado não builda — e um deles cita o cenário de agente gerando projeto, ao pé da
letra:

| Arquivo (em `~/.claude/shared/delphi-knowledge/`, **fora do plugin**) | Por que é exatamente este caso |
|---|---|
| `dproj-projectguid-valido.md` | Abre com *"Ao criar um `.dproj` à mão (sem o IDE — **ex.: agente gerando o projeto**)"*. Um `ProjectGuid` com caractere não-hex **compila por linha de comando mas o RAD Studio recusa abrir**. Falha silenciosa e cruel. |
| `program-name-colide-var-global-e2029.md` | Nome do `program` colidindo com variável global → `E2029` na última linha do `.dpr`, sem relação aparente. **O scaffold escolhe o nome do program.** |
| `dcc32-unit-nome-pontuado-conflito-search-path.md` | Unit com nome pontuado + search path → `F2613`, apontando arquivo e linha que não existem. **Scaffold em camadas com `src/` é precisamente esse cenário.** |
| `brcc32-resinator-delphi13-bug.md` | No Delphi 13 a etapa de recurso via MSBuild usa o motor novo (resinator) e quebra com o `CompilerToUse=brcc` documentado. Casa com a lacuna 4.2. |

**Consequência de ordem:** fazer o item 8 (importar a KB) **antes** de mexer no `/new-project`.
O conhecimento que corrige o comando já está escrito — só não foi importado.

## 6. Proposta de correção (a validar em brainstorming)

1. **Gerar o `.dproj`** com `ProjectGuid` hexadecimal válido, plataformas escolhidas no Passo 1,
   e `DCC_UnitSearchPath` cobrindo todas as pastas de `src/`.
2. **Fechar o comando com build obrigatório** via `delphi-build`, iterando até `Build OK` e só
   então devolvendo o projeto ao usuário.
3. **Gerar `.dfm`/`.fmx` e `.res`** junto de cada form.
4. **Estender a consulta à KB** aos ramos VCL / REST / Library, não só FMX.
5. **Semear `tests/`** chamando o `delphi-tester`.
6. **Rodar `delphi-claudeignore`** ao final.

### Questões em aberto

- Gerar o `.dproj` à mão (control total, risco de divergir por versão do RAD Studio) ou partir
  de **templates versionados por versão do Delphi**? A segunda é mais robusta e mais chata de
  manter.
- O build obrigatório deve **bloquear** a entrega quando falhar, ou entregar com aviso? (Um dev
  sem RAD Studio instalado não consegue buildar — e o plugin é público.)
- Qual versão do Delphi o scaffold assume por padrão?

---

## 7. DIAGNÓSTICO EMPÍRICO (2026-08-30) — compilei um scaffold real

**Artefato:** `D:\Temp\Projeto Novo com Delphi-Dev` — API REST Horse `ApiGT004`, gerada pelo
`/new-project` em 20/08/2026. Compilada com RAD Studio **37.0 (Delphi 13)**, `Config=Debug`,
`Platform=Win32`.

> (O usuário apontou primeiro para `D:\Temp\Projeto GT 004`, que **não** é scaffold do plugin —
> é o template padrão do RAD Studio usado como baseline de laudo.)

### 7.0 Correção do que eu havia afirmado

| Afirmação anterior | Veredito | Realidade |
|---|---|---|
| "O `.dproj` nunca é gerado" (§1) | ❌ **ERRADA** | O `.dproj` **é** gerado, com `ProjectGuid` hexadecimal válido, `DCCReference` das 11 units e `ProjectExtensions`. O texto do comando não pede, mas o agente produz. |
| "Faltaria `DCC_UnitSearchPath`" (§2) | ❌ **ERRADA** | Está presente e populado pelo `boss`. **Todas as 11 units de `src/` compilaram** depois de removidos os bloqueios abaixo. A estrutura em camadas funciona. |
| "O comando nunca compila o que gerou" (§3) | ✅ **CONFIRMADA** | E é o achado que mais importa — as três falhas abaixo seriam pegas por um laço de build. |

### 7.1 Defeito 1 — `DCC_DebugInformation` booleano quebra o build ANTES de compilar

```
CodeGear.Delphi.Targets(431,5): error F1026: File not found: 'true.dpr'
```

**Causa:** o `.dproj` gerado traz `<DCC_DebugInformation>true</DCC_DebugInformation>` (e `false`
no Release). No Delphi moderno essa propriedade **não é booleana** — é um enum numérico. O
`.dproj` gerado pela IDE usa `<DCC_DebugInformation>0</DCC_DebugInformation>` e expressa o
booleano em outra propriedade, `<DCC_DebugInfoInExe>true</DCC_DebugInfoInExe>`.

O `CodeGear.Delphi.Targets` repassa o valor cru à task DCC
(`DebugInformation="$(DCC_DebugInformation)"`, linha 492). Valor não reconhecido vira **token
solto na linha de comando**:

```
dcc32.exe -$O- -$W+ true --no-config -B -Q ...
                    ^^^^
```

O `dcc32` interpreta `true` como o **arquivo-fonte a compilar** → procura `true.dpr` → `F1026`.
**Nenhuma linha de código chega a ser compilada.**

> **Conhecimento novo — não existe na KB.** Candidato a `knowledge/core/`.

### 7.2 Defeito 2 — `class var` vazando para os campos de instância

Removido o defeito 1, o build para na primeira unit com **seis** erros:

```
src\shared\ApiGT004.Shared.Config.pas(26..31): error E2356:
  Property accessor must be an instance field or method
```

O código gerado:

```pascal
strict private
  class var FInstancia: TApiConfig;

  FPorta: Integer;        // <-- AINDA é class var
  FJwtSecret: string;     // <-- idem
  ...
public
  property Porta: Integer read FPorta;   // propriedade de INSTÂNCIA lendo class var -> E2356
```

**`class var` abre uma seção que permanece ativa até o próximo especificador de visibilidade ou
um `var` explícito. Linha em branco não fecha.** Todos os seis campos viraram variáveis de
classe; as propriedades de instância não podem lê-las.

Cura: `var` explícito antes de `FPorta`, ou declarar o `class var` por último.

> **Conhecimento novo — não existe na KB.** Candidato a `knowledge/core/`. Armadilha clássica, e
> exatamente o tipo de coisa em que um gerador de código reincide.

### 7.3 Defeito 3 — API de terceiros alucinada

Corrigidos 1 e 2, **as 11 units de `src/` compilam** e sobra o `.dpr`:

```
ApiGT004.dpr(46): error E2003: Undeclared identifier: 'Title'
ApiGT004.dpr(47..49): error E2066: Missing operator or semicolon
ApiGT004.dpr(52): error E2003: Undeclared identifier: 'Middleware'
ApiGT004.dpr(61): error E2250: There is no overloaded version of 'Listen' ...
src\controller\ApiGT004.Controller.Produto.pas(13..28): warning W1074: Unknown custom attribute
```

O scaffold escreveu código contra uma API que **não existe nas versões que o `boss` instalou**
(`horse ^3.3.2`, `gbswagger ^3.1.0`, `horse-jwt ^2.0.23`):

| Gerado | Real (conferido no fonte de `modules/`) |
|---|---|
| `Swagger.Title('ApiGT004')` | `Title` vive em **`IGBSwaggerInfo`**, não em `IGBSwagger` (`GBSwagger.Model.Interfaces.pas:114`). O encadeamento correto passa por `.Info`. |
| `Horse.GBSwagger.Middleware` | **`HorseSwagger`** — função que devolve `THorseCallback` (`Horse.GBSwagger.pas:33`). Não existe `Middleware`. |
| `THorse.Listen(porta, proc)` | Overloads existem em `Horse.Instance.pas:282-285`, mas com forma diferente da usada. |

**Este é o defeito mais importante do ponto de vista de desenho**, porque um laço de build
sozinho tem dificuldade de corrigi-lo — exige consultar a API real. E ela **está disponível**:
depois do `boss install`, o fonte das dependências está em `modules/`.

> **Princípio a incorporar no comando:** após o `boss install`, **ler a API real em `modules/`
> antes de escrever código de framework** — nunca escrever de memória. Vale para Horse,
> GBSwagger, ACBr e qualquer dependência vendorizada.

### 7.4 Ordem das falhas — "não builda de primeira" são três problemas, não um

| # | Barreira | Onde para |
|---|---|---|
| 1 | `DCC_DebugInformation` booleano | antes de compilar qualquer coisa |
| 2 | `class var` vazado | na 1ª unit |
| 3 | API de terceiros alucinada | no `.dpr`, após tudo compilar |

São **três classes independentes**. O usuário teria que vencer as três em sequência — e nenhuma
dá mensagem que aponte a causa (`true.dpr` é o exemplo extremo). **Um laço "buildar e iterar até
`Build OK`" teria pego 1 e 2 sozinho**, e sinalizado 3 para consulta à API real.

### 7.5 Observação menor

O `.dproj` declara `<ProjectVersion>19.6</ProjectVersion>` e `Delphi.Personality.12`, mas o
`build.bat` gerado aponta para o Studio **37.0 (Delphi 13)**. Não bloqueou o build, mas é
incoerência do gerador — vale alinhar à versão realmente alvo.

### 7.6 O que isso muda na proposta da §6

Sobem para o topo da lista:

1. **Corrigir os tipos das propriedades do `.dproj`** (`DCC_DebugInformation` numérico;
   `DCC_DebugInfoInExe` para o booleano) — conferir contra um `.dproj` gerado pela IDE.
2. **Build obrigatório ao final**, iterando até `Build OK` (já era a §6.2, agora com evidência).
3. **Ler a API real em `modules/` após o `boss install`** antes de gerar código de framework.
4. **Dois aprendizados novos para a KB:** `DCC_DebugInformation` e o vazamento de `class var`.

Continuam válidos da §6: consulta à KB nos ramos não-FMX, semear `tests/`, `.claudeignore`.
Perdem prioridade: gerar `.dproj` (já gera) e search paths (já gera).
