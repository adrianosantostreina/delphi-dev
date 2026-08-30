# Diagnóstico — por que o `/new-project` não builda de primeira

> Levantado em 2026-08-30 a pedido do usuário, que testou o comando e reportou:
> *"o comando cria um projeto, mas ele não builda de primeira"*.
> Diagnóstico por leitura de `commands/new-project.md` + confronto com a KB. **Nenhuma correção
> aplicada** — exige brainstorming antes de mexer.

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
