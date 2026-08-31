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
`Set-DelphiBackgroundMode -Enabled $true`. **Nao e uma chamada de setup unica: repetir em
TODA invocacao PowerShell**, junto do dot-source (ver "Carregar o harness") — cada
invocacao e um processo novo e o estado do modo morre com o anterior.
Default (flag ausente): **primeiro plano** — nao chamar `Set-DelphiBackgroundMode`, ou
chama-la com `-Enabled $false`. Declarar no gate qual dos dois modos vai rodar.

**Subir o app ja no fundo.** Em modo ao fundo, mandar a janela para o fundo **ao subir o
app**, nao so depois de cada clique:

```powershell
$p = Start-Process -FilePath $exe -PassThru
$w = Wait-DelphiWindow -ProcessId $p.Id -TimeoutMs 10000  # espera a janela existir
Set-DelphiWindowBottom -ProcessId $p.Id                   # SO em modo ao fundo
```

Sem essa chamada a janela pula para a frente no `Start-Process` e **fica la ate o primeiro
clique** — exatamente a interrupcao que a flag `--background` existe para evitar.
`Set-DelphiWindowBottom` usa `SWP_NOACTIVATE`: manda ao fundo sem roubar foco.

## Ciclo por cenario

Todo passo abaixo roda numa invocacao PowerShell que **comeca pelo dot-source** (ver
"Carregar o harness") — sem ele, nenhuma dessas funcoes existe naquela invocacao.

1. Marcar o offset atual do log (`Get-DelphiLogOffset`) **e** a contagem de janelas
   (`Get-DelphiFormWindowCount`).
2. **Reconduzir ao ponto de partida** do cenario.
3. Executar os passos (`Invoke-DelphiClick` / `Send-DelphiText` / `Send-DelphiKey`).
4. Capturar (`Get-DelphiShot`) e **conferir a captura antes de ler**:
   `Test-DelphiShotIsBlank -Path $png`. Se der `$true`, nao ler — ver abaixo.
5. **Ler a tela** a partir do PNG.
6. Ler o **delta** do log (`Get-DelphiLogDelta`).
7. Reconferir `Get-DelphiFormWindowCount` e anotar se cresceu em relacao ao passo 1.
8. Emitir veredito.
9. Voltar ao estado base.

**Captura preta nao e evidencia.** `Get-DelphiShot` grava um PNG inteiramente preto quando
a janela escolhida foi uma **orfa invisivel** — as armadilhas 2 e 3 documentadas em
`Get-DelphiWindow` se manifestam exatamente assim, e o arquivo e gravado do mesmo jeito.
Por isso **toda captura passa por `Test-DelphiShotIsBlank` antes de ser lida**. Ler um PNG
preto leva a um dos dois piores desfechos possiveis: inventar o que estaria na tela, ou
reportar ❌ FALHOU. A verdade e **⛔ BLOQUEADO — peguei a janela errada, nao sei se o app
esta errado**. Tratamento, nesta ordem: refazer a descoberta com `Wait-DelphiWindow` (o app
pode estar minimizado ou ainda abrindo) e recapturar; persistindo, matar o processo e
reabrir o `.exe`; persistindo ainda, ⛔ BLOQUEADO com a causa declarada.

**Contagem de janelas `FMT*`.** `Get-DelphiFormWindowCount -ProcessId $ProcessId` conta
todas as janelas `FMT*` do processo — **inclusive as invisiveis**, que sao justamente as que
denunciam form fechado e nao liberado. Medir no inicio e no fim de cada cenario; se a
contagem sobe e nao volta ao longo da bateria, o relatorio traz o alerta de possivel
vazamento de form. Isso **nao** altera o veredito do cenario: e um achado a parte.

**Isolamento.** Tentar reconduzir pela UI (Cancelar/Voltar/Esc), conferindo pelo
screenshot. Apos **2 tentativas** sem chegar, **matar o processo e reabrir o .exe**.
Se nao conseguir reconduzir, o cenario sai **⛔ BLOQUEADO — nunca ❌ FALHOU**.
Relatorio que acusa bug onde so houve contaminacao de estado e pior que relatorio nenhum.

**Entrega != efeito.** Um PostMessage pode ser entregue e nao surtir efeito se o controle FMX
nao estiver no estado esperado. Por isso o log e lido em paralelo: sem ele, "cliquei e nada
aconteceu" vira ❌ FALHOU quando deveria ser ⛔ BLOQUEADO.

**Ritmo.** Dar tempo ao app recem-iniciado; clique cedo demais na primeira tela nao pega.
A visibilidade da janela FMX pode levar **mais de 3 segundos** para estabilizar apos o start
do processo. Por isso a **primeira** busca de janela depois do `Start-Process` usa
`Wait-DelphiWindow`, nunca `Get-DelphiWindow` direto:

```powershell
$w = Wait-DelphiWindow -ProcessId $ProcessId -TimeoutMs 10000
```

`Wait-DelphiWindow` faz o poll internamente e devolve o **mesmo objeto** de
`Get-DelphiWindow`; esgotado o `-TimeoutMs`, lanca citando o ultimo erro real.
`Get-DelphiWindow` **lanca na primeira tentativa** quando ainda nao ha `FMT*` visivel — e
nao aceita timeout —, entao chama-la logo apos o start transforma "o app ainda esta
abrindo" em falha de descoberta de janela. Depois que a janela apareceu, `Get-DelphiWindow`
serve para o resto da bateria.

**Fechar uma mensagem (MessageBox).**
`Send-DelphiKey -ProcessId $ProcessId -WindowHandle $dlg.Handle -VirtualKey 13`
(Enter) fecha o dialogo nativo `#32770`. `-ProcessId` e obrigatorio nesta funcao mesmo
quando `-WindowHandle` ja aponta para o dialogo — nao omitir. E assim que se volta ao
estado base depois de uma mensagem aparecer — sem isso, todo cenario seguinte comeca
contaminado e sai ⛔ BLOQUEADO.

**Verificar "apareceu mensagem?".** Usar `Get-DelphiDialog -ProcessId $ProcessId` — se
devolver **nao-`$null`** (guardado, por exemplo, em `$dlg`), ha um dialogo aberto; ler o
texto capturando com
`Get-DelphiShot -ProcessId $ProcessId -Path $caminhoDoPng -WindowHandle $dlg.Handle`.
**Nao** usar heuristica indireta
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

**Os passos (b) e (c) ja estao implementados em `Find-DelphiLogFile` — usar a funcao, nao
reescrever a busca:**

```powershell
$log = Find-DelphiLogFile -ExeDir $dirDoExe -StartedAfter $inicioDoProcesso
```

Devolve o caminho do log ou nada (caso *d*). Refazer a busca a mao com `Get-ChildItem` cai
direto numa pegadinha ja corrigida dentro da funcao: `-Include` so filtra de fato quando
`-Path` termina em `\*`; sem isso ele e **silenciosamente ignorado** e a busca nao devolve
nada. Cabe a skill apenas o passo (a): se o usuario informou o caminho, usar o dele e nem
chamar a funcao.

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
de la. Materializar o arquivo uma vez, no inicio:

```powershell
$dst = Join-Path $env:TEMP 'delphi-e2e-gui.ps1'
Set-Content -Path $dst -Value $conteudoDoReferences -Encoding UTF8
```

### TODA invocacao PowerShell recomeca do dot-source

**Cada invocacao da ferramenta PowerShell e um processo novo, com uma sessao nova.** Nada
sobrevive de uma para a seguinte: as funcoes dot-sourcidas somem, e — pior, porque falha em
silencio — `$script:DelphiKeepBottom` volta a `$false`, o que torna o modo ao fundo
**inerte** em toda interacao depois da chamada que o ligou. Nao existe "chamada de setup"
que valha para as seguintes.

Portanto **toda** invocacao PowerShell do `/e2e` comeca assim:

```powershell
. "$env:TEMP\delphi-e2e-gui.ps1"
Initialize-DelphiGui
Set-DelphiBackgroundMode -Enabled $true   # SO em modo ao fundo — repetir aqui, toda vez
# ... e so entao os comandos do passo (Invoke-DelphiClick, Get-DelphiShot, ...)
```

Nao "otimizar" removendo o dot-source das chamadas seguintes por parecer repeticao inutil:
sem ele, a invocacao seguinte nao conhece funcao nenhuma do harness. E omitir o
`Set-DelphiBackgroundMode` num passo faz **aquele passo** rodar em primeiro plano — a
janela sobe na frente do usuario no meio da bateria, sem nenhum aviso.
