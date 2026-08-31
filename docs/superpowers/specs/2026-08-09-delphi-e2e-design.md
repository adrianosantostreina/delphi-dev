# Design — `delphi-e2e`: execução de cenários E2E em app Delphi desktop

> **STATUS: DESIGN EM ANDAMENTO — §5 APROVADA, §6 EM APROVAÇÃO.**
> Atualizado em **2026-08-30**.
> §5.1–5.3 **aprovadas** (decisões 12, 13, 14 na §4). §6.1–6.3 apresentadas e aceitas
> ("Certo"); §6.4–6.8 ainda **não apresentadas**.
> Ao retomar: apresentar §6.4–6.7 (mecânicas) e decidir §6.8 (persistência de cenários),
> depois converter em spec aprovada e invocar `writing-plans`.
> **Não refazer as perguntas já respondidas** — 14 decisões travadas na §4.
> **LER A §10 ANTES DE CONTINUAR.** Em 2026-08-30 apareceu na KB compartilhada uma técnica
> NOVA de automação (`fmx-automacao-windows-sem-foco.md`) que substitui o mecanismo em que
> este design inteiro foi baseado. Invalida parte da §6.3 e da §6.4.

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
| 12 | Agente executor | **CORTADO** (2026-08-30). Entrega = **skill + command + entrada no RAG**. A decisão 8 (execução no contexto principal) esvazia o agente; a instrumentação delega ao `delphi-writer`. **Substitui formalmente a decisão 7.** |
| 13 | Vocabulário de veredito | **Quatro**: ✅ PASSOU · ❌ FALHOU · ⛔ BLOQUEADO · ⏭️ PULADO (2026-08-30) |
| 15 | Janela em primeiro plano | **Parâmetro, o dev decide** (2026-08-30). **Default: primeiro plano** — o usuário quer ver o app rodando "na cara dele". Flag para deixar ao fundo, sem interromper quem está na máquina. Ver §10.5. |
| 14 | Isolamento entre cenários | **Navegar de volta pela UI; reiniciar o `.exe` se falhar** — tenta `Cancelar`/`Voltar`/`Esc` e confere pelo screenshot; após 2 tentativas sem sucesso, mata o processo e reabre (2026-08-30) |

---

## 5. Design APROVADO (§5.1–5.3, em 2026-08-30)

### 5.1 Artefatos

| Artefato | Papel |
|---|---|
| `skills/delphi-e2e/SKILL.md` | Protocolo, modelo de cenários, armadilhas, regras de segurança |
| `skills/delphi-e2e/references/gui.ps1` | Harness PowerShell (seção 4 do documento, **sem** o default `"PDV"`) |
| `skills/delphi-e2e/references/logging-unit.md` | Template da unit de logging mínima (caminho de instrumentação) |
| `commands/e2e.md` | Porta explícita, aceita cenários como argumento |
| `knowledge/fmx/fmx-win32-janela-automacao-externa.md` | Conhecimento no RAG, tier canonical |

**RESOLVIDO (2026-08-30) — decisão 12: agente CORTADO.** Não se cria agente novo. A decisão 8
(execução no contexto principal) esvazia o agente executor; a instrumentação delega ao
`delphi-writer` existente. Se depois surgir necessidade de varredura ampla isolada, o agente
entra numa segunda iteração. A tabela de artefatos acima já reflete o corte.

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

**Como reconduz (decisão 14, aprovada em 2026-08-30):** tenta pela UI (`Cancelar`/`Voltar`/`Esc`)
e **confere pelo screenshot** se chegou ao ponto de partida. Se após **2 tentativas** não chegou,
**mata o processo e reabre o `.exe`**. Rápido no caso comum, com saída garantida quando a tela
trava — e nunca reporta FALHOU por contaminação. Reiniciar sempre foi descartado: paga
splash + conexão de banco a cada cenário e perde o estado de sessão que alguns cenários
pressupõem (ex.: "já logado, agora finalizar venda").

---

## 6. Seções 6.1–6.3 aceitas (2026-08-30); **6.2–6.4 reescritas em 2026-08-31**; 6.5–6.8 a apresentar

### 6.1 Descoberta e leitura do log

Ordem de descoberta: (a) o usuário informa; (b) `config.ini` do **diretório do `.exe`**
(chaves `Log`/`LogFile`/`LogPath`); (c) `*.log`/`*.txt` no diretório do `.exe` modificados
após o start do processo; (d) nada → degrada para veredito visual **e declara isso**.

Delta por byte offset (marca antes do cenário, lê só o acrescentado depois).

**Armadilha técnica a documentar:** o app Delphi costuma manter o log aberto com lock de
escrita (`TFileStream`/`TStreamWriter` com `fmShareDenyWrite`). `Get-Content` falha. Abrir com
`[System.IO.FileStream]::new(path, Open, Read, ReadWrite)` — `FileShare.ReadWrite` — senão a
leitura do log quebra em silêncio no meio da bateria.

### 6.2 Quando não há log — DUAS ofertas, não uma (revisado 2026-08-31)

Se o app não tem log, o plugin **oferece** (nunca impõe — mexe no código do usuário) um de dois
caminhos. Só executa mediante aceite explícito, e a escolha depende do que o cenário testa.

**A escolha importa porque automação de UI serve bem para uma coisa e mal para outra:**
`PostMessage` confere **layout e navegação**. Para lógica — rede, sessão, cache, parsing,
concorrência — dirigir a tela é caro, lento e frágil.

| Oferta | Para quê | O que gera |
|---|---|---|
| **Unit de logging** | dar rastro ao que já existe, para correlacionar com a tela | append thread-safe, timestamp, chamada simples (`references/logging-unit.md`) |
| **Modo `--selftest`** | testar **lógica** sem abrir interface | bateria headless contra a API real, grava `selftest.log` ao lado do `.exe` e **sai com o número de falhas como exit code** |

O `--selftest` é frequentemente a resposta melhor, e é o que o documento-fonte recomenda: mais
barato e mais confiável que clicar. Quando o cenário do usuário for de lógica, **oferecer o
selftest antes** de propor a navegação.

**Três detalhes de implementação que já custaram caro:**

1. **Gravar o log a cada linha, não no fim.** Se travar, a última linha diz onde. E — crítico —
   `Writeln` em app console com stdout redirecionado **não aparece sem `Flush(Output)`**, e um
   `Stop-Process -Force` descarta o buffer inteiro
   (`knowledge/core/console-writeln-sem-flush-nao-loga.md`). Log de verdade vai para **arquivo
   próprio**, nunca para stdout.
2. **`FindCmdLineSwitch` remove UM caractere de switch:** `--selftest` chega como `-selftest` e
   **não casa** com o switch `'selftest'`. Aceitar as duas formas:
   `FindCmdLineSwitch('selftest', True) or FindCmdLineSwitch('-selftest', True)`.
3. **Incluir um caso de concorrência** (N requisições em paralelo). Expõe bug de conexão
   compartilhada que teste sequencial nunca pega — exatamente o que
   `knowledge/core/horse-conexao-por-requisicao.md` documenta.

**Consequência para a §6.1:** a descoberta de log pode terminar em "não há log **e** o usuário
recusou instrumentar". Nesse caso o veredito degrada para **visual** e isso é **declarado no
relatório** — nunca silenciosamente.

### 6.3 Regras de segurança (reescritas sobre o mecanismo sem foco)

1. Nunca gravar **por iniciativa própria** — explora, captura, sai pelo `Cancelar`/`Voltar`.
2. Cenário que grava só roda se o usuário pediu **e** confirmou no gate.
3. O gate lista: cenários pretendidos, quais gravam, e o que gravam. **Para e espera.**
4. **Capturar só a janela do app, nunca a tela.** Com `PrintWindow` isso é garantia estrutural,
   não disciplina: a API captura a janela alvo por construção, mesmo coberta por outras. É uma
   proteção de privacidade mais forte que recortar um screenshot de tela cheia.
5. **Declarar em que modo rodou** — primeiro plano (default) ou ao fundo. Substitui a antiga
   regra "declarar se roubou o foco": com `PostMessage`/`WM_CHAR` o agente **não rouba foco nem
   move o cursor** em nenhum dos modos, e isso é argumento de venda, não ressalva.
6. Credenciais do banco local do projeto; **nunca** ecoar senha em texto claro.
7. Declarar o estado final: app aberto/fechado, dados alterados/intactos.
8. **Pedir uma única coisa ao usuário:** deixar a janela **aberta, mesmo atrás das outras — não
   minimizar**. Minimizado o Windows para de renderizar; dá para restaurar sozinho, mas custa
   segundos por ciclo (ver armadilha 4).

### 6.4 Armadilhas técnicas — reescritas para `PostMessage` / `PrintWindow`

As cinco armadilhas do documento original foram **substituídas**, não ajustadas: duas sumiram
com a troca de mecanismo e três novas apareceram. Fonte:
`fmx-automacao-windows-sem-foco.md`.

**Obsoletas** (não reintroduzir): `SetForegroundWindow` falhando calado, e o primeiro clique
engolido após mudança de foco. Nenhum dos dois existe quando não se pede foco. A regra de
recalcular a `RECT` antes de cada clique também cai: `PostMessage` usa **coordenadas de
cliente**, então arrastar a janela deixa de importar para o clique.

| # | Armadilha | Regra |
|---|---|---|
| 1 | `Process.MainWindowHandle` é inútil | Devolve a janela-fantasma `TFMAppClass`, muitas vezes com altura 0. A janela real do form tem classe **`FMT<NomeDoForm>`** (ex.: `FMTViewMain`). Enumerar por PID e filtrar `FMT*`. |
| 2 | Há **várias** janelas `FMT*` | Uma por form instanciado, e pode haver **órfãs invisíveis** com a mesma classe e tamanho da real. Escolher sempre a **VISÍVEL de maior área** — pegar só "a de maior área" traz a órfã e o `PrintWindow` sai **preto**. |
| 3 | Ordem importa: restaurar **antes** de escolher | Com o app minimizado nenhuma `FMT*` está visível, então a seleção cai numa órfã e a captura sai preta — **mesmo restaurando logo depois**. Ordem: restaurar → escolher janela → capturar. |
| 4 | App minimizado ⇒ captura preta | Quem fica *iconic* é a `TFMAppClass`; os forms só viram `IsWindowVisible = False`. Restaurar o form não adianta: `ShowWindow` na janela **iconic** com **`SW_SHOWNOACTIVATE` (4)**. |
| 5 | Coordenadas não batem sozinhas | `PostMessage` usa coordenadas de **cliente**; `PrintWindow` captura a **janela inteira**, com barra de título. **Recortar a captura na área de cliente** faz as coordenadas da imagem baterem **1:1** com as do clique. E `SetProcessDPIAware()` antes de qualquer coordenada. |

**Ritmo:** dar tempo ao app recém-iniciado — clique cedo demais na primeira tela não pega.

**Entrega ≠ efeito.** Um `PostMessage` pode ser entregue e mesmo assim não surtir efeito, se o
controle FMX não estiver no estado esperado. É por isso que o log é lido **em paralelo** (§6.1)
e não como enfeite: sem ele, o agente confunde "cliquei e nada aconteceu" com "cliquei e o app
está errado" — e a diferença é ⛔ BLOQUEADO vs ❌ FALHOU.

**Bônus de graça — detector de vazamento.** Como o FMX cria uma janela nativa por form, listar
as `FMT*` do processo é um detector barato de form vazado: 20 `FMTCompProduto` vivas para 9
produtos denunciam que ninguém está liberando. Vale reportar quando a contagem crescer ao longo
da bateria.

### 6.5 Relatório e bilinguismo

Tabela: cenário | expectativa | resultado | evidência. Mais: o que não rodou e por quê; estado
final. Labels bilíngues conforme a convenção do repo —
pt-BR `✅ PASSOU / ❌ FALHOU / ⛔ BLOQUEADO / ⏭️ PULADO` ↔
en-US `✅ PASS / ❌ FAIL / ⛔ BLOCKED / ⏭️ SKIPPED`, com tabela de mapeamento.

### 6.6 Guarda Windows-only

`user32.dll` não existe fora do Windows → detectar e recusar limpo. **Sem** apontar o caminho
`adb` (decisão 5: Android fora).

### 6.7 Versionamento e READMEs

**Atualizado 2026-08-31:** a **3.1.0 já foi usada** (correções do `/new-project` e do RAG,
publicada). O `/e2e` entra como **3.2.0**.

Sincronizar `plugin.json`, `marketplace.json` e `commands/about.md` (2 linhas: Version/Versão).
Atualizar os dois READMEs: tabela de features (linha do `/e2e`), tabela de skills
(`delphi-e2e`) e lista de commands. **Os READMEs não têm string de versão** — o item 4 da seção
de versionamento do `CLAUDE.md` mandava atualizar um texto inexistente e **já foi corrigido**
(commit `8b80370`).

### 6.8 Questão de escopo em aberto (não perguntada)

**Persistência de cenários** — um `docs/e2e/*.md` com a bateria, para re-rodar depois como
suíte de regressão. É quase de graça (o agente já lê/escreve markdown) e "quero rodar de novo"
é o pedido natural seguinte. Proposta: fora do v1, decidir com o usuário.

---

## 7. Próximo passo ao retomar (atualizado 2026-08-30)

1. ~~Reapresentar §5.1–5.3~~ **FEITO** — aprovadas, decisões 12/13/14.
2. ~~Apresentar §6.1–6.3~~ **FEITO** — aceitas.
3. ~~Apresentar §6.4–6.7~~ — **§6.2–6.4 reescritas em 2026-08-31** sobre o mecanismo sem foco,
   após leitura completa de `fmx-automacao-windows-sem-foco.md`. §6.5–6.7 seguem mecânicas.
4. **Decidir §6.8** — persistência de cenários em `docs/e2e/*.md` como suíte de regressão.
   É a única pergunta de escopo que resta. Proposta original: fora do v1.
5. Promover este arquivo a spec aprovada (remover o cabeçalho de STATUS), rodar a
   auto-revisão do spec, submeter à revisão do usuário.
6. Invocar `writing-plans` para o plano de implementação.

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

**A decisão 7 foi RESOLVIDA em 2026-08-30:** confirmada como superada. A 8 (execução no
contexto principal) esvaziava o agente executor da abordagem C, e o usuário aprovou o corte
— ver **decisão 12**. A abordagem final é **skill + command + RAG**, sem agente.

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


---

## 9. Sessão de 2026-08-30 — o que andou

1. Retomei lendo `docs/handoff.md` e este arquivo. Nenhuma pergunta refeita.
2. Reapresentei **§5.1** (artefatos, fronteira com `delphi-build`, `gui.ps1` de `%TEMP%`) e
   fiz a única pergunta aberta → **decisão 12: agente cortado**.
3. Reapresentei **§5.2** (modelo de cenário) → **decisão 13: quatro vereditos**.
4. Reapresentei **§5.3** (ciclo de execução) com a pergunta que faltava — *como* reconduzir o
   app entre cenários → **decisão 14: navegar de volta, reiniciar se falhar**.
5. Apresentei **§6.1–6.3** (descoberta/leitura de log, instrumentação, regras de segurança).
   Aceitas.
6. O usuário interrompeu aqui para registrar uma **ideia nova** (métricas de adoção de IA no
   time) → `docs/ideas/2026-08-30-ai-adoption-metrics.md`. Não faz parte do `/e2e`.

**Nada de código escrito.** Só docs. O `writing-plans` continua sendo o terminal deste
brainstorm — não invocar skill de implementação antes dele.


---

## 10. MECANISMO SUPERADO (descoberto em 2026-08-30) — revisar antes de escrever código

Ao inventariar a KB compartilhada do usuário, apareceu um documento **novo, do mesmo dia**,
que **substitui o mecanismo em que este design foi baseado**:

`C:/Users/User/.claude/shared/delphi-knowledge/fmx-automacao-windows-sem-foco.md`
— *"[FMX/Windows] Automatizar um app FireMonkey sem roubar foco nem mexer no cursor"*

### 10.1 O que mudou

Este design herdou de `fmx-win32-janela-automacao-externa.md` a técnica de
**`SetForegroundWindow` + `SetCursorPos` + `mouse_event`** — que rouba o foco e sequestra o
cursor. O documento novo **desaconselha explicitamente** essa abordagem, com sintoma real
observado: *a pessoa digitava, o script mandou `cola` no campo do app, e o texto dela vazou
junto — o campo ficou `tácola`.*

A substituição:

| Ação | Antes (este design) | Agora | Por quê |
|---|---|---|---|
| Clique | `SetCursorPos` + `mouse_event` | **`PostMessage`** de `WM_MOUSEMOVE`/`WM_LBUTTONDOWN`/`WM_LBUTTONUP` | vai direto à fila da janela; **não precisa de foco e não toca no cursor** |
| Texto | `SendKeys` / foco + teclado | **`WM_CHAR`** na mesma fila | não depende de foco e **não sofre com acento morto** de teclado ABNT |
| Screenshot | recorte da tela pela `RECT` | **`PrintWindow`** com flag **2** (`PW_RENDERFULLCONTENT`) | captura **mesmo com a janela coberta** |

### 10.2 O que isso invalida neste documento

- **§6.4, armadilha 3.2** (`SetForegroundWindow` falha calado, combo completo, abortar na
  segunda falha) — **obsoleta**: não se pede mais foco.
- **§6.4, armadilha 3.5** (o primeiro clique após mudança de foco é engolido) — **obsoleta**
  pelo mesmo motivo.
- **§6.3, regra 4** (nunca capturar a tela inteira; recortar pela `RECT`) — **superada por algo
  melhor**: `PrintWindow` captura **só** a janela do app por construção, garantia de privacidade
  mais forte do que recortar um screenshot de tela cheia.
- **§6.3, regra 5** (declarar se roubou o foco) — **deixa de ser necessária**; vira "declarar
  que NÃO rouba foco", que é argumento de venda.
- **§6.4, armadilha 3.4** (recalcular `GetWindowRect` antes de cada clique) — **provavelmente
  ainda vale**, mas por outro motivo: com `PostMessage` em coordenadas de cliente, arrastar a
  janela deixa de importar. **Confirmar contra o documento novo.**

### 10.3 O que isso faz com a decisão 8

A decisão 8 foi **"execução no contexto principal, passo a passo visível (igual Playwright)"** —
o usuário queria ver o app operando "na cara dele". Com automação sem foco, o app **pode rodar
ao fundo enquanto ele continua trabalhando**.

Isso não contradiz a decisão — a narração passo a passo continua visível no terminal — mas
**muda a experiência**, e provavelmente para melhor: roda a bateria sem sequestrar a máquina.
**Vale reperguntar** se ele quer a janela em primeiro plano (mais demonstrativo, interrompe)
ou ao fundo (não interrompe, mas ele não "assiste").

### 10.5 Decisão 15 — primeiro plano é PARÂMETRO, e isso sai barato

Resposta do usuário à pergunta da §10.3: *"Realmente, gostaria de ver o app rodando na minha
cara, mas podemos ter um parâmetro para configurar se o app sobe para o topo ou fica debaixo de
outras janelas, o desenvolvedor decide."*

**Default: primeiro plano.** Flag para rodar ao fundo.

**⚠️ CORREÇÃO (2026-08-31) — eu tinha invertido a direção do custo.** A leitura completa de
`fmx-automacao-windows-sem-foco.md` mostra que **o FMX ATIVA o form ao processar o clique, mesmo
vindo de `PostMessage`**. Ou seja: `PostMessage` sozinho **não** mantém a janela ao fundo — ela
sobe sozinha.

Portanto o custo está no **modo ao fundo**, não no primeiro plano:

| Modo | Custo |
|---|---|
| **Primeiro plano (default)** | **zero** — é o comportamento natural do FMX |
| **Ao fundo (flag)** | `SetWindowPos(h, HWND_BOTTOM, SWP_NOMOVE\|SWP_NOSIZE\|SWP_NOACTIVATE)` ao subir o app **e depois de cada clique e cada digitação**, com um `Sleep` curto antes para o FMX terminar de tratar a mensagem |

O `SWP_NOACTIVATE` é o que evita trocar um problema por outro. A decisão 15 continua válida — o
default em primeiro plano é inclusive o mais barato — mas o modo ao fundo **é código a mais no
`gui.ps1`**, não um `if` de exibição.

Consequências:

- **O núcleo do clique e da digitação é o mesmo** nos dois modos; o modo ao fundo acrescenta o
  reposicionamento pós-interação.
- **Nenhum dos dois modos rouba digitação.** Mesmo em primeiro plano, o texto vai por `WM_CHAR`
  para a fila da janela alvo — o bug do `tácola` não volta.
- **O modo ao fundo ganha um caso de uso próprio:** bateria longa rodando enquanto o dev
  trabalha. Vale mencionar no `SKILL.md`.
- **A §6.3 regra 5** ("declarar se roubou o foco") vira **"declarar em que modo rodou"**.

### 10.4 Ação ao retomar

**Antes de apresentar a §6.4, ler `fmx-automacao-windows-sem-foco.md` por inteiro** e reescrever
a §6.4 e a §6.3 sobre o mecanismo novo. O `gui.ps1` da §5.1 muda de implementação — o papel
dele no design permanece.
