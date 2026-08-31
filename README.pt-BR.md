# delphi-dev — Plugin para Claude Code

> Plugin para Claude Code que transforma o assistente em um especialista sênior em Delphi.
> 🇺🇸 [Read in English](README.md)

---

## O que é

**delphi-dev** ativa automaticamente sempre que o Claude Code detecta conteúdo relacionado a Delphi — arquivos `.pas`, `.dpr`, `.dfm`, `.dpk`, `.dproj`, ou qualquer menção a Object Pascal, FireMonkey, VCL, FireDAC ou RAD Studio. Uma vez ativo, o Claude aplica o Delphi Style Guide completo, princípios de Clean Code e padrões SOLID sem precisar ser solicitado.

---

## Funcionalidades

| Comando | Descrição |
|---|---|
| **Modo Delphi Automático** | Ao abrir qualquer arquivo `.pas`, `.dpr` ou `.dfm`, o contexto completo de padrões de codificação é ativado automaticamente |
| **`/audit`** | Gera laudo técnico profissional completo com score por dimensão e roadmap de modernização priorizado |
| **`/review`** | Revisão rápida de código — detecta violações e apresenta exemplos corrigidos |
| **`/write`** | Escreve código novo com todos os padrões aplicados desde o início |
| **`/new-project`** | Scaffold de novo projeto com estrutura de pastas em camadas padronizada |
| **`/spec`** | Analisa o código-fonte do projeto atual e gera automaticamente um `SPEC.md` completo |
| **`/tdd`** | Gera suite completa de testes unitários DUnitX para o projeto |
| **`/e2e`** | Executa cenários end-to-end num app Delphi desktop em execução — builda, abre o `.exe`, opera as telas e devolve um veredito por cenário |
| **`/contribute-kb`** | Empacota os aprendizados locais capturados pelos hooks e abre um PR para a base de conhecimento comunitária *(depende dos hooks, hoje desligados — ver Instalação)* |
| **`/dashboard`** | Exibe métricas do repositório GitHub — estrelas, forks, issues, PRs, commits, releases, contribuidores |
| **`/about`** | Exibe informações do plugin, versão e comandos disponíveis |

---

## Testes end-to-end com `/e2e` <sub>novo na 3.2.0</sub>

Pense nele como um **Playwright para aplicações Delphi desktop**. Você descreve os cenários em
linguagem natural; o plugin builda o projeto, abre o `.exe`, opera as telas de verdade e
devolve um **veredito por cenário** — correlacionado com o log do seu app.

```
/e2e login: senha em branco, senha errada, senha correta
```

Sem argumento, o `/e2e` deriva um cenário "abre sem erro" para cada tela do menu principal.

### Quatro vereditos, não dois

A distinção é o que separa um relatório útil de ruído:

| Veredito | Significa |
|---|---|
| ✅ PASSOU | Executou e bateu com a expectativa |
| ❌ FALHOU | Executou e divergiu — **o app está errado** |
| ⛔ BLOQUEADO | Não deu para executar — **não sei se o app está errado** |
| ⏭️ PULADO | Grava dados e não foi autorizado no gate |

Relatório que acusa bug onde só houve contaminação de estado é pior que relatório nenhum. Por
isso, quando um cenário não consegue voltar ao ponto de partida, ele sai **⛔ BLOQUEADO, nunca
❌ FALHOU**.

### Ele nunca rouba o foco

Os cliques vão por `PostMessage`, o texto por `WM_CHAR` e as capturas por `PrintWindow` — então
o plugin **nunca toma o seu teclado e nunca mexe no seu cursor**. As capturas funcionam mesmo
com a janela totalmente coberta, e o `WM_CHAR` é imune ao problema de acento morto de teclado
ABNT, que quebra o `SendKeys`.

Por padrão o app roda em primeiro plano, para você acompanhar. Com `--background`, ele roda
atrás das suas outras janelas, sem te interromper.

### Ele para e pergunta antes de tocar nos seus dados

Antes do primeiro clique, o `/e2e` apresenta os cenários que pretende executar, **quais deles
gravam dados e o que gravam**, e espera. Ele nunca grava por iniciativa própria — explora,
captura e sai pelo Cancelar/Voltar.

### Ele lê o log do seu app

Entrega não é efeito: uma mensagem pode chegar à janela e ainda assim não surtir efeito, se o
controle não estiver no estado esperado. Por isso o `/e2e` lê o seu log em paralelo — é a
diferença entre ⛔ BLOQUEADO e ❌ FALHOU. Se o seu app não tem log, o plugin **oferece** (nunca
impõe) uma unit de logging mínima ou um modo `--selftest` headless, e a gera seguindo os
próprios padrões de código do plugin.

> **Requisitos:** Windows, e RAD Studio para a etapa de build. FireMonkey é validado; VCL é
> fallback declarado. Android está fora de escopo por decisão de projeto.

---

## Instalação

```bash
npx delphi-dev
```

Este único comando:
- Instala o plugin no Claude Code
- Baixa a base de conhecimento RAG
- Instala a extensão VS Code (se detectado)
- Remove hooks de automação obsoletos deixados por versões antigas

**Requisitos:** Node.js 18+, Claude Code CLI, git

> **Os hooks de automação estão desligados desde a v2.2.2.** Eles dependiam de
> módulos nativos que quebravam a instalação limpa no Windows. A base de
> conhecimento continua sendo distribuída e as skills, comandos e agentes
> funcionam normalmente — o que está desligado é a injeção automática de
> conhecimento a cada prompt e a captura de sessão. Voltam com o servidor MCP
> local. **Não registre os hooks à mão:** na v3.0.0 e anteriores o caminho de
> captura grava ruído de sessão no índice carimbado como autoritativo.

> **Instalando pelo marketplace?** O `/plugin marketplace add` faz um clone do
> repositório, e o `rag/rag.db` **não** é versionado — ou seja, esse caminho chega
> **sem base de conhecimento**. Rode `npx delphi-dev sync-kb` para baixá-la do
> último release. Sem isso o RAG não tem conteúdo curado para devolver.

### Atualizar

```bash
npx delphi-dev update
```

### Verificar instalação

```bash
npx delphi-dev verify
```

### Reinstalação limpa (atualizar a partir da v1.x)

Se você já tinha uma versão antiga (v1.x) instalada e quer ir para a versão nova partindo do zero, **remova primeiro a instalação antiga dentro do Claude Code** e só depois reinstale.

**1. Remover a versão antiga** — comandos executados dentro do Claude Code:

```text
/plugin list                            # veja o que está instalado
/plugin uninstall delphi-dev@delphi-dev # desinstala o plugin
/plugin marketplace remove delphi-dev   # remove o marketplace antigo
```

> Remover o marketplace também desinstala os plugins que vieram dele. Aceita as formas curtas `/plugin market` e `rm`.

**2. (Opcional) limpar o cache de plugins**, caso algo fique preso:

```bash
rm -rf ~/.claude/plugins/cache
```

**3. Instalação limpa** — no terminal:

```bash
npx delphi-dev
```

**4. Recarregar** — reinicie o Claude Code ou rode `/reload-plugins` para carregar a versão nova.

#### Instalação local (desenvolvimento / testes)

Para testar a partir de um checkout local do repositório — útil ao desenvolver o próprio plugin:

```text
/plugin marketplace add <caminho-do-checkout>
/plugin install delphi-dev@delphi-dev
```

Alterações em `.md` / `.json` só têm efeito após reinstalar. Para repetir o ciclo de teste com um estado limpo, desinstale e readicione:

```text
/plugin uninstall delphi-dev@delphi-dev
/plugin marketplace remove delphi-dev
/plugin marketplace add <caminho-do-checkout>
/plugin install delphi-dev@delphi-dev
```

---

## Idioma de Saída

O **delphi-dev** suporta **pt-BR** (padrão) e **en-US** em tudo o que ele apresenta a você — laudos técnicos, documentos SPEC, revisões de código, perguntas e notificações.

O plugin detecta automaticamente o idioma da sua **primeira mensagem** na sessão e responde nesse idioma. Você pode trocar a qualquer momento com um override explícito:

- `responda em português` / `em português por favor` → pt-BR
- `respond in English` / `in English please` / `switch to English` → en-US

O que muda com a seleção de idioma:

- **Templates de relatório** — `/audit` carrega `estrutura-laudo.en.md` para inglês e `estrutura-laudo.md` para português; `/spec` faz o mesmo com `spec-template[.en].md`.
- **Labels de severidade / classificação** — ex.: `🟢 BOM / 🟡 REGULAR / 🟠 CRÍTICO / 🔴 INVIÁVEL` (pt-BR) vs. `🟢 GOOD / 🟡 FAIR / 🟠 CRITICAL / 🔴 NOT VIABLE` (en-US).
- **Notificações** — ex.: `✅ Testes criados em TestePedidoService.pas — 7 casos de teste` vs. equivalente em inglês.
- **Toda a prosa explicativa** em `/review`, `/write`, `/new-project`, `/tdd` e `/about`.

O que **não** muda com o idioma:

- **Identificadores Delphi nos exemplos de código** (`FNome`, `ACliente`, `BuscarPorCodigo`) — eles ilustram a própria convenção de nomenclatura.
- **Prefixos de código** (`F`, `A`, `L`, `C_`, `T`, `I`, `E`).
- **Nomes de métodos de teste** (`Test_<Metodo>_<Cenario>`).
- **IDs de requisitos em SPECs** (`RF-001`, `RNF-001`, `RN-001`, `UC-001`).

---

## Padrões Aplicados Automaticamente

### Prefixos
- `F` — fields (atributos privados)
- `A` — parâmetros de métodos
- `L` — variáveis locais
- `C_` — constantes (+ corpo em UPPER_CASE)
- `T` — classes e tipos
- `I` — interfaces
- `E` — exceções

### Formatação
- ✅ Indentação de 2 espaços (sem TAB)
- ✅ Margem máxima de 120 caracteres
- ✅ `begin` e `else` em linhas próprias
- ✅ Uma variável por linha
- ✅ Uma unit por linha na cláusula `uses` (RTL → VCL/FMX → FireDAC → Third-party → Projeto)

### Comandos Proibidos
- ❌ `with` — causa ambiguidade e dificulta depuração
- ❌ `Break` / `Continue` — usar condições do loop
- ❌ `Real` — usar `Double` ou `Currency`
- ⚠️ `Exit` — permitido apenas como guard clause no início do método

### Regras de Segurança
- ✅ Um recurso por bloco `try..finally`
- ✅ Nenhum bloco `except` vazio
- ✅ SQL sempre parametrizado (sem concatenação de strings)
- ✅ `const` nunca aplicado a parâmetros de interface (compatibilidade ARC)
- ✅ Sem variáveis globais — usar `class var`

### Prefixos de Componentes (VCL / FMX)
`btn`, `edt`, `lbl`, `mmo`, `cbx`, `grd`, `qry`, `cnn`, `dts`, `pnl`, `tmr` e mais — veja [`skills/delphi-standards/references/component-prefixes.md`](skills/delphi-standards/references/component-prefixes.md)

---

## Skills Incluídas

| Skill | Ativação |
|---|---|
| `delphi-standards` | Ativada automaticamente ao detectar arquivo/código Delphi |
| `delphi-write` | Ativada ao escrever código Delphi novo |
| `delphi-laudo` | Ativada pelo comando `/audit` |
| `delphi-spec` | Ativada pelo comando `/spec` |
| `delphi-tests` | Ativada pelo comando `/tdd` ou automaticamente após o `delphi-write` |
| `delphi-claudeignore` | Ativada automaticamente ao detectar projeto Delphi para otimizar tokens |
| `delphi-encoding` | Ativada automaticamente em problemas de encoding/BOM/acentos em arquivos Delphi |
| `delphi-fmx` | Ativada automaticamente para FireMonkey e desenvolvimento mobile Android/iOS |
| `delphi-firedac` | Ativada automaticamente para código de acesso a dados FireDAC |
| `delphi-acbr` | Ativada automaticamente para componentes fiscais ACBr (NFe/NFCe/boleto) |
| `delphi-async` | Ativada automaticamente para código assíncrono/threads (TTask, TThread, Synchronize) |
| `delphi-build` | Ativada automaticamente para build/compilação via linha de comando e erros de build |
| `delphi-spring4d` | Ativada automaticamente para DI container e collections do Spring4D |
| `delphi-legacy` | Ativada automaticamente para modernização/migração de código legado |
| `delphi-e2e` | Ativada pelo comando `/e2e` — somente Windows |

---

## Agentes Incluídos

| Agente | Propósito |
|---|---|
| `delphi-auditor` | Auditoria técnica profunda — 8 dimensões, pontuação, laudo com 17 seções |
| `delphi-writer` | Escreve código Delphi completo e pronto para produção seguindo todos os padrões |
| `delphi-spec-writer` | Gera o documento SPEC a partir da análise do código-fonte |
| `delphi-tester` | Cria suites de testes unitários DUnitX para classes Delphi |

---

## Roadmap

Veja [ROADMAP.pt-BR.md](ROADMAP.pt-BR.md) para o que está planejado e como influenciar prioridades. Fases em discussão incluem tratamento automático de encoding (UTF-8/BOM), scaffold mobile FMX, injeção de dependência com Spring4D, e um pipeline de build/validação que permite ao Claude efetivamente compilar e verificar o código que gera.

---

## Baseado em

- *Normas e Padronização de Codificação Delphi v4.0.1* — Adriano Santos
- *Código Limpo e Boas Práticas em Delphi* — Adriano Santos
- *Clean Code* — Robert C. Martin
- *Delphi Style Guide* — Embarcadero

---

## Licença

MIT © 2026 Adriano Santos

---

## Política de Privacidade

[Ver Política de Privacidade](privacy-policy.md)
