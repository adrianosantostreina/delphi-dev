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
| **`/about`** | Exibe informações do plugin, versão e comandos disponíveis |

---

## Instalação

**No Claude Code (VS Code, Cursor, Windsurf, etc.):**
```bash
/plugin marketplace add adrianosantostreina/delphi-dev
/plugin install delphi-dev@delphi-dev
```

**Via terminal (CLI):**
```bash
claude plugin marketplace add adrianosantostreina/delphi-dev
claude plugin install delphi-dev@delphi-dev
```

### Após a instalação

Após rodar o comando de instalação, um menu aparece pedindo o escopo da instalação:

| Opção | Quando usar |
|---|---|
| **Install for you (user scope)** | Recomendado para uso individual — disponível em todos os projetos da sua máquina |
| **Install for all collaborators (project scope)** | Adiciona o plugin ao `.claude/settings.json` para que todos que clonarem o repo tenham acesso |
| **Install for you, in this repo only (local scope)** | Disponível apenas no projeto atual, ignorado pelo git |

> **Observação:** Após confirmar a instalação no menu, o plugin é instalado silenciosamente — nenhuma mensagem de confirmação é exibida.

**Verificar a versão instalada:**
```
/about
```
A versão atual deve ser **1.4.0**.

> **Dica (Windows):** Se aparecer o erro "Host key verification failed", rode isso uma vez no terminal antes de instalar:
> ```powershell
> git config --global url."https://github.com/".insteadOf git@github.com:
> ```

### Atualizando

Para atualizar para a versão mais recente, desinstale e reinstale:
```bash
/plugin uninstall delphi-dev
/plugin install delphi-dev@delphi-dev
```

### Desinstalando

```bash
/plugin uninstall delphi-dev
/plugin marketplace remove delphi-dev
```

Ou via CLI:
```bash
claude plugin uninstall delphi-dev
claude plugin marketplace remove delphi-dev
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
| `delphi-testes` | Ativada pelo comando `/tdd` ou automaticamente após o `delphi-write` |
| `delphi-claudeignore` | Ativada automaticamente ao detectar projeto Delphi para otimizar tokens |

---

## Agentes Incluídos

| Agente | Propósito |
|---|---|
| `delphi-auditor` | Auditoria técnica profunda — 8 dimensões, pontuação, laudo com 17 seções |
| `delphi-writer` | Escreve código Delphi completo e pronto para produção seguindo todos os padrões |
| `delphi-spec-writer` | Gera o documento SPEC a partir da análise do código-fonte |
| `delphi-tester` | Cria suites de testes unitários DUnitX para classes Delphi |

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
