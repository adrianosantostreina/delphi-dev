# Encoding de arquivos `.pas` — UTF-8 com BOM

Convenção do projeto: **todo arquivo de código-fonte Delphi (`.pas`, `.dpr`, `.dpk`, `.inc`) deve ser salvo como UTF-8 com BOM** (`EF BB BF` nos primeiros 3 bytes).

A regra existe para casar com o comportamento default do Write tool do Claude (que escreve UTF-8 com BOM no Windows) e para que o compilador Delphi e o IDE (Object Inspector, Code Editor) tratem strings com acento de forma previsível em todas as plataformas-alvo, sem depender da code page do sistema operacional onde o build roda.

## A regra

| Item | Valor |
|---|---|
| Encoding | UTF-8 com BOM |
| BOM bytes | `EF BB BF` (3 bytes no início do arquivo) |
| Quebra de linha | **CRLF** (`0D 0A`) — padrão Windows; LF puro pode confundir o buffer do RAD Studio |
| Strings literais com acento | escrever direto: `'Configuração'`, `'Não foi possível'` |
| Configuração do Delphi 12+ | Tools → Options → Editor → General → "Default file encoding" = `UTF-8 with BOM` |

> **Nunca** gravar `.pas` em ANSI/Windows-1252 só para "fugir" de acentos quebrados — isso contraria a convenção e quebra builds que assumem UTF-8. Se acentos estão saindo errados, o problema é o encoding do passo de gravação, não os acentos. Veja "Procedimento ao gravar pelo Claude Code".

## Anti-padrão: concatenação com `+ #NNN +`

Padrão antigo (anterior ao Delphi 11.x e/ou IDE com encoding ANSI/Windows-1252) que ainda aparece em projetos legados:

```pascal
// ❌ EVITAR — reduz legibilidade, força revisor a reconstruir mentalmente a string
AMensagemErro := 'Falha de conex' + #227 + 'o: ' + E.Message;
ShowMessage('N' + #227 + 'o foi poss' + #237 + 'vel entrar.');
LMsg := 'Permiss' + #227 + 'o de Localiza' + #231 + #227 + 'o n' + #227 + 'o concedida.';
```

A intenção era injetar o byte do code page Windows-1252 em runtime para garantir que `ã`/`ç`/`í` aparecessem certinho mesmo se o arquivo `.pas` fosse aberto pelo IDE como ANSI. Em UTF-8 com BOM, isso é completamente desnecessário:

```pascal
// ✅ CORRETO
AMensagemErro := 'Falha de conexão: ' + E.Message;
ShowMessage('Não foi possível entrar.');
LMsg := 'Permissão de Localização não concedida.';
```

## Sintomas que levam a este arquivo

- Strings concatenadas com `+ #227 +`, `+ #231 +`, `+ #245 +`, `+ #225 +`, `+ #237 +` (códigos de `ã`, `ç`, `õ`, `á`, `í`).
- Mensagens em runtime aparecem corrompidas (mojibake): "ConfiguraÃ§Ãµes" em vez de "Configurações".
- Compilador acusa `W1057 Implicit string cast from 'AnsiString' to 'string'` em RTL strict (Delphi 12+ com `{$STRINGCHECKS ON}`).
- Diff do git mostra mudanças em todo o arquivo só de abrir no IDE (a IDE re-grava sem BOM e o git registra como modificação invisível).

## Como verificar e corrigir um repositório

### Verificação (PowerShell, Windows)

Lista todos os `.pas` sem BOM:

```powershell
$root = "C:\caminho\do\projeto"
$excludeDirs = @("\bin\","\dcu\","\Win32\","\Win64\","\Android64\","\__history\","\__recovery\","\modules\")
Get-ChildItem -Path $root -Recurse -Filter "*.pas" -File | Where-Object {
  $path = $_.FullName + "\"
  $skip = $false
  foreach ($d in $excludeDirs) { if ($path -like "*$d*") { $skip = $true; break } }
  -not $skip
} | ForEach-Object {
  $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
  if ($bytes.Length -lt 3 -or $bytes[0] -ne 0xEF -or $bytes[1] -ne 0xBB -or $bytes[2] -ne 0xBF) {
    $_.FullName
  }
}
```

### Correção em massa

Antes de adicionar BOM, valide que cada arquivo já é UTF-8 válido (não ANSI Windows-1252). Adicionar BOM a um arquivo ANSI corrompe os acentos:

```powershell
$utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
foreach ($f in $arquivos) {
  $bytes = [System.IO.File]::ReadAllBytes($f)
  try { [void]$utf8Strict.GetString($bytes); "$f`tUTF8" }
  catch { "$f`tANSI — converter primeiro!" }
}
```

Se todos forem UTF-8, prepende BOM:

```powershell
$bom = [byte[]](0xEF, 0xBB, 0xBF)
foreach ($f in $arquivos) {
  $bytes = [System.IO.File]::ReadAllBytes($f)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) { continue }
  $newBytes = New-Object byte[] ($bytes.Length + 3)
  [Array]::Copy($bom, 0, $newBytes, 0, 3)
  [Array]::Copy($bytes, 0, $newBytes, 3, $bytes.Length)
  [System.IO.File]::WriteAllBytes($f, $newBytes)
}
```

> Cuidado com `Set-Content -Encoding UTF8`: no PowerShell 5.1 (default do Windows 10/11) inclui BOM, mas no PowerShell 7+ a mesma flag escreve **sem** BOM (breaking change). Para portabilidade, use `[System.IO.File]::WriteAllBytes` com BOM manual como acima.

### Substituição dos hacks `+ #NNN +`

Use Edit/Find & Replace com regex no IDE para localizar `' \+ #\d+ \+ '` e substituir manualmente cada string pelo texto com acento real. Não tem como automatizar genericamente porque a reconstrução depende do contexto da frase.

## Procedimento ao gravar pelo Claude Code

> **Caso observado (2026-06):** em ambiente Windows o Write tool gravou `.pas` novos como **UTF-8 sem BOM** — os acentos ficaram corretos em UTF-8 (`C3 A7` para `ç`), só faltou o `EF BB BF` inicial. O dcc então leu o arquivo como ANSI/Win-1252 e exibiu mojibake em runtime (`Diferença` → `DiferenÃ§a`). **Sempre conferir o BOM dos 3 primeiros bytes após criar `.pas` novo via Write e prepender `EF BB BF` se faltar** (script de correção em massa abaixo). Arquivos *editados* (Edit tool) preservam o BOM original; só os *criados* (Write) precisam da verificação.

O Write tool **deveria** gravar `.pas` em UTF-8 com BOM e CRLF, mas em alguns ambientes Windows ele falha silenciosamente:

- Acentos viram `?` literal (bytes `0x3F`) — encoder caiu para ASCII com replacement char.
- Acentos viram U+FFFD (`EF BF BD` em UTF-8, exibido como `�`) — outra forma do mesmo problema; o file resultante É UTF-8 válido mas a ç/ã/ó original foi substituída antes da gravação. Sintoma no runtime: JSON serializado mostra `�` (com BOM presente) ou `ï¿½` (sem BOM, lido como Win-1252).
- Quebras de linha saem como LF puro (`0A`) em vez de CRLF (`0D 0A`).

**Sempre verificar após o Write** quando o arquivo contém acentos ou é um `.pas`/`.dpr`/`.dpk` novo:

```powershell
# Confirma BOM (EF BB BF) e CRLF (0D 0A)
Get-Content 'caminho\Unit.pas' -Raw | Format-Hex | Select-Object -First 4
```

Se o BOM estiver ausente OU os acentos viraram `??`, regrave com PowerShell escrevendo bytes explicitamente. **Não basta** passar acentos literais inline: a transmissão do comando até o shell pode degradar multi-bytes UTF-8 a `?`. A forma robusta exige duas defesas:

1. Compor cada caractere acentuado via codepoint Unicode (`[char]0x00EA` para `ê`, `[char]0x00E3` para `ã`, `[char]0x00E7` para `ç`, etc) — assim a string nasce correta dentro do PowerShell, sem depender do encoding do pipe.
2. Gravar como **byte array** com BOM prepended manualmente — não confiar em `WriteAllText` + `UTF8Encoding($true)` (esse caminho mostrou falhar em alguns ambientes Windows, gerando arquivo sem BOM).

```powershell
$path = 'caminho\Unit.pas'
$ec = [char]0x00EA  # ê
$at = [char]0x00E3  # ã
$lines = @(
  'unit Unit1;',
  '...',
  "    ShowMessage('Voc${ec} selecionou Sim');",
  "    ShowMessage('N${at}o foi possivel');",
  '...'
)
$text = ($lines -join "`r`n") + "`r`n"

$utf8 = New-Object System.Text.UTF8Encoding($false)   # sem BOM, vamos prepender manual
$contentBytes = $utf8.GetBytes($text)
$bom = [byte[]](0xEF, 0xBB, 0xBF)
$all = New-Object byte[] ($bom.Length + $contentBytes.Length)
[Array]::Copy($bom, 0, $all, 0, 3)
[Array]::Copy($contentBytes, 0, $all, 3, $contentBytes.Length)
[System.IO.File]::WriteAllBytes($path, $all)
```

Tabela de codepoints comuns em PT-BR:

| Char | Codepoint | UTF-8 bytes |
|---|---|---|
| á | `0x00E1` | `C3 A1` |
| â | `0x00E2` | `C3 A2` |
| ã | `0x00E3` | `C3 A3` |
| ç | `0x00E7` | `C3 A7` |
| é | `0x00E9` | `C3 A9` |
| ê | `0x00EA` | `C3 AA` |
| í | `0x00ED` | `C3 AD` |
| ó | `0x00F3` | `C3 B3` |
| ô | `0x00F4` | `C3 B4` |
| õ | `0x00F5` | `C3 B5` |
| ú | `0x00FA` | `C3 BA` |
| À | `0x00C0` | `C3 80` |
| Ç | `0x00C7` | `C3 87` |
| Ã | `0x00C3` | `C3 83` |

> Conferir após gravar com `Get-Content … -Raw -Encoding Byte | Select -First 16`: deve começar com `239 187 191` (BOM) e linhas com `13 10` (CRLF).

> `Set-Content -Encoding UTF8` é instável entre PS 5.1 e 7+. `[System.IO.File]::WriteAllText` com `UTF8Encoding($true)` *deveria* incluir BOM mas mostrou falhar — usar `WriteAllBytes` com BOM manual é o caminho seguro.

## Armadilhas conhecidas

- **`__history/` e `__recovery/`**: o IDE pode regravar versões antigas (sem BOM, com hack `#NNN`) por cima das corrigidas se você fizer roundtrip pelo Object Inspector. Adicionar `__history/` e `__recovery/` ao `.gitignore` (já é prática padrão) e fechar/reabrir o projeto após a conversão.
- **`.dfm` / `.fmx`**: por design ficam em UTF-16 LE com BOM no Delphi atual (não UTF-8). Não converter.
- **`.dproj`** (XML): UTF-8 sem BOM é o default do MSBuild. Manter como está.
- **Compilação cruzada Windows ↔ Android**: a regra do BOM é a mesma — o compilador Delphi não muda comportamento por plataforma-alvo, só por encoding do arquivo-fonte.
