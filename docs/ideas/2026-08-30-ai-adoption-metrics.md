# Ideia — Métricas de adoção de IA no desenvolvimento

> **STATUS: IDEIA REGISTRADA — não desenhada, não aprovada, sem brainstorm.**
> Levantada por Adriano em 2026-08-30, no meio do design do `/e2e`. Guardada para
> uma sprint futura. Ao pegar isto: rodar `superpowers:brainstorming` do zero — as
> perguntas da §7 nunca foram feitas.

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

**(i) Local + digest commitado — recomendado para o v1.** Cada dev roda `/ai-report --export`,
que gera um digest **só com contagens** (por dia, extensão, skill — nunca prompts, nunca
código) em `docs/metrics/<dev>-<AAAA-MM>.json`. O líder roda `/ai-report --team` e consolida
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

## 8. Esboço de v1, se aprovado

Comando `/ai-report`, analisador post-hoc read-only:

- Entrada: `~/.claude/projects/**/*.jsonl` + `git log` do repo corrente.
- Argumentos: período (`/ai-report 2026-08-01..2026-08-31`), escopo (repo atual por padrão).
- Saída: markdown com tempo ativo, % de linhas de origem IA, quebra por dia / extensão /
  skill, e um bloco explícito de **cobertura e ressalvas**.
- Persistência: cache incremental em SQLite (`~/.claude/delphi-dev/metrics.db`) — mesmo
  padrão do `rag.db` que o plugin já usa.
- Encaixe técnico: `scripts/` já tem TypeScript + `better-sqlite3` + vitest. O analisador
  cai natural ali.
