---
name: delphi-build
description: >
  Especialista em build e compilação de projetos Delphi via linha de comando
  (msbuild/dcc32). Auto-ativa quando detectar: "compilar", "build", "msbuild",
  "dcc32", "rsvars", arquivos .bat de build, erros de compilação (E2003, E2065,
  MSB6003, E8712), "linha de comando longa demais", build de Android/iOS, ou
  pedidos para validar a compilação de um projeto .dproj/.dpr.
---

# Delphi Build

## Idioma de saída
Detecte o idioma da primeira mensagem. Padrão: pt-BR. Respeite overrides explícitos.

## Princípio

Compilar via `.bat` que chama `rsvars.bat` + `msbuild`, **redirecionando a saída
para um arquivo de log**, e depois ler o log para diagnosticar erros. Nunca confie
apenas no exit code — o log tem o erro real (E2003/E2065/etc.).

## Referência completa

- `knowledge/core/build-via-bat-com-log.md` — template do `.bat` com log + catálogo de
  erros comuns (E2003 unit não encontrada, E2065 identificador não declarado, etc.)
- `knowledge/core/msb6003-command-line-too-long.md` — erro MSB6003 (linha de comando
  longa demais): causa e contorno
- `knowledge/fmx/android-deploy-e8712-buildtools.md` — erro E8712 e Android build-tools
  no deploy mobile

## Fluxo recomendado

1. Localizar/gerar o `build.bat` que redireciona saída para `build_log.txt`
2. Rodar o build
3. Ler `build_log.txt` e diagnosticar o **primeiro** erro (os seguintes costumam ser cascata)
4. Corrigir a causa raiz quando óbvia (uses faltando, typo de identificador, tipo/parâmetro)
5. Recompilar até `Build OK`

## Erros frequentes (consultar o catálogo completo)

| Erro | Causa típica |
|------|--------------|
| E2003 | Unit não encontrada — falta no `uses` ou no search path |
| E2065 | Identificador não declarado — typo ou unit faltando |
| MSB6003 | Linha de comando muito longa — reduzir paths/defines |
| E8712 | Android build-tools / SDK desalinhado com a versão do Delphi |
