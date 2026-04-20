---
description: Generates DUnitX unit tests for the entire Delphi project or a specific class
---

Inicie a criacao de testes unitarios DUnitX para o projeto Delphi atual.

**Idioma:** Detecte o idioma do usuario e responda sempre nesse idioma.
Padrao: pt-BR. Idiomas suportados: pt-BR, en-US.
Honre overrides: "respond in English" / "responda em portugues".
Identificadores Delphi (nomes de teste, fields, classes) seguem a convencao do
projeto e nao sao traduzidos — apenas a prosa, propostas e notificacoes.

Este comando opera em **Fase 1 (setup inicial)**:

1. **Analise do Projeto** — Ler todas as units do projeto e identificar o que pode
   ser testado. Prioridade: servicos de negocio, repositorios, utilitarios com logica.
   Ignorar: Forms, DataModules, classes sem logica propria.

2. **Proposta** — Apresentar a suite de testes proposta com a lista de casos por classe:
   ```
   [TClienteService] — N casos
     ✓ Test_Salvar_ClienteValido_Salva
     ✓ Test_Salvar_ClienteSemNome_LancaExcecao
     ...
   ```
   Aguardar aprovacao do usuario antes de gerar.

3. **Geracao** — Produzir todos os arquivos `Teste[NomeDaClasse].pas` e o projeto
   `TestRunner.dpr` com o runner DUnitX.

**Fase 2 (continua automaticamente):** Apos cada nova implementacao via `/write`,
o agente `delphi-tester` cria os testes da nova classe automaticamente e notifica
o usuario com a lista dos casos criados.

Use o agente `delphi-tester` para executar a analise e geracao.
Carregue a skill `delphi-testes` e os padroes em `references/dunitx-patterns.md`.
