# ADRConnection — IADRQuery: comportamento do builder SQL

## Como funciona o acúmulo de SQL

`FQuery.SQL(fragment)` **sempre APPEND** ao buffer interno (`FSQL: TStrings`). Nunca reseta.

```pascal
FQuery.SQL('select t.*')
      .SQL('from tabela t')
      .SQL('where t.id = :id')
      .ParamAsInteger('id', 1)
      .OpenDataSet;
```

Após cada operação (`.Open`, `.OpenDataSet`, `.ExecSQL`, `.ExecSQLAndCommit`), o buffer é limpo automaticamente em `finally`:
```pascal
FSQL.Clear;
FParams.Clear;
```

**Consequência:** sempre que escrever um método DAO que monta SQL em partes, chamar as partes de base (ex: `Select`) ANTES de chamar `.OpenDataSet` na mesma chamada do método. Se `Select` e a cláusula extra forem chamadas em chamadas separadas de `FQuery.SQL(...)` (não encadeadas), funciona porque ambas fazem `FSQL.Add`.

## .Open vs .OpenDataSet

| Método | Onde executa | Como ler resultado |
|---|---|---|
| `.Open` | No `FDQuery` interno (singleton do DAO) | `FQuery.DataSet.FieldByName(...)` após a chamada |
| `.OpenDataSet` | Cria um `TFDQuery` temporário | Retorna `TDataSet` — **chamar `Free` após uso** |

## Lendo RETURNING após INSERT (Firebird)

```pascal
FQuery
  .SQL('insert into tabela (campo) values (:campo)')
  .SQL('returning id')
  .ParamAsInteger('campo', valor)
  .Open;                                          // executa
AEntidade.Id := FQuery.DataSet.FieldByName('id').AsInteger;  // lê o retorno
```

`FQuery.DataSet` expõe o `FDQuery` interno. Após `.Open`, ele contém o resultado do `RETURNING`. Não chamar `FQuery.DataSet.Free` — o `FDQuery` é de propriedade do DAO.

## Armadilha: Select sem encadeamento

```pascal
// ERRADO — Select é chamado mas depois FQuery.SQL('where...') é nova chamada
// No contexto correto (FSQL acumula), funciona:
procedure TDao.BuscaPorId(AId: Integer): TEntidade;
begin
  Select;                                    // adiciona SELECT...FROM ao FSQL
  LDataSet := FQuery
    .SQL('where t.id = :id')               // adiciona WHERE ao mesmo FSQL
    .ParamAsInteger('id', AId)
    .OpenDataSet;                           // executa tudo, limpa FSQL
  ...
end;
```

Se `Select` não for chamado, a query começa com `where ...` → Firebird lança `Token unknown - line 1, column 1 - where`.

## Armadilha: `GetConnectionIniFile` lê a chave `Port` (não `PortDB`) e cai em porta 0

`TADRConnModelFactory.GetConnectionIniFile` monta a conexão a partir de um `.ini`
(seção default **`CONFIG`**) lido por `TADRConnConfigIni`. As chaves que a lib lê são
fixas: `Driver`, `Database`, `User_Name`, `Password`, `Server`, `VendorLib`,
`Protocol` e **`Port`**. E a factory só aplica a porta **se for > 0**:

```pascal
if LIniConfig.Port > 0 then
  Result.Params.Port(LIniConfig.Port);
```

`FPort` default é **0**. Então, se o `.ini` usar outro nome de chave para a porta
(ex.: `PortDB`, comum quando há um leitor de config próprio do projeto em paralelo),
a lib lê `Port` → ausente → **0** → porta nunca aplicada → o FireDAC tenta conectar na
**porta 0** → socket preso em `SYN_SENT` → a thread **trava** (no Linux/Docker isso vira
hang de ~30s até o timeout do proxy, sem erro). O log do app pode enganar se outro
objeto (ex.: um `TSettings` próprio que lê `PortDB`) imprimir a porta "certa": são
**dois leitores de `.ini` com chaves diferentes**.

**Correção:** garantir a chave **`Port`** no `.ini` (além de qualquer `PortDB` que o
projeto use). Como `modules/` não deve ser editado, o fix é no `.ini`/config do projeto,
não na lib. Para validar no boot, logar a porta efetiva que a lib enxerga:
`TADRConnConfigIni.GetInstance.Port` (0 = `.ini` sem `Port`). Vale também para
`VendorLib`: a lib só aplica `.Lib()` se a chave `VendorLib` existir no `.ini`.

## Armadilha: `ADRCONN_FIREDAC` definido só numa plataforma do `.dproj`

O `.dproj` costuma ter um `PropertyGroup` de `DCC_Define` **separado por
plataforma+config** (`Base_Win32`/`Cfg_1_Win32`, `Base_Android`, `Base_Android64`...).
`ADRCONN_FIREDAC` (ou qualquer outro `{$IFDEF}` que a lib pede) precisa estar em
**TODOS** os blocos que geram build de verdade — definir só no bloco de Win32 (o mais
usado no dia a dia de desenvolvimento) deixa Android/Android64 **compilando limpo** e
**caindo direto no `{$ELSE} raise Exception` da lib em runtime**, sem nenhum aviso do
compilador. Sintoma real: app roda liso no Win32 (usado em toda validação da equipe) e
no aparelho a tela fica num loop de abrir/fechar (Activity foreground morrendo e
reabrindo) — nada na tela indica “banco”, porque a excepção nunca chega a aparecer,
só o log de arquivo do próprio app (se existir) mostra a mensagem exata.

**Checar:** `grep -n "DCC_Define" Projeto.dproj` e confirmar o define em CADA bloco
`Base_<Plataforma>`/`Cfg_*_<Plataforma>` que o projeto realmente publica — não só no
que o time usa pra testar. Ver também [[android-device-debug-live-adb-scrcpy]] para o
fluxo de achar isso lendo o log do próprio app no aparelho.
