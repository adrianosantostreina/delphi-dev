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

## Regra fundamental

**Todo arquivo Delphi deve ser salvo em UTF-8 com BOM.**

O hook `PostToolUse` do plugin injeta o BOM automaticamente ao gravar
`.pas`/`.dfm`/`.dpr`/`.dpk`/`.inc`/`.fmx`. Mas se o hook não estiver ativo, ou para
arquivos existentes sem BOM, use o procedimento abaixo.

## Referência completa

Consulte `knowledge/core/encoding-utf8-bom.md` para:
- Diagnóstico de mojibake
- Como verificar e corrigir BOM em arquivos existentes
- `{$CODEPAGE UTF8}` para forçar encoding em units específicas
- Encoding em `TStringList.LoadFromFile` / `SaveToFile`
- Projetos pré-XE2 que precisam de ANSI/CP1252

## Checklist ao criar/editar arquivo Delphi

1. Arquivo novo → BOM já injetado automaticamente pelo hook
2. Arquivo antigo sem BOM → adicionar BOM antes de commitar
3. `TStringList.LoadFromFile` → sempre passar `TEncoding.UTF8` como segundo parâmetro
4. String literal com acento → não use `#NNN` — use o caractere diretamente (UTF-8)

## Anti-padrão comum

```delphi
// PROIBIDO — concatenação de caracteres especiais
LMsg := 'Op' + #231 + #227 + 'o selecionada';

// CORRETO — UTF-8 direto (com BOM no arquivo)
LMsg := 'Opção selecionada';
```
