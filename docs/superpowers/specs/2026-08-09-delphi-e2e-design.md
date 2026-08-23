# Design — `delphi-e2e`: execução de cenários E2E em app Delphi desktop

> **STATUS: DESIGN EM ANDAMENTO — NÃO APROVADO.**
> Brainstorming interrompido na aprovação das seções 1–3 (usuário reiniciou a sessão).
> Este arquivo é o estado completo para retomar sem refazer as perguntas.
> Ao retomar: reapresentar as seções 1–3 para aprovação, seguir para as seções 4–7,
> depois converter em spec aprovada e invocar `writing-plans`.

## 0. Origem

Sessão de 2026-08-09. O usuário rodou, em **outra** sessão do Claude Code, um teste de
"build, execute e navegação" num app desktop Delphi FMX (projeto PDV Android). Funcionou:
o agente compilou, abriu o `.exe`, e navegou sozinho pelas telas. O aprendizado foi
registrado em dois lugares, e a outra sessão gerou um prompt propondo levar isso para
este plugin.

### Fontes (ler ao retomar)

| Fonte | Caminho | Conteúdo |
|---|---|---|
| Documento completo | `D:\1. Exemplos Cursos\PDV Android\docs\automacao-ui-delphi-fmx.md` | 12 seções, 726 linhas. Seções 7/8/9 são prompts prontos. Commits `87d3d9b` + `fd123ef` naquele repo. |
| Versão condensada | `C:\Users\User\.claude\shared\delphi-knowledge\fmx-win32-janela-automacao-externa.md` | 149 linhas, formato de `knowledge/fmx/`. Já indexada no `INDEX.md` (linha 66). |

**Status de validação da fonte:** a parte **FMX/Win32 foi medida de ponta a ponta**
(Delphi 12 Athens, Windows 11, monitor 2560×1080). As seções de **VCL** e **Android/adb**
são orientação derivada, **não exercitadas**. Não tratar como equivalentes.

---

## 1. Validação do que a outra sessão afirmou

Feita nesta sessão, contra o repo real.

### Errado

1. **"O working copy em `D:\2. 2 GitHub\...` não existe mais; clone de novo."**
   Falso. O repo está em `d:\2.2 GitHub Adriano Santos\delphi-dev`, branch `master`,
   remote correto, 1 commit à frente do origin. Não havia nada a clonar — e a "Rota A"
   (gerar um drop-in para copiar por cima) resolvia um problema inexistente.

2. **"O repo do delphi-dev é markdown puro."**
   Falso, e é o erro que mais importa: ela leu a cópia do marketplace, defasada. O repo
   tem TypeScript (`scripts/`, `hooks/`, `installer/`), SQLite (`rag/rag.db`), GitHub
   Actions, e **uma KB RAG com governança por tier** (v3.0.0): `knowledge/{core,fmx,community}/`.
   Consequência: o arquivo condensado tem um **segundo destino** no plugin que a proposta
   de 4 arquivos ignorava.

3. **"Sem `.pas`/`.dproj` o gatilho da KB compartilhada não dispara aqui."**
   Parcialmente falso. A regra global também dispara por menções a FireMonkey, VCL,
   FireDAC, RAD Studio, Embarcadero — e o `CLAUDE.md` deste repo é cheio delas.

### Certo

4. **Harness em `references/`, não inline.** Confirmado: `delphi-laudo`, `delphi-spec`,
   `delphi-standards`, `delphi-tests` e `delphi-fmx` já usam `references/`.
   *Nuance que ela não pegou:* as skills **novas** (`delphi-build`, `delphi-fmx`) apontam
   para `knowledge/`; `references/` é para templates e prosa própria da skill. O `gui.ps1`
   vai para `references/` por ser **asset executável**, não conhecimento.

5. **Regras de segurança logo após a REGRA ZERO** — certo, e por motivo mais forte do que
   ela deu: é o único ponto do plugin que autoriza um agente a assumir mouse e teclado de
   uma máquina real com dados reais.

6. **Windows-only com recusa limpa** — `user32.dll` não existe fora do Windows.

7. **Análise do arrasto de janela** — tecnicamente correta. Flags conferidos:
   `ForceForeground` usa `0x0003` (`SWP_NOSIZE|SWP_NOMOVE`), realmente incapaz de mover a
   janela; `Pin` usa `0x0005` (`SWP_NOSIZE|SWP_NOZORDER`). A conclusão (causa externa =
   arrasto humano; a regra de recalcular a RECT sobrevive por outro motivo) se sustenta.

8. **"O subagente precisa enxergar imagem"** — preocupação válida, risco menor do que ela
   pintou: **nenhum** agent deste plugin fixa modelo. O único com a chave é
   `agents/delphi-writer.md`, com `model: inherit`. O default já é herdar.

---

## 2. Achados desta sessão (nenhum dos dois documentos tinha)

1. **HOOKS ESTÃO OFF desde o v2.2.2.** O `.claude-plugin/plugin.json` não tem bloco `hooks`
   — removido porque quebrava instalação limpa no Windows. O `UserPromptSubmit` que injeta
   `[RELEVANT KNOWLEDGE]` **não roda em nenhuma instalação hoje**.
   → Pôr o doc em `knowledge/fmx/` embarca no `rag.db` do release mas **não injeta em
   sessão** até hooks/MCP voltarem (item 5 do backlog v3.0). O caminho que entrega
   capacidade **hoje** é skill + command.

2. **Sobreposição com `delphi-build`.** O PASSO 1 da skill proposta reimplementava build
   (achar `.dproj`, montar msbuild/rsvars) — a skill `delphi-build` já faz, e colide com o
   `/build` + agent `delphi-builder` previstos no v2.3 do roadmap.

3. **Nomes em português quebram a convenção.** Todas as skills/commands foram padronizados
   em inglês, inclusive um refactor dedicado (`e359d92`, "renomeia skill delphi-testes para
   delphi-tests"). `delphi-navegar` / `/navegar` andavam na contramão.

4. **A `description` proposta prometia VCL**, que o próprio documento marca como não
   validado (seção 11.1). Como `description` é o gatilho de auto-ativação, isso faria a
   skill ativar prometendo o que ninguém exercitou.

5. **Bug concreto no harness:** `Shot([string]$Name, [string]$ProcName = "PDV")` e
   `ClickAt(..., $ProcName = "PDV")` — o default vaza o nome do processo do projeto PDV.
   Num plugin genérico o parâmetro tem que ser obrigatório ou derivado do `.dproj`.

6. **Risco de colisão de gatilho:** a skill `delphi-tests` (DUnitX) já auto-ativa em
   "teste", "testes automatizados", "cobertura". A skill nova precisa de gatilhos disjuntos.

7. **`CLAUDE.md` desatualizado:** o item 4 da seção de versionamento manda atualizar
   "current version should be X.Y.Z" nos dois READMEs. **Os READMEs não têm string de
   versão** (confirmado por grep; o handoff de 2026-06-28 já registrava isso). Corrigir o
   `CLAUDE.md` como melhoria pontual ao mexer nessa área.

---

## 3. O REFRAME — o que o usuário realmente quer

**Esta é a informação mais importante do arquivo.** O design inicial (herdado do documento)
era um *smoke test com galeria de screenshots*. O usuário corrigiu o rumo:

> "Hoje temos o MCP Playwright como exemplo. Quando peço pra você usar ele, ele abre um
> browser e navega em um link, ao vivo, na minha 'cara' e ainda posso pedir para a IA gerar
> um relatório. Para aplicações desktop, não temos isso. Não quero um PNG, quero apenas que
> builde o projeto Delphi, execute como se eu tivesse abrindo o aplicativo e entre nas telas.
>
> Exemplo: imagina que crie um PDV e quero testar se o login está correto. Vou pedir para a
> IA e ela vai abrir o PDV e testar senha em branco, senha incorreta, senha correta. Se tudo
> passou, gerar um relatório ou um texto simples dizendo: ok, funciona. Ou funcionam os
> cenários A e B, mas o C não.
>
> Eventualmente posso criar um mecanismo de log no aplicativo, salvar o log e pedir para a IA
> 'navegar' no aplicativo e ler o log pra entender onde está crashando."

**Playwright para desktop Delphi.** O produto é um **executor de cenários E2E com veredito**;
o documento-fonte é só o *mecanismo* (como clicar num app que não expõe controles).

Três consequências levantadas e aceitas:

- **O screenshot deixa de ser entregável e vira instrumento.** Continua obrigatório (única
  forma de saber o que está na tela em FMX), mas ninguém quer ver os PNGs — quer ler o veredito.
- **Correção de premissa:** subagente **não** esconde a navegação do usuário. O app abre e é
  operado na tela física em qualquer arranjo. O subagente isola só o despejo de PNGs no
  transcript. A diferença real é acompanhar a narração passo a passo vs. receber só o veredito.
- **A regra de segurança do documento inviabiliza o caso de uso.** "Nunca confirmar operação
  que grava" torna inútil um pedido como "testa se a venda finaliza". Precisa virar: nunca
  gravar **por iniciativa própria**.

---

## 4. Decisões travadas (todas confirmadas pelo usuário)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Escopo da entrega | Skill + command + **entrada no RAG** (`knowledge/fmx/`) |
| 2 | Nomenclatura | **Inglês**, seguindo a convenção do repo |
| 3 | Fronteira com build | **Delegar à skill `delphi-build`** — não reimplementar |
| 4 | Gate de segurança | **Gate explícito** antes do primeiro clique (para e espera), não só aviso |
| 5 | Alcance | **FMX validado + VCL como fallback declarado**. **Android FORA** ("não faremos essa navegação no app") |
| 6 | Roteiro | **Livre por padrão, dirigido se houver argumento** |
| 7 | Abordagem | **C** — skill + agente + comando (com ressalva na §5.1) |
| 8 | Onde executa | **Contexto principal, passo a passo visível** (igual Playwright) |
| 9 | Gravação de dados | **Grava só se o cenário pedir**, declarado e confirmado no gate |
| 10 | Log do app | **Ler log existente + oferecer instrumentação quando não houver** |
| 11 | Nome final | **`delphi-e2e`** + **`/e2e`** — "E2E" não colide com DUnitX nos gatilhos |

---

## 5. Design apresentado (seções 1–3 — aguardando aprovação)

### 5.1 Artefatos

| Artefato | Papel |
|---|---|
| `skills/delphi-e2e/SKILL.md` | Protocolo, modelo de cenários, armadilhas, regras de segurança |
| `skills/delphi-e2e/references/gui.ps1` | Harness PowerShell (seção 4 do documento, **sem** o default `"PDV"`) |
| `skills/delphi-e2e/references/logging-unit.md` | Template da unit de logging mínima (caminho de instrumentação) |
| `commands/e2e.md` | Porta explícita, aceita cenários como argumento |
| `knowledge/fmx/fmx-win32-janela-automacao-externa.md` | Conhecimento no RAG, tier canonical |

**PONTO ABERTO — corte proposto, não confirmado:** *não* criar agente novo. A decisão 8
(execução no contexto principal) esvazia o agente executor; a instrumentação delega ao
`delphi-writer` existente. Se depois quisermos varredura ampla isolada, o agente entra numa
segunda iteração. **O usuário foi perguntado e não respondeu antes de reiniciar.**

**Materialização do `gui.ps1`:** o agente **lê** de `references/` e **escreve** em `%TEMP%`,
dot-sourcing de lá. Dois motivos: o diretório do plugin é cache sobrescrito a cada
atualização, e rodar `.ps1` de lá esbarra em ExecutionPolicy.

**Fronteiras da skill:** `delphi-e2e` não compila e não ensina msbuild — verifica se há
binário e, se não houver ou estiver mais velho que o fonte, carrega `delphi-build`. Mantém do
PASSO 1 do documento só o que a `delphi-build` não cobre: **localizar o `.exe`** (conferir
`DCC_ExeOutput` no `.dproj`, costuma ser `.\bin` e não `Win32\Debug`) e o **PASSO 2 inteiro**
— pré-requisitos ao lado do executável (`sk4d.dll`, `.ttf`, `.db`, `config.ini`,
`fbclient.dll`), que o próprio documento chama de "o mais esquecido" e é território de
runtime, não de build.

### 5.2 Modelo de cenário — o núcleo

Quatro campos: **nome**, **passos**, **expectativa**, e o que o agente produz — **veredito
com evidência**.

```
Cenário: senha em branco
  Passos:      abrir login → deixar PIN vazio → Confirmar
  Expectativa: bloqueia e mostra mensagem
  Veredito:    ✅ PASSOU — "Informe a senha" exibido, não navegou
```

Origem: o usuário descreve em linguagem natural (`/e2e login: senha em branco, senha errada,
senha certa`) e o agente traduz em passos concretos olhando a tela. Sem argumento, `/e2e`
deriva um cenário "abre sem erro" por tela do menu principal.

**Quatro vereditos, não dois** — a distinção separa relatório útil de ruído:

| Veredito | Significa |
|---|---|
| ✅ PASSOU | Executou e bateu com a expectativa |
| ❌ FALHOU | Executou e divergiu — **o app está errado** |
| ⛔ BLOQUEADO | Não deu para executar — **não sei se o app está errado** |
| ⏭️ PULADO | Grava dados e não foi autorizado no gate |

### 5.3 Ciclo de execução

Por cenário: marcar posição atual do log → reconduzir o app ao ponto de partida → executar os
passos → capturar e ler a tela → ler o **delta** do log → emitir veredito → voltar ao estado base.

**O ponto crítico é o isolamento entre cenários.** Se o cenário 2 (senha errada) deixa o app
numa tela de erro, o cenário 3 começa torto e falha por contaminação, não por bug. Regra: cada
cenário declara seu ponto de partida, o agente reconduz até lá antes de começar, e **se não
conseguir reconduzir, sai BLOQUEADO — nunca FALHOU**. Relatório que acusa bug onde só houve
contaminação de estado é pior que nenhum relatório.

---

## 6. Seções ainda NÃO apresentadas (rascunho — continuar daqui)

### 6.1 Descoberta e leitura do log

Ordem de descoberta: (a) o usuário informa; (b) `config.ini` do **diretório do `.exe`**
(chaves `Log`/`LogFile`/`LogPath`); (c) `*.log`/`*.txt` no diretório do `.exe` modificados
após o start do processo; (d) nada → degrada para veredito visual **e declara isso**.

Delta por byte offset (marca antes do cenário, lê só o acrescentado depois).

**Armadilha técnica a documentar:** o app Delphi costuma manter o log aberto com lock de
escrita (`TFileStream`/`TStreamWriter` com `fmShareDenyWrite`). `Get-Content` falha. Abrir com
`[System.IO.FileStream]::new(path, Open, Read, ReadWrite)` — `FileShare.ReadWrite` — senão a
leitura do log quebra em silêncio no meio da bateria.

### 6.2 Instrumentação quando não há log (decisão 10)

Se o app não tem log, o plugin **oferece** (nunca impõe — mexe no código do usuário) uma unit
de logging mínima, gerada pelo `delphi-writer` seguindo os padrões do plugin: append
thread-safe, timestamp, chamada simples. Template em
`skills/delphi-e2e/references/logging-unit.md`. Só executa mediante aceite explícito.

### 6.3 Regras de segurança (reescritas para o caso de uso)

1. Nunca gravar **por iniciativa própria** — explora, captura, sai pelo `Cancelar`/`Voltar`.
2. Cenário que grava só roda se o usuário pediu **e** confirmou no gate.
3. O gate lista: cenários pretendidos, quais gravam, e o que gravam. Para e espera.
4. Nunca capturar a tela inteira — recortar pela `RECT` da janela.
5. Declarar no relatório se roubou o foco de outra aplicação.
6. Credenciais do banco local do projeto; **nunca** ecoar senha em texto claro.
7. Declarar o estado final (app aberto/fechado, dados alterados/intactos).

### 6.4 Armadilhas herdadas do documento (as 5, manter todas)

3.1 `MainWindowHandle` devolve `TFMAppClass` (rect 0×0) → enumerar por PID, pegar a visível
de classe `FMT*` de maior área. · 3.2 `SetForegroundWindow` falha calado → combo completo +
conferir retorno, abortar na segunda falha. · 3.3 `SetProcessDPIAware()` antes de qualquer
coordenada. · 3.4 recalcular `GetWindowRect` antes de **cada** clique (o usuário pode arrastar
a janela; o app pode se reposicionar). · 3.5 o primeiro clique após mudança de foco é engolido
— não assumir N cliques = N caracteres.

### 6.5 Relatório e bilinguismo

Tabela: cenário | expectativa | resultado | evidência. Mais: o que não rodou e por quê; estado
final. Labels bilíngues conforme a convenção do repo —
pt-BR `✅ PASSOU / ❌ FALHOU / ⛔ BLOQUEADO / ⏭️ PULADO` ↔
en-US `✅ PASS / ❌ FAIL / ⛔ BLOCKED / ⏭️ SKIPPED`, com tabela de mapeamento.

### 6.6 Guarda Windows-only

`user32.dll` não existe fora do Windows → detectar e recusar limpo. **Sem** apontar o caminho
`adb` (decisão 5: Android fora).

### 6.7 Versionamento e READMEs

Bump 3.0.0 → **3.1.0** (capacidade nova). Sincronizar `plugin.json`, `marketplace.json`,
`commands/about.md` (2 linhas: Version/Versão). Atualizar os dois READMEs (tabela de features,
tabela de skills, lista de commands). Corrigir o item 4 da seção de versionamento do
`CLAUDE.md`, que manda atualizar uma string de versão inexistente nos READMEs.

### 6.8 Questão de escopo em aberto (não perguntada)

**Persistência de cenários** — um `docs/e2e/*.md` com a bateria, para re-rodar depois como
suíte de regressão. É quase de graça (o agente já lê/escreve markdown) e "quero rodar de novo"
é o pedido natural seguinte. Proposta: fora do v1, decidir com o usuário.

---

## 7. Próximo passo ao retomar

1. Reapresentar §5.1–5.3 e obter aprovação — em especial: **o corte do agente** (§5.1) e se os
   **quatro vereditos** são úteis ou cerimônia demais.
2. Apresentar §6.1–6.7 por seções, com aprovação a cada uma.
3. Decidir §6.8 (persistência de cenários).
4. Promover este arquivo a spec aprovada (remover o cabeçalho de STATUS), rodar a
   auto-revisão do spec, submeter à revisão do usuário.
5. Invocar `writing-plans` para o plano de implementação.

**Processo:** este design saiu da skill `superpowers:brainstorming`. O terminal dela é
`writing-plans` — não invocar nenhuma outra skill de implementação antes disso.

---

## 8. Cronologia da sessão — e por que a ordem importa

Registrado porque a sequência muda a leitura das decisões da §4.

1. O usuário trouxe o aprendizado da outra sessão (build + execução + navegação autônoma num
   app FMX), colou o que aquela sessão afirmou, o prompt que ela gerou, e pediu **validação**.
2. Validei contra o repo real → §1 e §2 deste documento. O erro mais grave foi ela ter lido a
   cópia do marketplace e concluído que o repo era markdown puro, ignorando a KB RAG.
3. Perguntei escopo e nomenclatura → decisões **1 e 2**.
4. Rodei `superpowers:brainstorming`. Perguntas 1 a 4 → decisões **3, 4, 5, 6**.
5. Apresentei as abordagens A/B/C → decisão **7** (C: skill + agente + comando).
6. **⚠️ AQUI VEIO O REFRAME.** O usuário explicou o propósito real (§3) — Playwright para
   desktop, cenários com veredito, leitura de log. O design anterior era outro produto.
7. Reperguntei sob o enquadramento novo → decisões **8, 9, 10, 11**.
8. Apresentei §5.1–5.3. O usuário interrompeu para reiniciar/desligar antes de aprovar.

### ⚠️ Decisões tomadas ANTES do reframe — revalidar ao retomar

**A decisão 7 já está superada:** a 8 (execução no contexto principal) esvazia o agente
executor da abordagem C. É exatamente o "ponto aberto" da §5.1 — perguntei e o usuário não
respondeu. **Não tratar a 7 como válida sem confirmar.**

As decisões **3, 4, 5 e 6** foram tomadas sob o enquadramento antigo (smoke test). Minha
leitura é que sobrevivem ao reframe, mas vale conferir com o usuário em vez de assumir:

| # | Decisão | Sobrevive ao reframe? |
|---|---|---|
| 3 | Delegar build à `delphi-build` | Sim, sem ressalva — independe do enquadramento. |
| 4 | Gate explícito antes do 1º clique | Sim, e **ganhou peso**: agora o gate também lista quais cenários gravam dados (decisão 9). |
| 5 | FMX validado + VCL fallback, Android fora | Sim, sem ressalva. |
| 6 | Roteiro livre por padrão, dirigido por argumento | Sim, mas **mudou de significado**: "dirigido" agora quer dizer *cenários de teste* (`/e2e login: senha em branco, senha errada`), não *telas a visitar*. |

### O que o usuário NÃO pediu (não inventar ao retomar)

- Trilha Android/`adb` — recusada explicitamente: *"Android não faremos essa navegação no app"*.
- Persistência de cenários como suíte de regressão — é ideia minha (§6.8), nunca foi pedida.
- Instrumentar o app à revelia — a decisão 10 é **oferecer** a unit de logging, nunca impor.
