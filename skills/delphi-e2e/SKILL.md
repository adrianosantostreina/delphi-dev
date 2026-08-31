---
name: delphi-e2e
description: >
  Executa cenarios de teste end-to-end em aplicacao Delphi desktop (FMX no Windows):
  builda, abre o .exe, opera as telas de verdade e emite um veredito por cenario,
  correlacionando com o log do app. Auto-ativa em: "/e2e", "teste E2E", "end-to-end",
  "abre o app e testa", "testar a tela", "navegar no aplicativo", "simular usuario".
  NAO e teste unitario — para DUnitX use delphi-tests.
---

# Delphi E2E

## Idioma de saida
Detecte o idioma da primeira mensagem. Padrao: pt-BR. Respeite overrides explicitos.

## REGRA ZERO — plataforma e foco

1. **Windows-only.** Fora do Windows, recusar limpo e parar:
   **pt-BR:** "O /e2e depende da API `user32.dll` do Windows e nao funciona neste sistema."
   **en-US:** "/e2e relies on the Windows `user32.dll` API and does not work on this system."
   Nao sugerir `adb` nem caminho Android — esta explicitamente fora de escopo.
2. **Nunca pedir foco.** Proibido `SetForegroundWindow`, `SetCursorPos`, `mouse_event` e
   `SendKeys`. O harness usa `PostMessage`, `WM_CHAR` e `PrintWindow`. Roubar foco no meio
   da digitacao do usuario ja causou vazamento de texto para dentro do app.

## Gate de seguranca — para e espera

Antes do PRIMEIRO clique, apresentar e **aguardar confirmacao**:

- os cenarios que pretende executar;
- **quais gravam dados** e o que gravam;
- em que modo vai rodar (primeiro plano / ao fundo);
- o unico pedido ao usuario: **deixar a janela aberta, mesmo atras das outras — nao minimizar**.

Regras invioláveis:
1. Nunca gravar **por iniciativa propria** — explorar, capturar, sair por Cancelar/Voltar/Esc.
2. Cenario que grava so roda se o usuario pediu **e** confirmou no gate. Senao: ⏭️ PULADO.
3. Capturar **so a janela do app** — `PrintWindow` garante isso por construcao.
4. Credenciais vem do projeto local; **nunca** ecoar senha em texto claro.
5. Declarar no relatorio: modo usado e estado final (app aberto/fechado, dados alterados/intactos).

**Modo ao fundo.** A flag `--background` do comando `/e2e` mapeia diretamente para
`Set-DelphiBackgroundMode -Enabled $true`, chamada uma vez logo apos `Initialize-DelphiGui`.
Default (flag ausente): **primeiro plano** — nao chamar `Set-DelphiBackgroundMode`, ou
chama-la com `-Enabled $false`. Declarar no gate qual dos dois modos vai rodar.

## Ciclo por cenario

1. Marcar o offset atual do log (`Get-DelphiLogOffset`).
2. **Reconduzir ao ponto de partida** do cenario.
3. Executar os passos (`Invoke-DelphiClick` / `Send-DelphiText` / `Send-DelphiKey`).
4. Capturar (`Get-DelphiShot`) e **ler a tela**.
5. Ler o **delta** do log (`Get-DelphiLogDelta`).
6. Emitir veredito.
7. Voltar ao estado base.

**Isolamento.** Tentar reconduzir pela UI (Cancelar/Voltar/Esc), conferindo pelo
screenshot. Apos **2 tentativas** sem chegar, **matar o processo e reabrir o .exe**.
Se nao conseguir reconduzir, o cenario sai **⛔ BLOQUEADO — nunca ❌ FALHOU**.
Relatorio que acusa bug onde so houve contaminacao de estado e pior que relatorio nenhum.

**Entrega != efeito.** Um PostMessage pode ser entregue e nao surtir efeito se o controle FMX
nao estiver no estado esperado. Por isso o log e lido em paralelo: sem ele, "cliquei e nada
aconteceu" vira ❌ FALHOU quando deveria ser ⛔ BLOQUEADO.

**Ritmo.** Dar tempo ao app recem-iniciado; clique cedo demais na primeira tela nao pega.
A visibilidade da janela FMX pode levar **mais de 3 segundos** para estabilizar apos o start
do processo. Na primeira chamada a `Get-DelphiWindow`, nao assumir um `sleep` fixo curto:
tentar, e se ainda nao vier visivel/com area valida, **esperar e reconferir** (poll com
retentativas, ex.: ate ~10s no total) antes de tratar como falha real de descoberta de janela.

**Fechar uma mensagem (MessageBox).** `Send-DelphiKey -WindowHandle $dlg.Handle -VirtualKey 13`
(Enter) fecha o dialogo nativo `#32770`. E assim que se volta ao estado base depois de uma
mensagem aparecer — sem isso, todo cenario seguinte comeca contaminado e sai ⛔ BLOQUEADO.

**Verificar "apareceu mensagem?".** Usar `Get-DelphiDialog -ProcessId` — se devolver
**nao-`$null`**, ha um dialogo aberto; ler o texto capturando com
`Get-DelphiShot -ProcessId -Path -WindowHandle $dlg.Handle`. **Nao** usar heuristica indireta
(ex.: "a janela principal ficou inerte, entao deve ter aberto uma mensagem") — `Get-DelphiDialog`
e a fonte de verdade.

## Vereditos

| pt-BR | en-US | Significa |
|---|---|---|
| ✅ PASSOU | ✅ PASS | Executou e bateu com a expectativa |
| ❌ FALHOU | ❌ FAIL | Executou e divergiu — **o app esta errado** |
| ⛔ BLOQUEADO | ⛔ BLOCKED | Nao deu para executar — **nao sei se o app esta errado** |
| ⏭️ PULADO | ⏭️ SKIPPED | Grava dados e nao foi autorizado no gate |

## Fronteira com o build

Esta skill **nao compila e nao ensina msbuild**. Verificar se ha binario; se nao houver ou
estiver mais velho que o fonte, **carregar a skill `delphi-build`**.

O que fica aqui: **localizar o .exe** (conferir `DCC_ExeOutput` no `.dproj` — costuma ser
`.\bin`, nao `Win32\Debug`) e **conferir os pre-requisitos ao lado dele**: `sk4d.dll`, `.ttf`,
`.db`, `config.ini`, `fbclient.dll`. E territorio de runtime, nao de build, e e o passo mais
esquecido.

## Descoberta de log

Ordem: (a) usuario informa; (b) `config.ini` do diretorio do .exe (`Log`/`LogFile`/`LogPath`);
(c) `*.log`/`*.txt` no diretorio do .exe modificados apos o start; (d) nada.

No caso (d): **oferecer instrumentacao** — os dois caminhos disponiveis estao documentados em
**`references/logging-unit.md`** (unit de log minima para o app gravar eventos) e
**`references/selftest-mode.md`** (modo self-test do proprio app). Se a oferta for recusada,
degradar para veredito **visual** — declarando isso no relatorio, nunca em silencio.

## Por que delta por byte offset, e nao reler o log inteiro

`Get-DelphiLogDelta` le a partir de um offset (`Get-DelphiLogOffset` marcado no inicio do
cenario) em vez de reler o arquivo inteiro a cada cenario. **Motivo: custo, nao falha de
leitura.** Uma bateria com dezenas de cenarios geraria um log que so cresce; reler tudo a
cada cenario e comparar por substring seria inviavel (custo cresce quadratico com o numero
de cenarios, e o ruido de eventos antigos polui a correlacao). O `FileShare.ReadWrite` usado
na abertura do arquivo e defesa contra locks **mais restritivos** que o app possa aplicar no
log (ex.: `fmShareExclusive`) — nao contorna uma falha de leitura do `Get-Content`, que sob
`fmShareDenyWrite` (o modo mais comum de log aberto para escrita) ja le normalmente no
PowerShell 5.1.

## Carregar o harness

O diretorio do plugin e cache sobrescrito a cada atualizacao, e rodar `.ps1` de la esbarra em
ExecutionPolicy. Portanto: **ler** `references/gui.ps1` e **escrever** em `%TEMP%`, carregando
de la.

```powershell
$dst = Join-Path $env:TEMP 'delphi-e2e-gui.ps1'
Set-Content -Path $dst -Value $conteudoDoReferences -Encoding UTF8
. $dst
Initialize-DelphiGui
```

Depois de `Initialize-DelphiGui`, se o gate confirmou modo ao fundo, chamar
`Set-DelphiBackgroundMode -Enabled $true` antes do primeiro clique.
