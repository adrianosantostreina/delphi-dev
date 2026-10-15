# [FMX] Rodar um app mobile no Windows para testar (o que costuma impedir)

Executar no desktop um app FMX escrito para Android/iOS encurta muito o ciclo de
teste — não depende de gerar APK nem de aparelho conectado. Estes são os pontos
que costumam impedir a abertura, todos observados em projeto real.

## 1. Macro de conexão do FireDAC no caminho do banco

```pascal
{$IF DEFINED(ANDROID) OR DEFINED(IOS)}
  fdConn.Params.Values['Database'] := TPath.Combine(TPath.GetDocumentsPath, 'MEU.db');
{$ELSE}
  fdConn.Params.Values['Database'] := '$(MEU_BD)';   // <-- só existe DENTRO da IDE
{$ENDIF}
```

`$(MEU_BD)` é uma *connection definition* do FireDAC, resolvida apenas pelo RAD
Studio. Rodando o `.exe` direto, o SQLite recebe o texto literal `$(MEU_BD)` como
nome de arquivo, **abre um banco vazio** e o app morre na primeira consulta com
`no such table: <QUALQUER>`. Resolver a partir de `ExtractFilePath(ParamStr(0))`.

## 2. Caminho relativo ao diretório de TRABALHO

`'..\..\Database\MEU.db'` depende de quem inicia o processo — muda entre a IDE, um
atalho e um script. Usar sempre a pasta do executável.

## 3. `OpenMode` no SQLite

Sem `OpenMode=ReadWrite`, o SQLite **cria** um banco vazio quando o arquivo não
existe, e a falha só aparece depois como `no such table` — que não diz nada sobre
a causa. Com `ReadWrite`, falha na hora apontando o arquivo.

## 4. Log desligado no desktop

Procurar por `EnableLog(False)` sob `{$IFDEF MSWINDOWS}`. Sem log, a execução no
Windows fica cega.

## 5. Diagnóstico de startup

Envolver os `Application.CreateForm` num `try/except` que grave a exceção num
arquivo ao lado do exe. Sem isso, o Event Viewer mostra apenas `0x0eedfade`
(exceção Delphi genérica), sem dizer qual.

## 6. Skia

Com `GlobalUseSkia := True`, copiar `sk4d.dll` do `bin` do RAD Studio para junto
do `.exe` — o build por linha de comando não faz isso.

## 7. ⚠️ Pastas especiais são COMPARTILHADAS no desktop

No Android/iOS, `TPath.GetDocumentsPath` e `GetCachePath` são **privados por
aplicativo**. No Windows, **não**: é a pasta Documentos do usuário, visível a
todos os programas.

Um `config.ini` gravado ali colide com o de qualquer outro app. Caso real: dois
apps de força de vendas nascidos da mesma base de código gravavam
`<Documents>\config.ini` — um sobrescreveu servidor, porta e usuário do outro, e o
app passou a autenticar contra a API errada.

Pior quando leitura e escrita divergem: um app lia de `<exe>\config.ini` mas
gravava em `<Documents>\config.ini`; no desktop, nada que o usuário salvasse na
tela de Configurações voltava na abertura seguinte.

**Regra:** no desktop, sempre uma **subpasta com o nome do app**, e o mesmo
caminho para ler e gravar.

```pascal
{$IFDEF MSWINDOWS}
  Result := TPath.Combine(TPath.GetDocumentsPath, 'MeuApp');
  if not TDirectory.Exists(Result) then
    TDirectory.CreateDirectory(Result);
{$ELSE}
  Result := TPath.GetDocumentsPath;
{$ENDIF}
```

## Ver também

- [fmx-automacao-windows-sem-foco.md](fmx-automacao-windows-sem-foco.md) — como
  dirigir o app já rodando, sem atrapalhar quem está usando a máquina.
- [firedac-sqlite-mobile-beforeconnect.md](firedac-sqlite-mobile-beforeconnect.md)
