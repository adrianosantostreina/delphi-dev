---
description: Executa cenarios de teste end-to-end num app Delphi desktop — builda, abre o .exe, opera as telas e devolve veredito por cenario
---

## Idioma de saida
Detecte o idioma da primeira mensagem. Padrao: pt-BR. Suportados: pt-BR, en-US.
Honre overrides explicitos: "respond in English" / "responda em portugues".

## O que este comando faz

Carregar a skill `delphi-e2e` e seguir o protocolo dela integralmente — este
comando e uma porta explicita para a skill, nao um protocolo paralelo.

**Argumento:**
- **Com argumento** — cada item vira um cenario. `/e2e login: senha em branco, senha errada`
  produz dois cenarios; traduzir cada um em passos concretos **olhando a tela**, nao
  adivinhando o layout.
- **Sem argumento** — derivar um cenario "abre sem erro" por tela do menu principal
  (decisao 6 do design).

**Flags:**
- `--background` — roda com a janela ao fundo, sem interromper quem esta na maquina.
  Mapeia direto para `Set-DelphiBackgroundMode -Enabled $true`, chamada uma unica vez
  logo apos `Initialize-DelphiGui` (ver `references/gui.ps1` na skill).
  **Default (flag ausente): primeiro plano** — nao chamar `Set-DelphiBackgroundMode`,
  ou chama-la com `-Enabled $false` (decisao 15). Sem `--background`, a flag e
  puramente decorativa se nada mapear para a chamada — por isso este comando fixa
  o mapeamento aqui.

## Fluxo

1. Localizar o `.dproj`. Se nao houver binario ou ele estiver mais velho que o
   fonte, carregar a skill `delphi-build` e compilar ate `Build OK`.
2. Localizar o `.exe` (`DCC_ExeOutput` no `.dproj`) e conferir os pre-requisitos ao
   lado dele (`sk4d.dll`, `.ttf`, `.db`, `config.ini`, `fbclient.dll`).
3. Descobrir o log (ordem da skill: usuario informa / `config.ini` / `*.log` mais
   recente / nada). Sem log, **oferecer** instrumentacao — `logging-unit.md` ou
   `selftest-mode.md`, nunca aplicar sem aceite explicito.
4. **Gate de seguranca** — listar os cenarios, quais gravam dados, o modo de janela
   (primeiro plano ou `--background`). **Parar e esperar confirmacao** antes do
   primeiro clique.
5. Executar cenario a cenario, com narracao passo a passo visivel: o que vai fazer,
   o que apareceu na tela, o que o log confirmou.
6. Emitir o relatorio.

## Relatorio

Tabela: cenario | expectativa | resultado | evidencia. Mais, fora da tabela:

- o que **nao** rodou e por que (cenario pulado por falta de autorizacao, bloqueado
  por nao conseguir reconduzir ao estado base, etc.);
- o **estado final** do app (aberto/fechado, dados alterados/intactos);
- o **modo de janela** usado (primeiro plano ou `--background`);
- se a contagem de janelas `FMT*` (`Get-DelphiFormWindowCount`) **cresceu** ao longo
  da bateria, o alerta de possivel vazamento de form.

Vereditos:

**pt-BR:** `✅ PASSOU / ❌ FALHOU / ⛔ BLOQUEADO / ⏭️ PULADO`
**en-US:** `✅ PASS / ❌ FAIL / ⛔ BLOCKED / ⏭️ SKIPPED`

## Pre-requisitos

- Windows — o comando recusa limpo em outros sistemas (a skill depende de `user32.dll`).
- RAD Studio instalado, para o passo de build.
