---
description: Gera laudo técnico profissional completo de um projeto Delphi
---

Execute um laudo técnico completo do projeto Delphi atual ou dos arquivos
informados pelo usuário.

Siga este protocolo:

1. **Levantamento** — colete: versão do Delphi, banco de dados, componente de
   acesso, tipo do sistema, objetivo do laudo (modernização / auditoria / venda).

2. **Análise** — avalie as 8 dimensões: Arquitetura, Clean Code, Code Smells,
   SOLID, Memória, Acesso a Dados, Segurança, Manutenibilidade.

3. **Pontuação** — score 1–5 por dimensão, média ponderada final.
   - 4,0–5,0 = 🟢 BOM
   - 3,0–3,9 = 🟡 REGULAR
   - 2,0–2,9 = 🟠 CRÍTICO
   - 1,0–1,9 = 🔴 INVIÁVEL

4. **Relatório** — gere o laudo completo com: resumo executivo, análise por
   dimensão, pontos críticos, recomendações (imediatas / curto / médio / estratégico)
   e estimativa de esforço para modernização.

Use o agente `delphi-auditor` para análise profunda quando disponível.
Carregue a skill `delphi-laudo` para estrutura detalhada do laudo.
