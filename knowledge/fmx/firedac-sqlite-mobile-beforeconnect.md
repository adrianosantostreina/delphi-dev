# [FMX/Mobile] FireDAC + SQLite no Android/iOS — caminho do banco no BeforeConnect e OpenMode

## Padrão obrigatorio: definir o `Database` por plataforma no `OnBeforeConnect`
O caminho do `.db` muda entre desktop e mobile. Definir em runtime no
`TFDConnection.OnBeforeConnect`, nunca fixo no Object Inspector:

```pascal
procedure TServiceConexao.fdConnBeforeConnect(Sender: TObject);
begin
  {$IF DEFINED(ANDROID) OR DEFINED(IOS)}
    // O .db foi deployado em .\assets\internal\ e cai aqui em runtime.
    fdConn.Params.Values['Database'] := TPath.Combine(TPath.GetDocumentsPath, 'PDVAndroid.db');
  {$ELSE}
    // Windows/desktop: pasta do projeto (ou ExtractFilePath(ParamStr(0)) p/ producao).
    fdConn.Params.Values['Database'] := 'D:\...\database\PDVAndroid.db';
  {$ENDIF}
  fdConn.Params.Values['OpenMode'] := 'ReadWrite';   // <-- ver pegadinha abaixo
end;
```

- No Android, `TPath.GetDocumentsPath` = `/data/data/<package>/files` — e o **unico**
  Remote Path que enxerga o que foi deployado em `.\assets\internal\`
  (ver [deployment-arquivos-extras.md](deployment-arquivos-extras.md)).
- `uses System.IOUtils` (para `TPath`).

## Pegadinha critica: `OpenMode` precisa ser `ReadWrite`
O default do FireDAC/SQLite e `CreateUTF8` (ou `Create*`). Com esse default, **se o arquivo
nao existir no caminho informado, o SQLite cria um banco NOVO e VAZIO** — sem nenhuma
tabela. O app entao conecta "com sucesso", mas a primeira query falha com
`no such table: <tabela>`. Se essa excecao for engolida (except vazio), o sintoma vira um
enganoso **`Cannot perform this operation on a closed dataset`** no caller (o dataset nunca
abriu), escondendo a causa real.

Definir `OpenMode = ReadWrite`:
- forca o uso do **arquivo real** (o banco deployado, com estrutura);
- **falha de forma clara** se o caminho estiver errado / o arquivo nao foi deployado,
  em vez de mascarar criando um banco vazio.

(Use `ReadOnly` apenas se o app nunca grava; para gravar — carrinho, config — tem que ser
`ReadWrite`.)

## Checklist quando "o banco abre mas nao tem dados" no device
1. O `.db` esta em **Project > Deployment** com Remote Path `.\assets\internal\` para a
   plataforma certa (Android **e** Android64) e configuracao certa (Debug/Release)?
2. `OpenMode = ReadWrite` no `BeforeConnect`?
3. Re-deployar **pela IDE** (Run/Deploy) — `build.bat`/dcc so compila e linka, **nao**
   empacota o APK nem copia assets.
4. Nao engolir excecao em `AbrirQuery`/`Active := True` (logar + `raise`), senao o erro
   real (`no such table`) vira "closed dataset" no caller.

Relacionado: [deployment-arquivos-extras.md](deployment-arquivos-extras.md),
[firedac-registro-drivers.md](firedac-registro-drivers.md),
[firedac-console-firebird.md](firedac-console-firebird.md).
