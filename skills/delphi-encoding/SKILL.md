---
name: delphi-encoding
description: >
  Especialista em encoding de arquivos Delphi. Auto-ativa quando detectar arquivos
  .pas/.dfm/.dpr/.dpk/.inc/.fmx, problemas de encoding, BOM, acentos quebrados,
  mojibake, ou menções a "encoding", "UTF-8", "BOM", "ANSI", "acentos", "ç", "ã".
---

# Delphi Encoding

## Idioma de saída
Detecte o idioma da primeira mensagem. Padrão: pt-BR. Respeite overrides explícitos
("responda em inglês" / "respond in English").

## Regra fundamental — depende do tipo de arquivo

| Arquivo | Encoding | Acento em string |
|---|---|---|
| `.pas` / `.dpr` / `.dpk` / `.inc` | UTF-8 **com** BOM | caractere direto: `'Opção'` |
| `.dfm` / `.fmx` | ASCII puro, **sem** BOM | escape `#NNN`, como o IDE grava: `'Op'#231#227'o'` |

- **Form com BOM** → `Error creating form: Invalid stream format` ao abrir no designer.
- **Form com acento cru (UTF-8 sem BOM)** → o compilador de recursos lê como ANSI e a tela mostra
  "OpÃ§Ã£o".
- **Nome de objeto em form** (`object mnItOpcoes: TMenuItem`) → **sempre ASCII**. Identificador não
  aceita `#NNN`; se encontrar um com acento, renomeie no `.dfm`/`.fmx` **e** no `.pas`.

O hook `PostToolUse` do plugin aplica isso ao gravar: põe BOM em `.pas`/`.dpr`/`.dpk`/`.inc` e
converte acentos de strings de `.dfm`/`.fmx` em `#NNN`. Sem o hook ativo (sem Node), siga a tabela
à mão.

## Sem hook ativo (Codex, OpenCode ou Claude Code sem Node)

Se o hook de encoding não estiver rodando, aplique a regra da tabela depois de gravar arquivos
Delphi, executando:

```
node "<raiz>/runtime/kb-cli.mjs" fix-encoding <arquivos>
```

`<raiz>` é a raiz do plugin: `~/.delphi-dev/plugin` no Codex e no OpenCode. O comando põe BOM em
`.pas/.dpr/.dpk/.inc` e converte acentos de `.dfm/.fmx` em `#NNN`; não toca arquivos ANSI, UTF-16 nem
binários.

## Referência completa

Consulte a base (`kb_get` com `core/encoding-utf8-bom.md`, ou o arquivo em `knowledge/`) para:
- Diagnóstico de mojibake
- Como verificar e corrigir BOM em arquivos existentes
- `{$CODEPAGE UTF8}` para forçar encoding em units específicas
- Encoding em `TStringList.LoadFromFile` / `SaveToFile`
- Projetos pré-XE2 que precisam de ANSI/CP1252

## Checklist ao criar/editar arquivo Delphi

1. `.pas` novo → BOM (o hook injeta)
2. `.dfm`/`.fmx` novo → sem BOM, acentos de `Caption`/`Text`/`Hint` como `#NNN`, nomes de objeto ASCII
3. Arquivo antigo → conferir os 3 primeiros bytes antes de commitar (`EF BB BF` só em fonte)
4. `TStringList.LoadFromFile` → sempre passar `TEncoding.UTF8` como segundo parâmetro

## Anti-padrão comum

```delphi
// PROIBIDO em .pas — concatenação de caracteres especiais
LMsg := 'Op' + #231 + #227 + 'o selecionada';

// CORRETO em .pas — UTF-8 direto (arquivo com BOM)
LMsg := 'Opção selecionada';
```

```
// CORRETO em .dfm/.fmx — é assim que o próprio IDE grava
Caption = 'Op'#231#227'o selecionada'
```
