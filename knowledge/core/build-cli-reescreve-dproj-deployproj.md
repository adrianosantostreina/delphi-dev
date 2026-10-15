---
title: Build via msbuild/CLI pode reescrever .dproj/.deployproj como efeito colateral
tags: [delphi, msbuild, dproj, deployproj, git, build]
---

# Build via CLI pode reescrever `.dproj`/`.deployproj` como efeito colateral

## O que acontece

Um build normal (`msbuild Projeto.dproj /t:Build /p:Config=Debug;Platform=Win32`),
**sem nenhum `/t:Deploy` explícito**, pode reescrever o `.dproj` e o `.deployproj`
no disco como efeito colateral — mesmo compilando limpo, mesmo sem erro nenhum.

Observado em produção (TMV 3.0, 2026-09-04) depois de rodar `build.bat Debug Win32`
duas vezes seguidas via agente de build:

- `.dproj`: o `Platform Condition="'$(Platform)'==''"` (plataforma-padrão quando
  ninguém especifica) mudou sozinho de `Android64` para `Win32` — o MSBuild grava o
  **último alvo buildado** como novo padrão, é comportamento normal da IDE/CLI, mas
  ninguém pediu essa mudança.
- Um comentário explicativo dentro de um `PropertyGroup` (`<!-- ... -->`) **desapareceu**
  — MSBuild não preserva comentários ao reescrever XML por conta própria.
- `.deployproj`: caminhos de `DeployFile` (ex. `cpvendas30.db`, `config.ini`) voltaram
  para valores de uma estrutura de projeto **mais antiga**, e um bloco de deploy inteiro
  (adicionado numa sessão anterior para uma config nova) sumiu.
- Um arquivo novo (`deployedassets.txt`) apareceu na raiz do projeto, untracked.

Nenhum desses arquivos foi editado manualmente durante a sessão — só rodou `build.bat`.

## Por quê

`.dproj`/`.deployproj` não são só configuração estática: a IDE/MSBuild os trata como
**estado de sessão de build** (último config/plataforma usado, cache de arquivos de
deploy) e os regrava no disco a cada build, não só a cada deploy explícito. Comentários
XML não são preservados nessa regravação porque MSBuild opera sobre o modelo de objeto
do projeto, não sobre o texto do arquivo.

## Sintoma para detectar

`git status`/`git diff --stat` depois de QUALQUER build mostrando mudança em
`.dproj`/`.deployproj` que você não fez de propósito — especialmente:
- Mudança só no atributo de `Platform`/`Config` padrão.
- Caminhos de `DeployFile` reciclando valores antigos.
- Comentários sumindo sem que a linha de código ao lado tenha mudado.

## Regra

**Depois de QUALQUER build via CLI, rode `git diff` nos arquivos `.dproj`/`.deployproj`
antes de comitar.** Se a única mudança for ruído de ferramenta (plataforma-padrão,
caminho de deploy revertido, comentário sumido, sem nenhuma alteração de configuração
que você pediu), **reverta com `git checkout --`** antes do commit — não é trabalho, é
sujeira do build. Se a mudança for uma configuração nova que você genuinamente
adicionou (um `Cfg_2_*` novo, por exemplo), confira que ela sobreviveu à regravação
antes de assumir que está lá.

Ver também [[android-deploy-e8712-buildtools]] (efeito colateral parecido, mas
especificamente do `msbuild /t:Deploy`, que também some com o `DeviceId` do
`.deployproj`).
