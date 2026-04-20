---
description: Information about the delphi-dev plugin — author, version, and features
---

Detect the user's language from the first message and display the matching block below.
Default: pt-BR. Supported: pt-BR, en-US.

Honor explicit overrides:
- "respond in English" / "in English please" → en-US
- "responda em português" → pt-BR

---

## en-US — display this block when the user's language is English

**delphi-dev** — Claude Code Plugin

- **Version:** 1.4.0
- **Author:** Adriano Santos
- **Email:** adrianosantospro@gmail.com
- **GitHub:** https://github.com/adrianosantostreina/delphi-dev
- **License:** MIT © 2026 Adriano Santos

---

**What this plugin does:**

Turns Claude into a senior Delphi expert. When Delphi code is detected, it automatically
applies the Delphi Style Guide, Clean Code, and SOLID patterns — without being asked.

---

**Output language:** pt-BR (default) or en-US. The plugin detects the language of the
user's first message and responds in that language. Switch any time with
"respond in English" or "responda em português".

---

**Available commands:**

| Command | Description |
|---|---|
| `/audit` | Generates a complete professional technical audit with score and recommendations |
| `/review` | Quick code review — detects violations and suggests fixes |
| `/write` | Writes new code with all standards applied automatically |
| `/new-project` | Scaffolds a new project with a standardized folder structure |
| `/spec` | Generates a software specification document (SPEC) for the project or module |
| `/tdd` | Generates a complete DUnitX unit test suite for the project |
| `/about` | Shows this information |

---

**Based on:**
- Delphi Coding Standards v4.0.1 — Adriano Santos
- Clean Code and Best Practices in Delphi — Adriano Santos
- Clean Code — Robert C. Martin
- Delphi Style Guide — Embarcadero

---

## pt-BR — exiba este bloco quando o idioma do usuário for português

**delphi-dev** — Claude Code Plugin

- **Versão:** 1.4.0
- **Autor:** Adriano Santos
- **Email:** adrianosantospro@gmail.com
- **GitHub:** https://github.com/adrianosantostreina/delphi-dev
- **Licença:** MIT © 2026 Adriano Santos

---

**O que este plugin faz:**

Transforma o Claude em um especialista sênior em Delphi. Ao detectar código Delphi,
aplica automaticamente o Delphi Style Guide, Clean Code e padrões SOLID — sem precisar ser solicitado.

---

**Idioma de saída:** pt-BR (padrão) ou en-US. O plugin detecta o idioma da primeira
mensagem do usuário e responde nesse idioma. Troque a qualquer momento com
"responda em português" ou "respond in English".

---

**Comandos disponíveis:**

| Comando | Descrição |
|---|---|
| `/audit` | Gera laudo técnico profissional completo com score e recomendações |
| `/review` | Revisão rápida de código — detecta violações e sugere correções |
| `/write` | Escreve código novo com todos os padrões aplicados automaticamente |
| `/new-project` | Scaffold de novo projeto com estrutura de pastas padronizada |
| `/spec` | Cria documento de especificação de software (SPEC) do projeto ou módulo |
| `/tdd` | Gera suite completa de testes unitários DUnitX para o projeto |
| `/about` | Exibe estas informações |

---

**Baseado em:**
- Normas e Padronização de Codificação Delphi v4.0.1 — Adriano Santos
- Código Limpo e Boas Práticas em Delphi — Adriano Santos
- Clean Code — Robert C. Martin
- Delphi Style Guide — Embarcadero
