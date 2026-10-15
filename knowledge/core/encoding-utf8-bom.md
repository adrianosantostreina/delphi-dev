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

## Também afeta `.ps1` (scripts PowerShell) — sintoma é erro de parsing, não mojibake

> **Caso observado (2026-09):** script `.ps1` gerado pelo Write tool com acentos/travessão PT-BR
> (usado num heredoc `@'...'@` para popular um `CLAUDE.md`) saiu **sem BOM**. Rodar o script no
> **Windows PowerShell 5.1** (não no PowerShell 7+) deu uma cascata de erros de sintaxe sem relação
> aparente com o ponto real do problema: `'}' de fechamento ausente`, `A cadeia de caracteres não
> tem o terminador: "`, `Token ')' inesperado` — em linhas *fora* de qualquer heredoc, bem depois do
> texto com acento.

Causa: sem BOM, o parser do PowerShell 5.1 decodifica o arquivo pelo codepage ANSI do sistema
(não UTF-8). Um travessão `—` (`E2 80 94` em UTF-8) vira 3 bytes lidos separadamente em Windows-1252;
o último (`0x94`) mapeia para `”` (aspas curvas de fechamento, U+201D). O parser do PowerShell trata
esse tipo de "aspas inteligentes" Unicode como equivalente a `"` para fins de abertura/fechamento de
string — então uma string comum vira "não fechada" do ponto de vista do parser, e o erro real fica
muitas linhas depois do byte que causou tudo. **PowerShell 7+ não tem esse problema** (assume UTF-8
por padrão mesmo sem BOM); só afeta 5.1, que ainda é o `powershell.exe` default do Windows 10/11.

Verificação sem executar o script (não precisa rodar de verdade para achar o erro):

```powershell
$errors = $null; $tokens = $null
[void][System.Management.Automation.Language.Parser]::ParseFile('caminho\script.ps1', [ref]$tokens, [ref]$errors)
if ($errors.Count -eq 0) { 'OK' } else { $errors | ForEach-Object { "$($_.Message) @ linha $($_.Extent.StartLineNumber)" } }
```

Fix (mais simples que o procedimento de `.pas` acima — `WriteAllText` com BOM funcionou neste caso,
ao contrário do que a nota da linha 166 registra para `.pas`; confirme sempre com o `ParseFile` acima
em vez de assumir):

```powershell
$path = 'caminho\script.ps1'
$text = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($true)))
```

Regra prática: **todo `.ps1` gravado pelo Write tool que contenha acento/travessão/aspas PT-BR deve
ser validado com `ParseFile` antes de entregar** — não confiar em leitura visual do conteúdo, porque
o texto aparece correto no editor mesmo quando o BOM está faltando.

## `.dfm` / `.fmx` com acentos criados/editados pelo Claude Code — usar `#NNN` (ASCII, sem BOM)

> ⚠️ **Correção 2026-07 (confirmada por build no Delphi 10.3.3):** a regra abaixo foi **revista**. A
> orientação anterior ("gravar `.fmx` com acento literal em UTF-8 COM BOM") é **arriscada no 10.3.3** — o
> BOM antes de `object` dispara `Invalid stream format` no leitor de forms (ver
> [dfm-fmx-sem-bom.md](dfm-fmx-sem-bom.md)); o Delphi 12 às vezes tolera, mascarando até o downgrade. A rota
> **segura e nativa** é acento como escape **`#NNN`** em ASCII puro **sem BOM** — exatamente o que o Form
> Designer grava ao salvar, e o formato de todos os `.fmx` legados.

| Rota para acento em `.fmx`/`.dfm` | 10.3.3 | Observação |
|---|---|---|
| `#NNN` (ASCII puro, **sem BOM**): `Header = 'C'#243'digo'` | ✅ | **Formato nativo do IDE.** Preferido. |
| Literal UTF-8 **com BOM** | ⚠️ | BOM → `Invalid stream format` no 10.3.3. Evitar. |
| Literal UTF-8 **sem BOM** | ❌ | Lido como ANSI → mojibake (`CÃ³digo`, `opÃ§Ãµes`, `MÃ¡x`). |
| UTF-16 (com/sem BOM) | ❌ | `E2141 Bad file format` — o compilador de recursos lê `.fmx` só como UTF-8 ou ANSI. |

**Regra:** ao criar/editar um `.fmx`/`.dfm` com acentos pelo Write/Edit, gravar cada acento como escape
**`#NNN`** (code point decimal), em ASCII puro e **sem BOM**. Isto **não** é o anti-padrão de `.pas`
(`'x' + #227 + 'y'` com `+`, em código de runtime): no form, `'C'#243'digo'` (fragmentos justapostos) é a
**sintaxe própria do formato de form**, idêntica ao que o IDE gera. A convenção "`.pas` = UTF-8 COM BOM +
acento literal" (topo deste arquivo) vale só para código-fonte; forms seguem a regra oposta.

Conversão literal→`#NNN` (percorre cada string do form; cada char `>127` vira `#<ord>`, partes ASCII
ficam em `'...'`, `''` preservado). Ex.: `Text = 'Descrição'` → `Text = 'Descri'#231#227'o'`. Depois,
confirmar que o arquivo é 100% ASCII e não tem BOM.

### Histórico (rota antiga, NÃO usar no 10.3.3 — mantida só como registro)

> **Caso observado (2026-06), com correção confirmada por build:** ao criar um `.fmx` novo pelo Write tool, o arquivo saiu em **UTF-8 sem BOM**. Os acentos LITERAIS nas propriedades de texto (`Text = 'Conexão com a API'`) ficaram em bytes UTF-8 (`C3 A3`), mas o leitor de stream do FMX (IDE Designer e compilador), na ausência de BOM, interpretou cada byte como ANSI/Win-1252 → **mojibake** (`ConexÃ£o`, `VersÃ£o`, `PreferÃªncias`). Sintoma típico: o **Form Designer** mostra os textos estáticos corrompidos (e o título com o default `LblTitulo`, porque `LblTitulo.Text` só é setado em runtime pelo `.pas`).
>
> ⚠️ **UTF-16 NÃO serve.** Tentar salvar o `.fmx` em UTF-16 LE com BOM faz o dcc falhar com **`E2141 Bad file format`** — o compilador de recursos do RAD Studio lê `.fmx`/`.dfm` apenas como **UTF-8 (com ou sem BOM) ou ANSI**, nunca UTF-16.

**Regra (confirmada):** um `.fmx`/`.dfm` com acentos literais deve estar em **UTF-8 COM BOM** (`EF BB BF`) — o mesmo encoding dos `.pas`. O Write tool grava UTF-8 **sem** BOM, então **após criar/editar um `.fmx` com acentos, prepender o BOM UTF-8**, mantendo os acentos literais (NÃO usar o hack `#NNN` para "compor" acento — o acento é caractere real; o que muda é só o BOM do arquivo).

> `.fmx` legados que só têm ASCII (acentos escapados como `#NNN`, ex.: `'Refer'#234'ncia'`) são puro ASCII e não precisam de BOM — funcionam como estão. A regra do UTF-8 BOM vale quando você grava acentos LITERAIS no arquivo (caminho preferido com o Claude). Não é preciso converter os legados.

Correção segura (o conteúdo já está em UTF-8 válido; só falta o BOM):

```powershell
$path = 'caminho\Inforsys.View.X.fmx'
$text = [System.IO.File]::ReadAllText($path, (New-Object System.Text.UTF8Encoding($false)))
$enc  = New-Object System.Text.UTF8Encoding($true)   # UTF-8 COM BOM
[System.IO.File]::WriteAllText($path, $text, $enc)
# Conferir: deve comecar com ef bb bf
(([System.IO.File]::ReadAllBytes($path))[0..2] | ForEach-Object { $_.ToString('x2') }) -join ' '
```

> Pré-condição: o `.fmx` precisa estar em UTF-8 **válido** (acentos como `C3 xx`), não já corrompido. Se o Write degradou acentos para `?`/`�`, recriar o conteúdo antes de adicionar o BOM.

### Atenção ao editar depois um `.fmx` já com BOM

Ferramentas de texto (incl. o Edit tool) podem regravar sem o BOM. Após qualquer edição de um `.fmx` com acentos, **reconferir os 3 primeiros bytes** (`EF BB BF`) e reprepender se necessário.

## Armadilhas conhecidas

- **`__history/` e `__recovery/`**: o IDE pode regravar versões antigas (sem BOM, com hack `#NNN`) por cima das corrigidas se você fizer roundtrip pelo Object Inspector. Adicionar `__history/` e `__recovery/` ao `.gitignore` (já é prática padrão) e fechar/reabrir o projeto após a conversão.
- **`.dfm` / `.fmx`**: o compilador lê como **UTF-8 (com/sem BOM) ou ANSI** — **nunca UTF-16** (dá `E2141 Bad file format`). Com acentos literais, usar UTF-8 COM BOM (seção dedicada acima).
- **`.dproj`** (XML): UTF-8 sem BOM é o default do MSBuild. Manter como está.
- **Compilação cruzada Windows ↔ Android**: a regra do BOM é a mesma — o compilador Delphi não muda comportamento por plataforma-alvo, só por encoding do arquivo-fonte.

## Nunca adicione BOM em massa sem detectar o encoding real do arquivo

Erro cometido em 2026-08-31 no TMV 3.0, e vale para qualquer projeto Delphi legado.

Ao padronizar "todo `.pas` com BOM UTF-8", a tentação é varrer o projeto assim:

```python
# ERRADO — assume que todo arquivo com byte alto ja e UTF-8
if not b.startswith(b'\xef\xbb\xbf') and any(x > 127 for x in b):
    open(p,'wb').write(b'\xef\xbb\xbf' + b)
```

Projeto Delphi antigo tem `.pas` em **CP1252**, não em UTF-8. Nesses, `ç` é o byte
único `E7` — sequência **inválida** em UTF-8. Prepender o BOM faz o arquivo *declarar*
UTF-8 carregando bytes Latin-1: o compilador passa a ler os acentos errado. Ou seja, a
"padronização" produz exatamente a corrupção que ela existia para evitar.

**Sintoma no build:** avisos novos e aparentemente sem nexo, tipo
`W1064 Widening given AnsiString constant lost information`, em arquivo que você só
"carimbou". O build não falha — por isso passa despercebido.

### Detectar antes de escrever

```python
corpo = b[3:] if b.startswith(b'\xef\xbb\xbf') else b
try:
    txt = corpo.decode('utf-8')       # ja era UTF-8: so falta o BOM
except UnicodeDecodeError:
    txt = corpo.decode('cp1252')      # era ANSI: precisa CONVERTER, nao carimbar
open(p, 'wb').write(b'\xef\xbb\xbf' + txt.encode('utf-8'))
```

### Auditoria depois de qualquer conversão em massa

Para cada arquivo tocado: tirar o BOM e tentar `decode('utf-8')` estrito. Qualquer
`UnicodeDecodeError` é um arquivo que declara UTF-8 sem ser. Deve dar **zero**.

Confira também uma linha acentuada de cada arquivo convertido (`Instruções SQL`,
`Endereço`, `Obrigatório`). Se aparecer `Ã§`/`Ã£`, houve dupla codificação; se aparecer
`�` (U+FFFD), a informação **se perdeu** e só se recupera reescrevendo o texto à mão —
veja [git-bash-msys-exe-sobrescreve-binario.md](git-bash-msys-exe-sobrescreve-binario.md)
para o caso em que a corrupção já está gravada na fonte.
