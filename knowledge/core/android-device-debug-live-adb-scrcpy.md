---
title: Depurar app FMX/Android num aparelho real, ao vivo, via adb (com ou sem scrcpy)
tags: [delphi, android, adb, debug, scrcpy, logcat, run-as]
---

# Depurar num aparelho real ao vivo, via adb — com o usuário mostrando a tela (scrcpy) ou não

## Quando usar

O usuário relata um bug só reproduzível no aparelho (não no Win32 de desenvolvimento) e
está com o app aberto na mão — às vezes compartilhando a tela via **scrcpy/ScreenCopy**
(ou similar) para você ver. Mesmo sem ver a tela dele, se o aparelho está com
**Depuração USB** ligada e autorizada, `adb` te dá acesso independente e completo ao
mesmo dispositivo — você não depende do compartilhamento de tela para agir, só para o
usuário acompanhar o que está fazendo.

## O laço de trabalho que funciona

1. **Confirmar o dispositivo**: `adb devices -l`. Se não aparecer mas o usuário diz que
   está conectado, pedir para reconectar o cabo e autorizar o popup "Permitir depuração
   USB?" — `adb kill-server && adb start-server && adb devices` depois.
2. **Ver a tela sem depender do compartilhamento**: `adb shell screencap -p /sdcard/x.png`
   + `adb pull /sdcard/x.png <local>` — dá pra olhar a tela mesmo sem ninguém
   compartilhando nada.
3. **Agir na tela como o usuário agiria**: `adb shell input tap X Y` usando as
   coordenadas da própria screencap. Se a imagem que você VÊ foi redimensionada pela
   ferramenta de leitura, multiplique pela razão (`largura original / largura exibida`)
   antes de tocar — a screencap sempre devolve a resolução real do aparelho.
4. **Ler o log/config/banco do PRÓPRIO app sem root** (builds Debug são "debuggable"):
   ```
   adb shell run-as <package> cat /data/data/<package>/files/<arquivo>
   adb shell run-as <package> tail -n 50 /data/data/<package>/files/tmv.log
   adb shell run-as <package> find /data/data/<package> -maxdepth 4
   ```
   Muito mais rápido que instrumentar código quando o app já tem um logger próprio em
   arquivo (ex.: `TMV.Infra.Log`) — geralmente a causa já está lá, sem precisar de
   rebuild.
5. **`adb logcat` para o que o log do app não sabe**: process morrendo, crash nativo.
   `adb logcat -c` (limpa) → reproduzir → `adb logcat -d -v time`. Filtrar por
   `has died`, `FATAL EXCEPTION`, `AndroidRuntime`, `Fatal signal`, ou pelo próprio
   pacote. **Diferença importante**: `Zygote: Process N exited cleanly (1)` é o
   processo chamando `exit()`/`Halt()` sozinho (típico de **excecao Delphi não
   tratada rodando ANTES do Application.Run** — initialization de unit, ou dentro de um
   evento sem try/except) — não é SIGSEGV/crash nativo, então não vai gerar
   tombstone/backtrace nenhum no log, mesmo procurando.
6. **Se a Activity fica reabrindo sozinha (splash piscando)**: normalmente é a
   Activity foreground morrendo e o Android relançando automaticamente — sintoma visual
   de "tela piscando branco/preto sem parar". Ver o log do app (passo 4) primeiro; ele
   costuma já ter a excecao exata, repetida a cada ciclo.
7. **Quando o próprio log não é suficiente para saber ONDE**: acrescentar linhas de log
   temporárias nos pontos de decisão suspeitos (usando o logger que o projeto já tem,
   não adicionar uma lib nova), citando explicitamente no comentário que é diagnóstico
   temporário a remover depois. Rebuild, reinstalar, reproduzir, ler o log de novo — o
   ciclo completo (passo 8) leva menos de um minuto depois de montado.
8. **Rebuild + reinstalar rápido, pelo terminal, sem abrir a IDE**:
   ```
   msbuild Projeto.dproj /t:Build;Deploy /p:Config=Debug /p:Platform=Android64 /p:DCC_ForceExecute=true
   adb install -r <Platform>\<Config>\<Projeto>\bin\<Projeto>.apk
   adb shell am force-stop <package>
   adb shell am start -n <package>/com.embarcadero.firemonkey.FMXNativeActivity
   ```
   **Armadilha crítica**: `msbuild Projeto.dproj /t:Build` **sozinho NÃO empacota o
   APK Android** — só compila `.so`/`.exe`. Sem `;Deploy` (ou sem passar pela IDE), o
   `<Platform>\<Config>\<Projeto>\bin\<Projeto>.apk` que já existir de uma sessão
   anterior **fica intocado**, e reinstalar esse apk reinstala código **velho** sem erro
   nenhum — parece que o fix não pegou, quando na verdade nunca foi testado. Depois de
   apagar a pasta de saída pra forçar rebuild limpo, ela pode nem ter o `bin\` até rodar
   com `;Deploy`. Conferir sempre com `Get-ChildItem ... -Filter *.apk` (ou `find`) que o
   apk existe e tem timestamp fresco antes de instalar.
9. **Depois de builds via CLI, sempre `git diff` no `.dproj`/`.deployproj`** — ver
   [[build-cli-reescreve-dproj-deployproj]]. Reverter ruído de ferramenta antes de
   comitar o fix de verdade.
10. **Notas do ambiente Windows/Git Bash**: caminhos absolutos tipo `/data/data/...`
    passados para `adb shell` de dentro do Git Bash são "corrigidos" pelo MSYS para
    caminho Windows e quebram (`find: 'C:/Program': No such file or directory`) — prefixar
    o comando com `export MSYS_NO_PATHCONV=1`.

## Por que vale a pena mesmo sem enxergar a tela do usuário

`screencap`/`input tap`/`run-as`/`logcat` são todos independentes de qualquer ferramenta
de espelhamento — controlam e leem o MESMO dispositivo físico que o usuário está vendo,
então "eu não vejo sua tela" não é motivo pra pedir descrição por texto quando o
dispositivo está com depuração USB acessível: reproduza você mesmo.

## Ver também

[[build-cli-reescreve-dproj-deployproj]], [[android-deploy-e8712-buildtools]],
[[adrconnection-query-builder]] (o "trava sem erro" mais comum que aparece nesse fluxo)
