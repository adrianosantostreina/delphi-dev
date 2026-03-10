---
description: Inicia sessão de escrita de código Delphi novo com todos os padrões aplicados
---

Inicie uma sessão de escrita de código Delphi padronizado.

**Passo 1 — Entender o que será criado**

Pergunte ao usuário (se não informado):
- Tipo de elemento: classe de serviço / repositório / model / form / unit utilitária / interface?
- Responsabilidade principal (deve ser única — SRP)?
- Implementa alguma interface? Qual?
- Depende de outras classes? Quais serão injetadas?
- Nome sugerido ou você pode propor?

**Passo 2 — Propor estrutura**

Antes de escrever código, apresente:
```
Proposta: [TNomeClasse]
- Herda de: [TInterfacedObject / TObject]
- Implementa: [INomeInterface]
- Injeta via construtor: [IOutraDependencia]
- Responsabilidade: [uma frase]
- Métodos públicos: [lista]
```

Aguarde aprovação antes de continuar.

**Passo 3 — Escrever código completo**

Gere o código completo, compilável, com:
- Unit header com uses organizado
- Seção interface completa
- Seção implementation com todos os métodos
- Todos os padrões aplicados automaticamente

Use o agente `delphi-writer` para implementação.
