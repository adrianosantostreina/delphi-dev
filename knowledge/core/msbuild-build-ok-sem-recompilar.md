---
title: "BUILD OK" via msbuild /t:Build pode não ter recompilado nada
tags: [delphi, msbuild, dcc32, incremental, build, verificacao]
---

# `msbuild /t:Build` pode reportar sucesso sem recompilar o `.dcu` alterado

## O que aconteceu

Editei uma unit (`App.View.Main.pas`), rodei `build.bat Debug Win32` (que chama
`msbuild Projeto.dproj /t:Build ...`) **duas vezes**, cada uma reportando
`BUILD OK`, exit code 0, log limpo (só hints/warnings de sempre, contagem de
linhas igual à build anterior). Testei o app rodando o `.exe` resultante e o
comportamento **continuava exatamente igual ao código de ANTES da minha
edição** — como se a mudança nunca tivesse existido.

Comparando timestamps depois de desconfiar:

```
App.View.Main.pas   (source) -> modificado HOJE, 19:33
App.View.Main.dcu   (Win32\Debug) -> modificado ONTEM, 18:48
TMV30.exe           (Win32\Debug) -> modificado ONTEM, 18:48
```

O `.dcu` e o `.exe` finais eram de **ANTES** da minha edição, apesar de dois
"BUILD OK" consecutivos depois dela. O `msbuild /t:Build` decidiu, por algum
critério de build incremental que não investiguei a fundo (cache de
timestamps do próprio MSBuild, possivelmente por diretório de trabalho ou
estado de sessão diferente do agente que rodou o build), que **nada
precisava ser recompilado** — e nunca chamou o `dcc32` de verdade sobre essa
unit.

## Como confirmei e corrigi

1. Apaguei manualmente o `.dcu` e o `.exe` de saída (`Win32\Debug\`).
2. Rodei o `build.bat` de novo, direto (sem passar por agente/subagente) —
   dessa vez o log mostrou contagem de linhas **maior** (refletindo as linhas
   que eu tinha adicionado) e o `.exe` saiu com timestamp e tamanho novos.
3. Só depois disso o comportamento em runtime mudou de verdade.

## Regra

**"BUILD OK" não é prova de que o binário reflete o código atual.** Depois de
qualquer build que deveria ter mudado o comportamento observável do app,
**confira o timestamp (e idealmente o tamanho) do `.exe`/`.dcu` de saída**
antes de testar ou de reportar "corrigido":

```powershell
Get-Item Win32\Debug\MeuApp.exe | Select-Object LastWriteTime, Length
```

Se o timestamp não avançou desde a edição do source, o build **não** rodou
de verdade — apague o `.dcu`/`.exe` de saída (ou use `/t:Rebuild` em vez de
`/t:Build`) e rode de novo antes de confiar em qualquer teste subsequente.

Isso é especialmente perigoso quando quem roda o build é um agente/subagente
separado da sessão que fez a edição: um "BUILD OK" relatado por texto pode
estar certo sobre o **exit code** e ainda assim estar reportando a build
errada. **Nunca aceite "BUILD OK" sozinho como prova de que uma correção
está no binário — sempre corrobore com timestamp/tamanho do artefato, ou com
um comportamento em runtime que só o código novo produziria.**

Ver também [[build-cli-reescreve-dproj-deployproj]] (outro efeito colateral
de builds via CLI/MSBuild sobre arquivos de projeto).
