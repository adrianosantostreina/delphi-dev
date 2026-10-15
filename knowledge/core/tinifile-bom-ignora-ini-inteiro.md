# `.ini` gravado com BOM: `TIniFile` ignora o arquivo inteiro, em silêncio

**Sintoma.** O app lê configuração por `TIniFile` e se comporta como se o `.ini`
não existisse: porta, banco, servidor — **tudo** cai no valor default. Nenhuma
exceção, nenhuma linha no log, e o arquivo está lá, com o conteúdo certo, no
lugar certo.

**Causa.** O arquivo foi gravado em UTF-8 **com BOM** (`EF BB BF`). O `TIniFile`
do Delphi lê a primeira linha literalmente, então a seção vira `﻿[CONFIG]`
em vez de `[CONFIG]`. Nenhuma chave dessa seção é encontrada, e todo
`ReadString`/`ReadInteger` devolve o default que você passou no terceiro
parâmetro — que é justamente o mecanismo que mascara o problema:

```pascal
// Todos devolvem o default silenciosamente quando a secao nao casa
FServer  := LIniFile.ReadString('CONFIG', 'Server', FServer);
FPortDB  := LIniFile.ReadInteger('CONFIG', 'PortDB', FPortDB);
FPortAPI := LIniFile.ReadInteger('CONFIG', 'PortAPI', FPortAPI);
```

Só a **primeira** seção é afetada, o que torna o diagnóstico pior: se o `.ini`
tem `[CONFIG]`, `[EMAIL]` e `[CERTIFICADO]`, as duas últimas funcionam
normalmente e a primeira (em geral a mais importante) é ignorada.

## Como se cria o BOM sem querer

O caminho mais comum é editar o `.ini` por script, não à mão:

```powershell
# PowerShell 5.1 -- POE BOM em UTF-8. Este e o vilao mais comum.
(Get-Content x.ini) -replace 'a','b' | Set-Content x.ini -Encoding utf8
```

No PowerShell 5.1, `-Encoding utf8`, `Out-File`, `>` e `>>` gravam **com** BOM.
(No PowerShell 7+ o default mudou para UTF-8 sem BOM, então o mesmo script se
comporta de forma diferente conforme a versão — outra armadilha.)

Alternativas seguras:

```powershell
Set-Content x.ini -Encoding ascii            # sem BOM
[IO.File]::WriteAllText($p, $s)              # UTF8 sem BOM
```

```bash
python -c "import io; io.open('x.ini','w',encoding='ascii',newline='\r\n').write(s)"
```

Editores: VS Code mostra a codificação na barra de status — use
"UTF-8" e não "UTF-8 with BOM". No Notepad do Windows, "ANSI".

## Como confirmar em 1 comando

```bash
python -c "print(open('x.ini','rb').read()[:3] == b'\xef\xbb\xbf')"
```

```powershell
Format-Hex x.ini | Select-Object -First 1   # comeca com EF BB BF?
```

## Como se defender no código

Se o `.ini` é editado por terceiros (deploy, cliente, script), vale validar o
que foi lido em vez de confiar no default:

```pascal
FServer := LIniFile.ReadString('CONFIG', 'Server', '');
if FServer.IsEmpty then
  raise Exception.CreateFmt(
    'Secao [CONFIG] nao encontrada em "%s". ' +
    'Grave o arquivo SEM BOM (UTF-8 sem BOM ou ANSI).', [LFile]);
```

Um default silencioso numa chave de infraestrutura (banco, porta, host) é pior
do que uma exceção no boot: o serviço sobe, parece saudável e fala com o lugar
errado.

Reproduzido em 2026-09-09, Delphi 13, API Horse console: o `.ini` gravado com
`Set-Content -Encoding utf8` fez a API ignorar `PortAPI` e subir na porta
default — e o banner ainda imprimia a porta default como se fosse a
configurada. Ver também [encoding-utf8-bom](encoding-utf8-bom.md) e
[dfm-fmx-sem-bom](dfm-fmx-sem-bom.md).
