# Ideia — Métricas de adoção de IA no desenvolvimento

> **STATUS: IDEIA REGISTRADA — não desenhada, não aprovada, sem brainstorm.**
> Levantada por Adriano em 2026-08-30, no meio do design do `/e2e`. Guardada para
> uma sprint futura. Ao pegar isto: rodar `superpowers:brainstorming` do zero — as
> perguntas da §7 nunca foram feitas. **Nome já decidido: `/ai-metrics` (§8.7).**
> **§8 tem o refinamento do usuário** (ativação por comando) e a restrição técnica que
> vem do postmortem da v2.2.2.
> **⚠️ LER A §10 PRIMEIRO.** A validação de 2026-08-30 mudou a recomendação: a Anthropic já
> entrega nativamente as duas métricas pedidas. Construir do zero seria reimplementar — pior —
> o que já existe. A §9 (esboço de v1 custom) está **superada** pela §10.
> **E LER A §11 DEPOIS:** a §10 raciocinava sobre o time do Adriano; o plugin roda para
> qualquer dev do mundo. A §11 corrige o enquadramento e fixa a recomendação final.

## 1. O pedido, nas palavras do usuário

Adriano lidera um time de desenvolvedores e está "forçando" o time a usar IA para
construir a aplicação e corrigir bugs. Quer um relatório que diga:

- "Entre 1 e 31 de agosto, a adoção de IA no desenvolvimento foi de **X horas**."
- "No período, **X%** do código-fonte foi produzido com IA."

E que o plugin monitore e persista isso em algum lugar.

## 2. O dado já existe — verificado nesta máquina em 2026-08-30

Este é o achado que muda o desenho: **não é preciso instrumentar nada para ter o v1.**
O Claude Code já grava tudo localmente.

| Fonte | Caminho | O que tem | Volume medido aqui |
|---|---|---|---|
| Transcripts | `~/.claude/projects/<slug-do-cwd>/<sessionId>.jsonl` | `timestamp`, `cwd`, `gitBranch`, `version`, `type`, `message.content[].tool_use` (Edit/Write com `file_path` e conteúdo), `message.usage` (tokens in/out/cache), `attributionSkill`, `attributionPlugin` | **651 sessões, 820 MB** |
| Índice de prompts | `~/.claude/history.jsonl` | 1 linha por prompt: `display`, `timestamp`, `project`, `sessionId` | leve — bom índice de entrada |
| Snapshots de arquivo | `~/.claude/file-history/<sessionId>/<hash>@vN` | versões reais dos arquivos tocados pela IA | 67 sessões com snapshot |
| Uso por turno | `~/.claude/usage-log.txt` | já produzido pelo `claude-usage-monitor-hook.js` do próprio usuário: tokens, modelo, % de quota | ativo |

**Consequência prática:** o v1 pode ser um **analisador post-hoc, read-only**. Não depende
de hooks — o que importa muito, porque os hooks do plugin estão **OFF desde o v2.2.2** e só
voltam com o item 5 do backlog v3.0 (MCP local). Este desenho contorna o bloqueio inteiro.

## 3. Métrica 1 — "horas de adoção"

Tempo de parede da sessão **não** serve: uma sessão aberta das 9h às 18h com 40 min de uso
real reportaria 9 horas.

**Proposta: tempo ativo com corte de ociosidade.** Soma dos intervalos entre eventos
consecutivos da mesma sessão, descartando gaps acima de um limite (proposta: 5 min).

Nome honesto no relatório: **"tempo ativo assistido por IA"**. Não é "horas economizadas"
nem "horas de trabalho do time" — é tempo de relógio com sessão engajada. Rotular errado
transforma um número defensável em munição para questionamento.

## 4. Métrica 2 — "% de código produzido com IA" (aqui mora a armadilha)

Três definições possíveis, com resultados muito diferentes para o mesmo período:

**(a) Por trailer de commit.** Commits com `Co-Authored-By: Claude` sobre o total.
Barato e auditável, mas *all-or-nothing*: um commit com 1 linha da IA e 400 do humano
conta como 100% IA.

**(b) Por linha, cruzando transcript com git.** Extrai os `Write`/`Edit` do transcript,
monta o conjunto de linhas de origem IA por arquivo, cruza com `git log --numstat` do
período. Numerador = linhas do diff que casam com conteúdo escrito pela IA; denominador =
todas as linhas do diff. É o que produz o número que o usuário pediu.

**(c) Por sobrevivência.** Quantas linhas de origem IA ainda estão vivas no `HEAD`.
Responde outra pergunta — "a IA produziu código que ficou de pé?" — mais ligada a
qualidade do que a adoção. Fora do v1.

**Recomendação: (b) como número principal, (a) como conferência.** Divergência grande
entre os dois é sinal de defeito no pipeline, não de mudança de comportamento do time.

## 5. Onde persiste — o problema real é o time, não a métrica

O dado nasce na máquina de cada dev. Três arranjos:

**(i) Local + digest commitado — recomendado para o v1.** Cada dev roda `/ai-metrics export`,
que gera um digest **só com contagens** (por dia, extensão, skill — nunca prompts, nunca
código) em `docs/metrics/<dev>-<AAAA-MM>.json`. O líder roda `/ai-metrics report --team` e consolida
o que estiver no repo. Zero infraestrutura.

**(ii) Central via OpenTelemetry.** O Claude Code expõe telemetria OTel (variável
`CLAUDE_CODE_ENABLE_TELEMETRY` — **confirmar a superfície atual antes de desenhar**). Um
collector no VPS Hostinger que o Adriano já opera (Docker Swarm + Traefik) + Grafana daria
dashboard ao vivo. Custo: infraestrutura para manter, e o dado do OTel é mais grosso —
não entrega % de linhas.

**(iii) Analytics gerenciado da Anthropic.** Planos Team/Enterprise têm dashboard de uso do
Claude Code. **Verificar isto ANTES de construir qualquer coisa** — pode entregar metade do
pedido de graça.

## 6. Riscos que precisam entrar no desenho, não ser descobertos depois

1. **Goodhart e vigilância.** No instante em que "% de IA" vira meta, o número para de medir
   adoção e passa a medir o esforço de parecer aderente — devs mandam a IA escrever o
   trivial. Recomendação forte: **agregado de time por padrão, per-dev só com opt-in
   explícito**, nunca atrelado a avaliação individual. É decisão de gestão, não técnica, mas
   o desenho da ferramenta facilita ou dificulta o abuso.
2. **Cobertura parcial.** Só enxerga sessões do Claude Code na máquina com o coletor.
   Claude web/desktop, IDE de outro dev, Copilot, ChatGPT no browser: invisíveis. O
   relatório **precisa declarar a cobertura**, senão o número é falso com cara de exato.
3. **"% de código" não é "% de valor".** Uma linha escrita pela IA pode ter custado 40 min de
   revisão. Publicar as duas métricas juntas ajuda; publicar só a segunda engana.
4. **Privacidade.** Transcripts contêm prompts, código de cliente e ocasionalmente
   credenciais. O digest exportado **nunca** carrega conteúdo — só contagens. Regra dura.
5. **Retenção.** 820 MB de transcript nesta máquina, e o Claude Code expira transcript antigo.
   A coleta tem que ser **incremental e persistir o agregado**, senão o histórico evapora
   antes do primeiro relatório anual.

## 7. Perguntas em aberto (nunca feitas ao usuário)

1. O time inteiro usa Claude Code, ou é mistura de ferramentas? Define se o número é
   representativo ou só mede uma fatia.
2. O time está em plano Team/Enterprise da Anthropic? Pode já existir dashboard pronto.
3. Relatório **per-dev** ou **só agregado**? É a decisão mais sensível — muda o desenho
   inteiro e tem consequência de gestão, não só técnica.
4. Isto vira capacidade do `delphi-dev` ou **plugin separado**? O `delphi-dev` se define como
   "plugin que faz o Claude ser expert em Delphi"; métrica de processo de time é outro
   produto. Conflito de escopo real, a resolver antes de escrever código.

## 8. Refinamento do usuário (2026-08-30) — a ativação é um comando

> "Implementar no `delphi-dev` um comando que starte a regra, tipo `/timecount` ou `/clock`.
> O dev ativa e pronto, o próprio plugin começa a contabilizar o uso e persistir."

Isto **melhora** o desenho por um motivo que não é técnico: ativação pelo próprio dev é
**opt-in explícito**, e é exatamente a mitigação do risco 6.1 (vigilância). Coleta silenciosa
vira coleta consentida.

### 8.1 A realidade técnica: o comando não pode SER o contador

Um slash command no Claude Code é markdown injetado no prompt — roda **dentro** da conversa e
termina com o turno. Não deixa processo rodando. Quem observa evento a evento é **hook**
(`Stop`, `PostToolUse`).

Logo, o papel do comando é **armar** o contador: registrar o hook, gravar o consentimento,
marcar o início. Não contar.

### 8.2 Metade da encanação já existe

`installer/src/hooks.ts` já tem **`registerHooks()` / `removeHooks()`** escrevendo em
`~/.claude/settings.json`, com 3 testes passando. Foi mantido intacto no hotfix v2.2.2 mesmo
com os hooks desligados.

### 8.3 Restrição dura, vinda do postmortem da v2.2.2

Por que os hooks morreram (diagnóstico confirmado no código):

1. `installer/src/hooks.ts` aponta os comandos para `${PLUGIN_BASE}/scripts/capture.js`, mas o
   `tsconfig` compila em `scripts/dist/`. Caminho errado.
2. `dist/` **não é versionado**, e o installer faz `git clone --depth=1` **sem** `npm install` /
   `npm run build` → os `.js` simplesmente não existem na máquina do dev.
3. `scripts/package.json` depende de `better-sqlite3`, `@xenova/transformers` e `sqlite-vec` —
   **nativas e pesadas**.

**Portanto o hook do relógio precisa ser:** um **único `.js` sem nenhuma dependência,
commitado no repo** (não compilado, fora de `dist/`), que só faz *append* num JSONL. Sem
build, sem native deps, funciona em clone limpo. É o que o faz sobreviver ao modo de falha
que matou os hooks do RAG.

> Isto também explica por que o relógio pode voltar **antes** do MCP local (item 5 do backlog
> v3.0): ele não precisa de embeddings nem de SQLite nativo no ambiente do dev.

### 8.4 A ativação é marcador, não pré-requisito

Como os transcripts (§2) já registram tudo, `/ai-metrics report` consegue responder
**retroativamente** sobre período anterior à ativação. O `on` registra consentimento e liga a
captura durável; não é condição para haver número.

### 8.5 Superfície proposta

| Comando | O que faz |
|---|---|
| `/ai-metrics on` | Registra o hook, grava consentimento e o instante de início. **Declara na hora o que é coletado e o que nunca é** (nunca prompt, nunca código — só contagens). |
| `/ai-metrics off` | Remove o hook. Preserva o ledger já acumulado. |
| `/ai-metrics status` | Ligado desde quando, cobertura, totais correntes. |
| `/ai-metrics report <período>` | O relatório da §3/§4. Backfill por transcript quando o período antecede a ativação. |

### 8.6 Mecanismo de persistência — decidir no brainstorm

- **Ledger append-only JSONL** (`~/.claude/delphi-dev/clock/<AAAA-MM>.jsonl`), escrito pelo
  hook sem dependência. Durável: sobrevive à expiração do transcript.
- **Agregado em SQLite** só no momento do `report`, montado pelo `scripts/` (que já tem
  `better-sqlite3` e roda na máquina do desenvolvedor do plugin, não do usuário final).
- **Escopo do ledger:** global ou por projeto? Em aberto — ver §7.

### 8.7 Nome — DECIDIDO: `/ai-metrics`

**Escolhido pelo usuário em 2026-08-30.** Em inglês, conforme a convenção do repo (refactor
dedicado, commit `e359d92`). Descartados: `/clock` (ambíguo com hora do dia), `/track`
(genérico demais, e a conotação de rastrear pessoa é justamente a leitura que o desenho quer
evitar), `/timecount` (nomeia só as horas e deixa de fora o % de código).

Skill correspondente, seguindo o padrão do repo: **`delphi-ai-metrics`**.

**Cuidado de gatilho a verificar no desenho:** o repo já tem `/dashboard`. Conferir se as
`description` das duas não colidem na auto-ativação — mesmo problema que a §6 do design do
`/e2e` levantou entre `delphi-e2e` e `delphi-tests`.

## 9. Esboço de v1, se aprovado

Comando `/ai-metrics report`, analisador post-hoc read-only:

- Entrada: `~/.claude/projects/**/*.jsonl` + `git log` do repo corrente.
- Argumentos: período (`/ai-metrics report 2026-08-01..2026-08-31`), escopo (repo atual por padrão).
- Saída: markdown com tempo ativo, % de linhas de origem IA, quebra por dia / extensão /
  skill, e um bloco explícito de **cobertura e ressalvas**.
- Persistência: cache incremental em SQLite (`~/.claude/delphi-dev/metrics.db`) — mesmo
  padrão do `rag.db` que o plugin já usa.
- Encaixe técnico: `scripts/` já tem TypeScript + `better-sqlite3` + vitest. O analisador
  cai natural ali.


---

## 10. ⚠️ VALIDAÇÃO (2026-08-30) — a Anthropic já entrega isso; a recomendação MUDOU

O usuário pediu que eu validasse a questão 7.2 ("o time está em plano Team/Enterprise?").
A resposta reescreve a ideia inteira.

### 10.1 Decisões do usuário registradas nesta rodada

| Pergunta (§7) | Resposta |
|---|---|
| 7.3 — per-dev ou agregado? | **Per-dev**, com **configuração de "onde" persistir** (o time todo usa o plugin) |
| — escopo do ledger | **Global**, com **override por projeto** se der |
| 7.4 — plugin separado? | **Parte do `delphi-dev`** |
| 7.2 — plano Team/Enterprise? | **Delegada a mim para validar** → §10.2 |

Relaxamento importante declarado pelo usuário: *"Nem precisa ser exato, apenas fazer cálculos
durante as sessões e ir armazenando."* Isso derruba a exigência de precisão da métrica 2
(§4) — e, combinado com a §10.2, muda qual caminho vale a pena.

### 10.2 O que já existe nativamente (verificado na doc oficial)

**A) Dashboard de analytics — planos Claude for Teams / Enterprise**
`claude.ai/analytics/claude-code` (Admin/Owner). Entrega:

- **Lines of code with CC** e **PRs with CC** — o numerador da métrica 2
- **PRs with Claude Code (%)** — literalmente o "X% do código foi produzido com IA"
- **Suggestion accept rate**, daily active users, sessions
- **Leaderboard por usuário** + **export CSV de todos os usuários**
- Atribuição por PR feita **exatamente** como eu propus na §4(b) — casa as linhas do diff do PR
  contra a saída das sessões, com normalização — **e com refinamentos que nós erraríamos:**
  janela de 21 dias antes / 2 dias depois do merge, código reescrito pelo humano em >20% deixa
  de ser atribuído, e exclusão automática de lockfiles, código gerado, `dist/`, minificados e
  linhas >1000 chars. PRs merged ganham label `claude-code-assisted` no GitHub.

**B) OpenTelemetry — qualquer plano**
`CLAUDE_CODE_ENABLE_TELEMETRY=1` + exporter OTLP. Métricas exportadas:

| Métrica | Relevância |
|---|---|
| **`claude_code.active_time.total`** (segundos) | **É a métrica 1 pronta** — tempo ativo, já excluindo ociosidade, calculado pelo próprio Claude Code |
| `claude_code.lines_of_code.count` | linhas modificadas |
| `claude_code.commit.count` / `pull_request.count` | volume entregue |
| `claude_code.token.usage` / `cost.usage` | custo |
| `claude_code.session.count` | sessões |

Com atribuição per-dev nativa: `user.email`, `user.account_uuid`, `organization.id`,
`session.id`. **Responde a decisão "per-dev" sem escrever uma linha de código.**

**C) APIs de export**
Enterprise: Claude Enterprise Analytics API (escopo `read:analytics`) — **não disponível no
plano Teams**. Clientes de API/Console: Claude Code Analytics API com Admin API key.

### 10.3 O que isso invalida do desenho anterior

- **§3 (cálculo de horas com corte de ociosidade):** desnecessário. `active_time.total` já faz,
  e melhor.
- **§4 (cruzar transcript com git para o % de código):** desnecessário **se** houver
  Team/Enterprise + GitHub. A implementação deles é mais cuidadosa que a nossa seria.
- **§8.3 (hook `.js` sem dependência):** só se justifica no cenário sem Team/Enterprise **e**
  sem collector OTel.
- **§9 (esboço de v1 custom):** **superado.** Mantido no arquivo só como registro.

### 10.4 Lacunas reais — onde o plugin AINDA agrega

O nativo não cobre tudo. Vale construir onde:

1. **O time não está em Team/Enterprise.** Se são contas Pro/Max individuais, o dashboard de
   contribuição **não existe** para eles. Só sobra OTel.
2. **Contribution metrics exigem GitHub** (Cloud ou Enterprise Server) + GitHub App instalado
   por admin + role Owner no claude.ai. GitLab / Azure DevOps / Bitbucket ficam de fora.
3. **Zero Data Retention desliga** as contribution metrics.
4. **Cobre só usuários dentro da org claude.ai** — uso via Console API não entra.
5. **Nada disso é específico de Delphi**, nem sabe separar `.pas`/`.dfm`/`.dpr` de outros
   arquivos, nem correlacionar com as skills do `delphi-dev`.
6. **Setup é chato:** OTel exige env vars + collector. Um comando que configura isso tem valor
   real, mesmo sem medir nada por conta própria.

### 10.5 Recomendação revisada — três caminhos, em ordem de custo

**Caminho 1 — Dashboard nativo (custo ~zero).** Se o time está em Team/Enterprise: ligar o
GitHub App e o toggle de analytics. Entrega as duas métricas pedidas em 24h, sem código.
`/ai-metrics` vira, no máximo, um leitor do CSV exportado que renderiza o relatório no
terminal com recorte Delphi.

**Caminho 2 — OTel + collector (custo baixo, recomendado se não houver Team/Enterprise).**
`/ai-metrics on` **configura a telemetria** (env vars + endpoint) em vez de implementar
contador próprio. O `active_time.total` já resolve a métrica 1 corretamente. O destino do
endpoint responde a pergunta do usuário sobre "onde persistir" para o time inteiro — e ele já
opera um VPS Hostinger com Docker Swarm + Traefik, onde um collector + Grafana caberia.
Configuração global em `~/.claude/settings.json` com override por projeto em
`.claude/settings.json` — que é exatamente como o Claude Code já resolve configuração.

**Caminho 3 — Hook próprio (custo alto).** Só se: sem Team/Enterprise **e** sem apetite para
rodar collector. Aí valem a §8.3 e a §8.4. Dado o "nem precisa ser exato", um hook simples
contando eventos e tempo entre eles por sessão é suficiente — mas ainda é a opção mais cara
para o pior resultado.

### 10.6 Pergunta que destrava a escolha

**Em que plano o time está?** Team/Enterprise → Caminho 1. Contas individuais Pro/Max →
Caminho 2. É a única informação que falta para decidir.

Segunda pergunta, menor: **o time usa GitHub?** Se for GitLab/Azure DevOps, o Caminho 1 perde
as contribution metrics mesmo com Team/Enterprise, e cai no Caminho 2.


---

## 11. ✅ CORREÇÃO DE ENQUADRAMENTO (2026-08-30) — recomendação FINAL

> Correção do usuário: *"Não há como saber. Lembre-se, isso é um plugin que pode estar sendo
> usado por qualquer dev no mundo inteiro."*

**Ele está certo, e isso invalida a pergunta da §10.6.** Eu estava desenhando para o time dele.
O `delphi-dev` é distribuído publicamente: o usuário típico pode ser um dev solo em Pro, uma
casa de software de 5 pessoas, ou uma empresa em Enterprise. **Não existe "o plano do time"** —
existe o plano de *cada instalação*.

### 11.1 A consequência: plano é variável de runtime, não entrada de design

O `/ai-metrics on` tem que **detectar o ambiente e se adaptar**, nunca assumir. O comando
deixa de ser "um medidor" e vira **um roteador de setup**: descobre o que está disponível
naquela máquina/conta e liga o melhor caminho possível ali.

### 11.2 A escada de fallback, do melhor dado ao sempre-disponível

| Nível | Mecanismo | Requisito | Quem alcança |
|---|---|---|---|
| 1 | **Dashboard nativo** (`claude.ai/analytics/claude-code`) | Team/Enterprise + GitHub App + role Owner | minoria dos usuários do plugin |
| 2 | **OTel → collector** | qualquer plano, mas exige **ter onde mandar** (collector + infra) | quem já tem observabilidade |
| 3 | **Ledger local via hook** | nada | **todo mundo** |

**O nível 3 tem que ser o padrão.** Não porque é o melhor dado — não é — mas porque é o
único que funciona para **todos** os usuários do plugin, com zero infraestrutura e zero
privilégio administrativo. Um dev Delphi solo não tem org no claude.ai nem collector no VPS;
para ele, os níveis 1 e 2 simplesmente não existem.

**Isto ressuscita o "Caminho 3" da §10.5 — por um motivo diferente do original.** Não é a
melhor medição; é a única universal. E o *"nem precisa ser exato"* do usuário é exatamente o
que a torna aceitável como padrão.

### 11.3 Isto REPROMOVE a §8.3 a restrição crítica

Se o hook local é o caminho **padrão** e não mais o último recurso, ele roda na máquina de
todo usuário do plugin — o mesmo público que a v2.2.2 quebrou. Então a regra da §8.3 deixa de
ser precaução e vira requisito de primeira ordem:

> **um único `.js` sem nenhuma dependência, commitado no repo, fora de `dist/`, que só faz
> append em JSONL.** Sem build, sem native deps, funciona em clone limpo.

Repetir o erro aqui quebra a instalação de todo mundo de novo.

### 11.4 O papel de cada nível no comando

- **`/ai-metrics on`** — detecta o ambiente, explica em uma linha o que consegue medir ali,
  liga o nível mais alto disponível e **declara qual foi**. Se detectar Team/Enterprise,
  **aponta para o dashboard nativo em vez de duplicá-lo** — e oferece o nível 3 por cima, pelo
  recorte Delphi que o nativo não dá.
- **OTel** vira **upgrade opcional**, para quem tem onde mandar (o caso do VPS do Adriano é uma
  instância disso, não a especificação).
- **Dashboard nativo** vira **ponteiro**, nunca reimplementação.

### 11.5 Onde o plugin ganha do nativo (e por que a ideia sobrevive)

1. **Alcance.** Funciona para o dev solo, que é a maioria do público do plugin e não tem acesso
   a nada do nível 1.
2. **Recorte Delphi.** Separa `.pas` / `.dfm` / `.dpr` / `.dproj` do resto e correlaciona com as
   skills do `delphi-dev` (`attributionSkill` já está no transcript). O nativo não sabe o que é
   Delphi.
3. **Sem privilégio administrativo.** Não exige role Owner nem GitHub App.
4. **Funciona fora do GitHub.** GitLab, Azure DevOps, Bitbucket, SVN, repositório privado.

### 11.6 Status da §10.6

**Pergunta retirada.** Não há "o plano do time" a descobrir. O que era pergunta virou
**requisito**: detectar em runtime e degradar com elegância.
