---
title: "E7688 NoSuchFileException no dexing: EnabledSysJars dessincronizado entre plataformas"
tags: [delphi, android, dexing, r8, d8, dproj, enabledsysjars]
---

# `[PAClient Error] E7688 NoSuchFileException` no dexing/merge — `EnabledSysJars` desatualizado

## Sintoma

Deploy Android falha na etapa de dexing (R8/D8, depois do manifest já ter fundido OK)
com uma pilha grande de `E7688 java.nio.file.NoSuchFileException` — um por dependência
AndroidX/Play Services/Kotlin (`core-X.Y.Z.dex.jar`, `billing-X.Y.Z.dex.jar`,
`kotlin-stdlib-X.Y.Z.dex.jar`...), terminando em
`com.android.tools.r8.CompilationFailedException`.

## Causa

O `.dproj` guarda a lista de jars do sistema Android a empacotar em
**`EnabledSysJars`**, e — assim como `DCC_Define` (ver
[[adrconnection-query-builder]]) — essa lista existe **separada por plataforma**
(`Base_Android` de 32 bits e `Base_Android64`, ambas dentro do mesmo `.dproj`). As duas
listas guardam **versões exatas de arquivo** (`core-1.10.1.dex.jar` vs
`core-1.17.0.dex.jar`), presas no `.dproj` desde a última vez que alguém abriu aquela
plataforma no IDE e o wizard de deployment regravou a lista a partir do disco.

Se o RAD Studio for atualizado (ou reinstalado) e vier com versões novas dessas
dependências em `lib\android\Debug`, **só a plataforma que alguém abriu no IDE depois
da atualização** tem a lista corrigida — a outra continua referenciando arquivos que
**não existem mais** no disco. Um projeto Android64-only pode ficar meses com a lista
de 32 bits (nunca usada, mas presente no `.dproj`) já corrigida, e a de 64 bits (a que
realmente importa) travada na versão antiga — silenciosamente, até o próximo deploy
real.

## Diagnóstico

```
grep -n "EnabledSysJars" Projeto.dproj
```
Compare as duas listas (ou quantas plataformas o `.dproj` tiver). Depois confirme no
disco:
```powershell
Test-Path "C:\Program Files (x86)\Embarcadero\Studio\<ver>\lib\android\Debug\core-1.10.1.dex.jar"
Test-Path "C:\Program Files (x86)\Embarcadero\Studio\<ver>\lib\android\Debug\core-1.17.0.dex.jar"
```
A lista com as versões que **existem** no disco é a correta; a outra é a que precisa
ser substituída.

## Correção

Copiar a lista `EnabledSysJars` da plataforma que bate com o disco para dentro do
bloco da plataforma quebrada (mesma tag, plataforma diferente). Confirmar depois:
```
strings Android64\Debug\libProjeto.so | grep TNomeDeClasseDaLibNova
```
(ex.: `TADRConnModelFiredacConnection`, `billing`...) para provar que a dependência
nova está de fato linkada, não só listada no `.dproj`.

## Ver também

[[android-deploy-e8712-buildtools]] (outro erro de packaging Android, causas
diferentes), [[android-device-debug-live-adb-scrcpy]] (ciclo completo de
build→instalar→testar num aparelho real usado para achar e confirmar este bug)
